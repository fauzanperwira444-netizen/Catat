// Use case projek (FR-01 … FR-05) dan sesi (FR-06 … FR-10).
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Ctx } from '@/server/db';
import { projects, sessions, tasks, type Project, type Session } from '@/server/schema';
import { colorMeta, PROJECT_COLORS } from '@/shared/colors';
import { DomainError } from '@/shared/errors';
import type { DomainEvent } from '@/shared/events';
import { fmtDayMonth, fmtRange, isDateStr, now, type DateStr } from '@/shared/time';
import { removeFromUpcomingTodos } from '@/modules/todos/repo';
import {
  holdsColor,
  liveSessions,
  overlaps,
  projectRange,
  projectStatus,
  sessionNow,
  type ProjectStatus,
} from './rules';

// ---------- Skema input ----------

const dateSchema = z.string().refine(isDateStr, 'Tanggal tidak valid.');

export const projectInputSchema = z.object({
  name: z.string().trim().min(1, 'Isi nama projek.').max(80, 'Nama projek paling panjang 80 karakter.'),
  description: z.string().trim().max(2000).default(''),
  team: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  links: z
    .array(
      z.object({
        name: z.string().trim().max(60).default(''),
        url: z.string().trim().url('Tautan harus berupa alamat web lengkap, misalnya https://…'),
      }),
    )
    .max(30)
    .default([]),
  color: z.enum(PROJECT_COLORS, { errorMap: () => ({ message: 'Pilih warna projek.' }) }),
});
export type ProjectInput = z.input<typeof projectInputSchema>;

export const sessionInputSchema = z
  .object({
    name: z.string().trim().min(1, 'Isi nama sesi.').max(80, 'Nama sesi paling panjang 80 karakter.'),
    startDate: dateSchema,
    endDate: dateSchema,
    description: z.string().trim().max(2000).default(''),
    goals: z.string().trim().max(2000).default(''),
  })
  .refine((s) => s.startDate <= s.endDate, {
    message: 'Tanggal selesai tidak boleh sebelum tanggal mulai.',
    path: ['endDate'],
  });
export type SessionInput = z.input<typeof sessionInputSchema>;

// ---------- Pembacaan ----------

export type ProjectSummary = Project & {
  sessions: Session[];
  status: ProjectStatus;
  activeTaskCount: number;
  totalTaskCount: number;
  doneTaskCount: number;
  range: { start: DateStr; end: DateStr } | null;
  currentSession?: Session;
  nextSession?: Session;
};

async function taskCountsByProject(ctx: Ctx, projectIds: string[]) {
  if (!projectIds.length) return new Map<string, { active: number; total: number; done: number }>();
  const rows = await ctx.db
    .select({
      projectId: sessions.projectId,
      active: sql<number>`sum(case when ${tasks.doneAt} is null and ${tasks.canceledAt} is null then 1 else 0 end)`.mapWith(Number),
      done: sql<number>`sum(case when ${tasks.doneAt} is not null and ${tasks.canceledAt} is null then 1 else 0 end)`.mapWith(Number),
      total: sql<number>`sum(case when ${tasks.canceledAt} is null then 1 else 0 end)`.mapWith(Number),
    })
    .from(tasks)
    .innerJoin(sessions, eq(tasks.sessionId, sessions.id))
    .where(inArray(sessions.projectId, projectIds))
    .groupBy(sessions.projectId);
  return new Map(rows.map((r) => [r.projectId, { active: r.active ?? 0, total: r.total ?? 0, done: r.done ?? 0 }]));
}

export async function listProjects(ctx: Ctx, today: DateStr, ids?: string[]): Promise<ProjectSummary[]> {
  const ps = await ctx.db
    .select()
    .from(projects)
    .where(ids ? inArray(projects.id, ids) : undefined)
    .orderBy(asc(projects.createdAt));
  if (!ps.length) return [];
  const ss = await ctx.db
    .select()
    .from(sessions)
    .where(inArray(
      sessions.projectId,
      ps.map((p) => p.id),
    ))
    .orderBy(asc(sessions.startDate));
  const counts = await taskCountsByProject(
    ctx,
    ps.map((p) => p.id),
  );
  return ps.map((p) => {
    const mine = ss.filter((s) => s.projectId === p.id);
    const c = counts.get(p.id) ?? { active: 0, total: 0, done: 0 };
    const { current, next } = sessionNow(mine, today);
    return {
      ...p,
      sessions: mine,
      status: projectStatus(p, mine, c.active, today),
      activeTaskCount: c.active,
      totalTaskCount: c.total,
      doneTaskCount: c.done,
      range: projectRange(mine),
      currentSession: current,
      nextSession: next,
    };
  });
}

export async function getProject(ctx: Ctx, id: string, today: DateStr) {
  const [p] = await listProjects(ctx, today, [id]);
  if (!p) throw new DomainError('Projek tidak ditemukan.');
  return p;
}

// ---------- Aturan warna (FR-02) ----------

