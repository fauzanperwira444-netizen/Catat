// Ekspor dan pemulihan data (FR-37, FR-38). Format JSON berversi.
import fs from 'node:fs';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Ctx } from '@/server/db';
import { dailyTodos, labels, progressLogs, projects, sessions, tasks, todoItems } from '@/server/schema';
import { backupDir, dataDir, EXPORT_FORMAT_VERSION } from '@/shared/config';
import { DomainError } from '@/shared/errors';
import { isDateStr, now } from '@/shared/time';

export type Stats = { projects: number; tasks: number; todoDays: number; progressLogs: number };

export async function dataStats(ctx: Ctx): Promise<Stats> {
  const count = async (t: typeof projects | typeof tasks | typeof dailyTodos | typeof progressLogs) =>
    (await ctx.db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(t))[0].n;
  return {
    projects: await count(projects),
    tasks: await count(tasks),
    todoDays: await count(dailyTodos),
    progressLogs: await count(progressLogs),
  };
}

export async function exportData(ctx: Ctx) {
  return {
    format: 'catat',
    version: EXPORT_FORMAT_VERSION,
    exportedAt: now().toISOString(),
    data: {
      projects: await ctx.db.select().from(projects),
      sessions: await ctx.db.select().from(sessions),
      labels: await ctx.db.select().from(labels),
      tasks: await ctx.db.select().from(tasks),
      dailyTodos: await ctx.db.select().from(dailyTodos),
      todoItems: await ctx.db.select().from(todoItems),
      progressLogs: await ctx.db.select().from(progressLogs),
    },
  };
}

// ---------- Validasi file ----------
const id = z.string().min(1);
const date = z.string().refine(isDateStr, 'tanggal tidak valid');
const ts = z.coerce.date();
const tsN = z.coerce.date().nullable();
const stamps = { createdAt: ts, updatedAt: ts };

const fileSchema = z.object({
  format: z.literal('catat'),
  version: z.number().int(),
  exportedAt: z.string(),
  data: z.object({
    projects: z.array(
      z.object({
        id,
        name: z.string().min(1),
        description: z.string(),
        team: z.array(z.string()),
        links: z.array(z.object({ name: z.string(), url: z.string() })),
        color: z.string(),
        completedEarlyAt: tsN,
        canceledAt: tsN,
        ...stamps,
      }),
    ),
    sessions: z.array(
      z.object({
        id,
        projectId: id,
        name: z.string().min(1),
        startDate: date,
        endDate: date,
        description: z.string(),
        goals: z.string(),
        canceledAt: tsN,
        ...stamps,
      }),
    ),
    labels: z.array(z.object({ id, name: z.string().min(1), ...stamps })),
    tasks: z.array(
      z.object({
        id,
        name: z.string().min(1),
        sessionId: id.nullable(),
        labelId: id.nullable(),
        deadlineDate: date,
        deadlineTime: z.string().nullable(),
        difficulty: z.number().int().min(1).max(5),
        progress: z.number().int().min(0).max(10),
        doneAt: tsN,
        canceledAt: tsN,
        ...stamps,
      }),
    ),
    dailyTodos: z.array(z.object({ id, date, lockedAt: tsN, autoLocked: z.boolean(), ...stamps })),
    todoItems: z.array(z.object({ id, todoId: id, taskId: id, order: z.number().int(), checked: z.boolean(), ...stamps })),
    progressLogs: z.array(
      z.object({
        id,
        taskId: id,
        date,
        before: z.number().int().min(0).max(10),
        after: z.number().int().min(0).max(10),
        description: z.string(),
        ...stamps,
      }),
    ),
  }),
});
export type ExportFile = z.output<typeof fileSchema>;

