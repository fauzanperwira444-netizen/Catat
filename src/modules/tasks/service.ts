// Use case task (FR-11 … FR-18).
import { asc, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Ctx } from '@/server/db';
import { dailyTodos, progressLogs, tasks, todoItems } from '@/server/schema';
import { DomainError } from '@/shared/errors';
import type { DomainEvent } from '@/shared/events';
import { fmtRange, isDateStr, isTimeStr, now, type DateStr } from '@/shared/time';
import { findOrCreateLabel } from '@/modules/labels/service';
import { assertCanReactivate, assertProjectEditable, getProject, getSession } from '@/modules/projects/service';
import { removeFromUpcomingTodos } from '@/modules/todos/repo';
import { getTaskView, taskStatus } from './views';

export const taskInputSchema = z
  .object({
    name: z.string().trim().min(1, 'Isi nama task.').max(120, 'Nama task paling panjang 120 karakter.'),
    kind: z.enum(['projek', 'mandiri']),
    sessionId: z.string().optional().nullable(),
    labelName: z.string().trim().optional().nullable(),
    deadlineDate: z.string().refine(isDateStr, 'Isi tanggal deadline.'),
    deadlineTime: z
      .string()
      .optional()
      .nullable()
      .transform((v) => (v ? v : null))
      .refine((v) => v === null || isTimeStr(v), 'Jam tidak valid.'),
    difficulty: z.coerce
      .number({ invalid_type_error: 'Pilih tingkat kesulitan.' })
      .int()
      .min(1, 'Pilih tingkat kesulitan.')
      .max(5, 'Pilih tingkat kesulitan.'),
  })
  .superRefine((v, ctx) => {
    if (v.kind === 'projek' && !v.sessionId)
      ctx.addIssue({ code: 'custom', path: ['sessionId'], message: 'Pilih sesi projek.' });
    if (v.kind === 'mandiri' && !v.labelName?.trim())
      ctx.addIssue({ code: 'custom', path: ['labelName'], message: 'Task mandiri wajib punya label.' });
  });
export type TaskInput = z.input<typeof taskInputSchema>;

async function resolveOrigin(ctx: Ctx, input: z.output<typeof taskInputSchema>, today: DateStr) {
  if (input.kind === 'mandiri') {
    const label = await findOrCreateLabel(ctx, input.labelName!);
    return { sessionId: null, labelId: label.id };
  }
  const s = await getSession(ctx, input.sessionId!);
  if (s.canceledAt) throw new DomainError('Sesi ini sudah dibatalkan. Pilih sesi lain.', 'sessionId');
  const p = await getProject(ctx, s.projectId, today);
  assertProjectEditable(p);
  // FR-11: deadline harus di dalam periode sesi.
  if (input.deadlineDate < s.startDate || input.deadlineDate > s.endDate)
    throw new DomainError(
      `Deadline harus di dalam periode sesi "${s.name}" (${fmtRange(s.startDate, s.endDate)}).`,
      'deadlineDate',
    );
  await assertCanReactivate(ctx, p, today);
  return { sessionId: s.id, labelId: null };
}

export async function createTask(ctx: Ctx, raw: TaskInput, today: DateStr) {
  const input = taskInputSchema.parse(raw);
  const origin = await resolveOrigin(ctx, input, today);
  const [row] = await ctx.db
    .insert(tasks)
    .values({
      name: input.name,
      deadlineDate: input.deadlineDate,
      deadlineTime: input.deadlineTime,
      difficulty: input.difficulty,
      ...origin,
    })
    .returning();
  return row;
}

async function getTaskRow(ctx: Ctx, id: string) {
  const [t] = await ctx.db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  if (!t) throw new DomainError('Task tidak ditemukan.');
  return t;
}

/** FR-18: hanya task aktif yang bisa diubah. */
export async function updateTask(ctx: Ctx, id: string, raw: TaskInput, today: DateStr) {
  const input = taskInputSchema.parse(raw);
  const t = await getTaskRow(ctx, id);
  if (taskStatus(t) !== 'aktif') throw new DomainError('Hanya task aktif yang bisa diubah.');
  const origin = await resolveOrigin(ctx, input, today);
  const [row] = await ctx.db
    .update(tasks)
    .set({
      name: input.name,
      deadlineDate: input.deadlineDate,
      deadlineTime: input.deadlineTime,
      difficulty: input.difficulty,
      ...origin,
    })
    .where(eq(tasks.id, id))
    .returning();
  return row;
}

/**
 * FR-18: batalkan task aktif. Task dikeluarkan dari to-do mendatang (FR-31);
 * di to-do yang sudah dikunci task tetap tampil dengan tanda batal.
 */
export async function cancelTask(ctx: Ctx, id: string, today: DateStr): Promise<DomainEvent[]> {
  const t = await getTaskRow(ctx, id);
  if (taskStatus(t) !== 'aktif') throw new DomainError('Hanya task aktif yang bisa dibatalkan.');
  await ctx.db.update(tasks).set({ canceledAt: now() }).where(eq(tasks.id, id));
  await removeFromUpcomingTodos(ctx, [id], today);
  return [{ type: 'TaskDibatalkan', taskId: id }];
}

/** Detail task: data, riwayat progress, dan hari-hari task masuk to-do. */
export async function getTaskDetail(ctx: Ctx, id: string, today: DateStr) {
  const view = await getTaskView(ctx, id, today);
  if (!view) throw new DomainError('Task tidak ditemukan.');
  const logs = await ctx.db
    .select()
    .from(progressLogs)
    .where(eq(progressLogs.taskId, id))
    .orderBy(desc(progressLogs.date), desc(progressLogs.createdAt));
  const todos = await ctx.db
    .select({ date: dailyTodos.date, checked: todoItems.checked, lockedAt: dailyTodos.lockedAt })
    .from(todoItems)
    .innerJoin(dailyTodos, eq(todoItems.todoId, dailyTodos.id))
    .where(eq(todoItems.taskId, id))
    .orderBy(asc(dailyTodos.date));
  return { task: view, logs, todos };
}

export { getTaskRow };