/** Warna yang sedang dipegang projek lain yang belum selesai/batal. */
export async function colorsInUse(ctx: Ctx, today: DateStr, exceptProjectId?: string) {
  const all = await listProjects(ctx, today);
  const map = new Map<string, string>();
  for (const p of all) if (p.id !== exceptProjectId && holdsColor(p.status)) map.set(p.color, p.name);
  return map;
}

async function assertColorFree(ctx: Ctx, color: string, today: DateStr, exceptProjectId?: string) {
  const holder = (await colorsInUse(ctx, today, exceptProjectId)).get(color);
  if (holder)
    throw new DomainError(
      `Warna ${colorMeta(color).name.toLowerCase()} sedang dipakai projek "${holder}". Pilih warna lain.`,
      'color',
    );
}

/**
 * Projek yang sudah selesai (warnanya sudah lepas) bisa aktif lagi saat diberi
 * sesi atau task baru. Pastikan warnanya tidak bentrok dengan projek lain.
 */
async function assertCanReactivate(ctx: Ctx, p: ProjectSummary, today: DateStr) {
  if (!holdsColor(p.status)) await assertColorFree(ctx, p.color, today, p.id);
}

export function assertProjectEditable(p: ProjectSummary) {
  if (p.canceledAt) throw new DomainError('Projek ini sudah dibatalkan dan tidak bisa diubah.');
  if (p.completedEarlyAt) throw new DomainError('Projek ini sudah diselesaikan dan tidak bisa diubah.');
}

// ---------- Projek ----------

export async function createProject(ctx: Ctx, raw: ProjectInput, today: DateStr) {
  const input = projectInputSchema.parse(raw);
  await assertColorFree(ctx, input.color, today);
  const [row] = await ctx.db.insert(projects).values(input).returning();
  return row;
}

export async function updateProject(ctx: Ctx, id: string, raw: ProjectInput, today: DateStr) {
  const input = projectInputSchema.parse(raw);
  const p = await getProject(ctx, id, today);
  assertProjectEditable(p);
  if (input.color !== p.color || !holdsColor(p.status)) await assertColorFree(ctx, input.color, today, id);
  const [row] = await ctx.db.update(projects).set(input).where(eq(projects.id, id)).returning();
  return row;
}

/**
 * FR-05: membatalkan projek membatalkan semua task aktifnya, mengeluarkannya dari
 * to-do mendatang, dan melepas warnanya. Riwayat tetap tersimpan.
 */
export async function cancelProject(ctx: Ctx, id: string, today: DateStr): Promise<DomainEvent[]> {
  const p = await getProject(ctx, id, today);
  if (p.canceledAt) throw new DomainError('Projek ini sudah dibatalkan.');
  if (p.status === 'selesai') throw new DomainError('Projek yang sudah selesai tidak bisa dibatalkan.');
  const at = now();
  const sessionIds = p.sessions.map((s) => s.id);
  const canceledTaskIds = await cancelActiveTasksOf(ctx, sessionIds, at, today);
  await ctx.db.update(projects).set({ canceledAt: at }).where(eq(projects.id, id));
  return [
    { type: 'ProjekDibatalkan', projectId: id },
    ...canceledTaskIds.map((taskId) => ({ type: 'TaskDibatalkan' as const, taskId })),
  ];
}

/**
 * FR-04 / UC-03: selesaikan projek lebih cepat. Hanya untuk projek yang sedang
 * berjalan dan tanpa task aktif. Sesi yang belum mulai dibatalkan, sesi yang
 * sedang berjalan diakhiri hari ini.
 */
export async function completeProjectEarly(ctx: Ctx, id: string, today: DateStr): Promise<DomainEvent[]> {
  const p = await getProject(ctx, id, today);
  if (p.status !== 'berjalan')
    throw new DomainError('Hanya projek yang sedang berjalan yang bisa diselesaikan lebih cepat.');
  if (p.activeTaskCount > 0) {
    const blocking = await ctx.db
      .select({ name: tasks.name })
      .from(tasks)
      .innerJoin(sessions, eq(tasks.sessionId, sessions.id))
      .where(and(eq(sessions.projectId, id), isNull(tasks.doneAt), isNull(tasks.canceledAt)))
      .orderBy(asc(tasks.deadlineDate));
    throw new DomainError(
      `Masih ada ${blocking.length} task aktif. Selesaikan atau batalkan dulu.`,
      undefined,
      blocking.map((b) => b.name),
    );
  }
  const at = now();
  for (const s of liveSessions(p.sessions)) {
    if (s.startDate > today) await ctx.db.update(sessions).set({ canceledAt: at }).where(eq(sessions.id, s.id));
    else if (s.endDate > today) await ctx.db.update(sessions).set({ endDate: today }).where(eq(sessions.id, s.id));
  }
  await ctx.db.update(projects).set({ completedEarlyAt: at }).where(eq(projects.id, id));
  return [{ type: 'ProjekSelesai', projectId: id }];
}