/** Baca dan periksa file ekspor sepenuhnya sebelum apa pun diubah. */
export function parseExport(text: string): ExportFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new DomainError('File ini bukan file ekspor Catat (bukan JSON yang valid).');
  }
  const head = z.object({ format: z.literal('catat'), version: z.number() }).safeParse(raw);
  if (!head.success) throw new DomainError('File ini bukan file ekspor Catat.');
  if (head.data.version > EXPORT_FORMAT_VERSION)
    throw new DomainError('File ini dibuat oleh versi Catat yang lebih baru. Perbarui Catat dulu.');
  const r = fileSchema.safeParse(raw);
  if (!r.success) {
    const i = r.error.issues[0];
    throw new DomainError(`File ekspor rusak atau tidak lengkap (${i.path.join('.')}: ${i.message}).`);
  }
  const d = r.data.data;
  // Periksa keterkaitan antardata.
  const has = (list: { id: string }[]) => new Set(list.map((x) => x.id));
  const P = has(d.projects);
  const S = has(d.sessions);
  const L = has(d.labels);
  const T = has(d.tasks);
  const D = has(d.dailyTodos);
  const broken =
    d.sessions.some((s) => !P.has(s.projectId)) ||
    d.tasks.some((t) => (t.sessionId ? !S.has(t.sessionId) : !t.labelId) || (t.labelId !== null && !L.has(t.labelId))) ||
    d.todoItems.some((i) => !D.has(i.todoId) || !T.has(i.taskId)) ||
    d.progressLogs.some((l) => !T.has(l.taskId));
  if (broken) throw new DomainError('File ekspor rusak: ada data yang saling merujuk tetapi hilang.');
  return r.data;
}

export function statsOf(f: ExportFile): Stats {
  return {
    projects: f.data.projects.length,
    tasks: f.data.tasks.length,
    todoDays: f.data.dailyTodos.length,
    progressLogs: f.data.progressLogs.length,
  };
}

/** Salinan database sebelum dipulihkan (NFR keamanan data). */
export async function backupDatabase(ctx: Ctx, reason: string) {
  fs.mkdirSync(backupDir(), { recursive: true });
  const stamp = now().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const file = path.join(backupDir(), `catat-${reason}-${stamp}.db`);
  await ctx.db.run(sql.raw(`VACUUM INTO '${file.replace(/'/g, "''")}'`));
  return file;
}

/** Ganti seluruh data dengan isi file. Dijalankan di dalam satu transaksi. */
export async function replaceAll(ctx: Ctx, f: ExportFile) {
  await ctx.db.delete(todoItems);
  await ctx.db.delete(progressLogs);
  await ctx.db.delete(dailyTodos);
  await ctx.db.delete(tasks);
  await ctx.db.delete(labels);
  await ctx.db.delete(sessions);
  await ctx.db.delete(projects);
  const d = f.data;
  const chunks = <T,>(xs: T[], n = 200) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
  for (const c of chunks(d.projects)) await ctx.db.insert(projects).values(c);
  for (const c of chunks(d.sessions)) await ctx.db.insert(sessions).values(c);
  for (const c of chunks(d.labels)) await ctx.db.insert(labels).values(c);
  for (const c of chunks(d.tasks)) await ctx.db.insert(tasks).values(c);
  for (const c of chunks(d.dailyTodos)) await ctx.db.insert(dailyTodos).values(c);
  for (const c of chunks(d.todoItems)) await ctx.db.insert(todoItems).values(c);
  for (const c of chunks(d.progressLogs)) await ctx.db.insert(progressLogs).values(c);
}

// ---------- Waktu ekspor terakhir (disimpan di folder data) ----------
const metaFile = () => path.join(dataDir(), 'meta.json');

export function readMeta(): { lastExportAt?: string } {
  try {
    return JSON.parse(fs.readFileSync(metaFile(), 'utf8'));
  } catch {
    return {};
  }
}

export function recordExport(at: Date) {
  try {
    fs.writeFileSync(metaFile(), JSON.stringify({ ...readMeta(), lastExportAt: at.toISOString() }, null, 2));
  } catch {
    /* tidak penting */
  }
}
