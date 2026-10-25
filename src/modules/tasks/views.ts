// Bentuk data task yang dipakai di semua tampilan: task + asal (projek/sesi atau label)
// + status yang dihitung saat dibaca.
import { and, asc, eq, gte, inArray, isNotNull, isNull, lt, lte, sql, type SQL } from 'drizzle-orm';
import type { Ctx } from '@/server/db';
import { labels, projects, sessions, tasks } from '@/server/schema';
import { sortTasks } from '@/shared/sort';
import { addDays, type DateStr } from '@/shared/time';

export type TaskStatus = 'aktif' | 'selesai' | 'batal';

export type TaskView = {
  id: string;
  name: string;
  deadlineDate: DateStr;
  deadlineTime: string | null;
  difficulty: number;
  progress: number;
  doneAt: Date | null;
  canceledAt: Date | null;
  status: TaskStatus;
  late: boolean;
  kind: 'projek' | 'mandiri';
  labelId: string | null;
  labelName: string;
  projectId: string | null;
  projectColor: string | null;
  sessionId: string | null;
  sessionName: string | null;
  sessionStart: DateStr | null;
  sessionEnd: DateStr | null;
};

export function taskStatus(t: { doneAt: Date | null; canceledAt: Date | null }): TaskStatus {
  if (t.canceledAt) return 'batal';
  if (t.doneAt) return 'selesai';
  return 'aktif';
}

/** Task telat: deadline sudah lewat (tanggal) dan belum selesai. */
export function isLate(t: { deadlineDate: DateStr; doneAt: Date | null; canceledAt: Date | null }, today: DateStr) {
  return taskStatus(t) === 'aktif' && t.deadlineDate < today;
}

const ACTIVE = and(isNull(tasks.doneAt), isNull(tasks.canceledAt));

export async function loadTaskViews(ctx: Ctx, where: SQL | undefined, today: DateStr): Promise<TaskView[]> {
  const rows = await ctx.db
    .select({
      t: tasks,
      labelName: labels.name,
      projectId: projects.id,
      projectName: projects.name,
      projectColor: projects.color,
      sessionName: sessions.name,
      sessionStart: sessions.startDate,
      sessionEnd: sessions.endDate,
    })
    .from(tasks)
    .leftJoin(labels, eq(tasks.labelId, labels.id))
    .leftJoin(sessions, eq(tasks.sessionId, sessions.id))
    .leftJoin(projects, eq(sessions.projectId, projects.id))
    .where(where)
    .orderBy(asc(tasks.deadlineDate));

  return sortTasks(
    rows.map(({ t, ...r }) => ({
      id: t.id,
      name: t.name,
      deadlineDate: t.deadlineDate,
      deadlineTime: t.deadlineTime,
      difficulty: t.difficulty,
      progress: t.progress,
      doneAt: t.doneAt,
      canceledAt: t.canceledAt,
      status: taskStatus(t),
      late: isLate(t, today),
      kind: t.sessionId ? ('projek' as const) : ('mandiri' as const),
      labelId: t.labelId,
      labelName: (t.sessionId ? r.projectName : r.labelName) ?? '',
      projectId: r.projectId ?? null,
      projectColor: r.projectColor ?? null,
      sessionId: t.sessionId,
      sessionName: r.sessionName ?? null,
      sessionStart: r.sessionStart ?? null,
      sessionEnd: r.sessionEnd ?? null,
    })),
  );
}

export async function getTaskView(ctx: Ctx, id: string, today: DateStr) {
  const [v] = await loadTaskViews(ctx, eq(tasks.id, id), today);
  return v;
}

/** FR-22: task telat, paling lama telat lalu paling sulit. */
export function lateTasks(ctx: Ctx, today: DateStr) {
  return loadTaskViews(ctx, and(ACTIVE, lt(tasks.deadlineDate, today)), today);
}

/** FR-21: task aktif dengan deadline hari ini sampai 7 hari ke depan. */
export function nextSevenDays(ctx: Ctx, today: DateStr) {
  return loadTaskViews(
    ctx,
    and(ACTIVE, gte(tasks.deadlineDate, today), lte(tasks.deadlineDate, addDays(today, 7))),
    today,
  );
}

export function activeTasks(ctx: Ctx, today: DateStr) {
  return loadTaskViews(ctx, ACTIVE, today);
}

export function doneTasks(ctx: Ctx, today: DateStr, search?: string) {
  const s = search?.trim();
  return loadTaskViews(
    ctx,
    and(isNotNull(tasks.doneAt), isNull(tasks.canceledAt), s ? sql`lower(${tasks.name}) like ${'%' + s.toLowerCase() + '%'}` : undefined),
    today,
  );
}

export type TaskFilter = {
  status?: 'aktif' | 'selesai' | 'batal' | 'semua';
  /** id projek, atau "label:<id>" untuk label task mandiri */
  origin?: string;
  sessionId?: string;
  search?: string;
};

/** FR-36: semua task dengan filter projek/label, sesi, dan status. */
export async function filteredTasks(ctx: Ctx, f: TaskFilter, today: DateStr) {
  const conds: (SQL | undefined)[] = [];
  const status = f.status ?? 'aktif';
  if (status === 'aktif') conds.push(ACTIVE);
  if (status === 'selesai') conds.push(and(isNotNull(tasks.doneAt), isNull(tasks.canceledAt)));
  if (status === 'batal') conds.push(isNotNull(tasks.canceledAt));
  if (f.origin?.startsWith('label:')) conds.push(eq(tasks.labelId, f.origin.slice(6)));
  else if (f.origin) {
    const sessionIds = (
      await ctx.db.select({ id: sessions.id }).from(sessions).where(eq(sessions.projectId, f.origin))
    ).map((r) => r.id);
    conds.push(sessionIds.length ? inArray(tasks.sessionId, sessionIds) : sql`0`);
  }
  if (f.sessionId) conds.push(eq(tasks.sessionId, f.sessionId));
  if (f.search?.trim()) conds.push(sql`lower(${tasks.name}) like ${'%' + f.search.trim().toLowerCase() + '%'}`);
  return loadTaskViews(ctx, and(...conds), today);
}

export async function taskCounts(ctx: Ctx) {
  const [r] = await ctx.db
    .select({
      aktif: sql<number>`sum(case when ${tasks.doneAt} is null and ${tasks.canceledAt} is null then 1 else 0 end)`.mapWith(Number),
      selesai: sql<number>`sum(case when ${tasks.doneAt} is not null and ${tasks.canceledAt} is null then 1 else 0 end)`.mapWith(Number),
      batal: sql<number>`sum(case when ${tasks.canceledAt} is not null then 1 else 0 end)`.mapWith(Number),
    })
    .from(tasks);
  return { aktif: r?.aktif ?? 0, selesai: r?.selesai ?? 0, batal: r?.batal ?? 0 };
}