async function cancelActiveTasksOf(ctx: Ctx, sessionIds: string[], at: Date, today: DateStr) {
  if (!sessionIds.length) return [];
  const active = await ctx.db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(inArray(tasks.sessionId, sessionIds), isNull(tasks.doneAt), isNull(tasks.canceledAt)));
  const ids = active.map((t) => t.id);
  if (ids.length) {
    await ctx.db.update(tasks).set({ canceledAt: at }).where(inArray(tasks.id, ids));
    await removeFromUpcomingTodos(ctx, ids, today);
  }
  return ids;
}

// ---------- Sesi ----------

async function getSession(ctx: Ctx, id: string) {
  const [s] = await ctx.db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
  if (!s) throw new DomainError('Sesi tidak ditemukan.');
  return s;
}

function assertNoOverlap(input: { startDate: DateStr; endDate: DateStr }, others: Session[]) {
  const clash = liveSessions(others).find((o) => overlaps(input, o));
  if (clash)
    throw new DomainError(
      `Tanggal bertabrakan dengan sesi "${clash.name}" (${fmtRange(clash.startDate, clash.endDate)}). Pilih tanggal lain.`,
      'startDate',
    );
}

export async function createSession(ctx: Ctx, projectId: string, raw: SessionInput, today: DateStr) {
  const input = sessionInputSchema.parse(raw);
  const p = await getProject(ctx, projectId, today);
  assertProjectEditable(p);
  assertNoOverlap(input, p.sessions);
  await assertCanReactivate(ctx, p, today);
  const [row] = await ctx.db
    .insert(sessions)
    .values({ ...input, projectId })
    .returning();
  return row;
}

/** FR-09: periode baru harus tetap memuat semua deadline task sesi ini. */
export async function updateSession(ctx: Ctx, id: string, raw: SessionInput, today: DateStr) {
  const input = sessionInputSchema.parse(raw);
  const s = await getSession(ctx, id);
  if (s.canceledAt) throw new DomainError('Sesi ini sudah dibatalkan dan tidak bisa diubah.');
  const p = await getProject(ctx, s.projectId, today);
  assertProjectEditable(p);
  assertNoOverlap(
    input,
    p.sessions.filter((o) => o.id !== id),
  );
  const outside = await ctx.db
    .select({ name: tasks.name, deadlineDate: tasks.deadlineDate })
    .from(tasks)
    .where(
      and(
        eq(tasks.sessionId, id),
        isNull(tasks.canceledAt),
        sql`(${tasks.deadlineDate} < ${input.startDate} or ${tasks.deadlineDate} > ${input.endDate})`,
      ),
    )
    .orderBy(asc(tasks.deadlineDate));
  if (outside.length)
    throw new DomainError(
      `${outside.length} task punya deadline di luar periode baru. Ubah deadline task itu dulu.`,
      'startDate',
      outside.map((t) => `${t.name} (${fmtDayMonth(t.deadlineDate)})`),
    );
  if (!holdsColor(p.status) && input.endDate >= today) await assertCanReactivate(ctx, p, today);
  const [row] = await ctx.db.update(sessions).set(input).where(eq(sessions.id, id)).returning();
  return row;
}

/**
 * FR-10: sesi tanpa task dihapus permanen. Sesi yang punya task dibatalkan,
 * beserta task aktifnya.
 */
export async function removeSession(
  ctx: Ctx,
  id: string,
  today: DateStr,
): Promise<{ result: 'dihapus' | 'dibatalkan'; events: DomainEvent[] }> {
  const s = await getSession(ctx, id);
  if (s.canceledAt) throw new DomainError('Sesi ini sudah dibatalkan.');
  const p = await getProject(ctx, s.projectId, today);
  assertProjectEditable(p);
  const [{ n }] = await ctx.db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(tasks)
    .where(eq(tasks.sessionId, id));
  if (n === 0) {
    await ctx.db.delete(sessions).where(eq(sessions.id, id));
    return { result: 'dihapus', events: [] };
  }
  const at = now();
  const canceled = await cancelActiveTasksOf(ctx, [id], at, today);
  await ctx.db.update(sessions).set({ canceledAt: at }).where(eq(sessions.id, id));
  return {
    result: 'dibatalkan',
    events: [
      { type: 'SesiDibatalkan', sessionId: id },
      ...canceled.map((taskId) => ({ type: 'TaskDibatalkan' as const, taskId })),
    ],
  };
}

/** Sesi yang masih bisa diberi task: tidak batal, projeknya belum batal/selesai lebih cepat. */
export async function sessionsForTaskForm(ctx: Ctx, today: DateStr) {
  const all = await listProjects(ctx, today);
  return all
    .filter((p) => !p.canceledAt && !p.completedEarlyAt)
    .map((p) => ({
      projectId: p.id,
      projectName: p.name,
      color: p.color,
      sessions: liveSessions(p.sessions).map((s) => ({
        id: s.id,
        name: s.name,
        startDate: s.startDate,
        endDate: s.endDate,
      })),
    }))
    .filter((p) => p.sessions.length);
}

export { assertCanReactivate, getSession };
