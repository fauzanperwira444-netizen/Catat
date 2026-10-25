// To-do harian (FR-24 … FR-32) dan pembaruan progress (FR-16, FR-17).
import { and, asc, eq, inArray, isNull, lt, max, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Ctx } from '@/server/db';
import { dailyTodos, progressLogs, tasks, todoItems } from '@/server/schema';
import { DomainError } from '@/shared/errors';
import type { DomainEvent } from '@/shared/events';
import { addDays, fmtShort, isDateStr, now, type DateStr } from '@/shared/time';
import { loadTaskViews, taskStatus, type TaskView } from '@/modules/tasks/views';
import { ensureTodo, getTodoByDate, removeFromUpcomingTodos } from './repo';

/** FR-25: draf to-do bisa disusun untuk hari ini sampai 7 hari ke depan. */
export const PLAN_AHEAD_DAYS = 7;

export type TodoItemView = { itemId: string; order: number; checked: boolean; task: TaskView };
export type TodoView = {
  date: DateStr;
  exists: boolean;
  lockedAt: Date | null;
  autoLocked: boolean;
  /** 'draf' | 'terkunci' | 'lampau' — lampau = hari sudah lewat (tidak bisa diubah). */
  state: 'draf' | 'terkunci' | 'lampau';
  items: TodoItemView[];
};

export async function getTodo(ctx: Ctx, date: DateStr, today: DateStr): Promise<TodoView> {
  const todo = await getTodoByDate(ctx, date);
  const state = date < today ? 'lampau' : todo?.lockedAt ? 'terkunci' : 'draf';
  if (!todo) return { date, exists: false, lockedAt: null, autoLocked: false, state, items: [] };
  const items = await ctx.db
    .select()
    .from(todoItems)
    .where(eq(todoItems.todoId, todo.id))
    .orderBy(asc(todoItems.order));
  const views = items.length
    ? await loadTaskViews(
        ctx,
        inArray(
          tasks.id,
          items.map((i) => i.taskId),
        ),
        today,
      )
    : [];
  const byId = new Map(views.map((v) => [v.id, v]));
  return {
    date,
    exists: true,
    lockedAt: todo.lockedAt,
    autoLocked: todo.autoLocked,
    state,
    items: items
      .filter((i) => byId.has(i.taskId))
      .map((i) => ({ itemId: i.id, order: i.order, checked: i.checked, task: byId.get(i.taskId)! })),
  };
}

/** Ringkasan to-do beberapa hari ke depan (untuk pemilih tanggal). */
export async function upcomingTodoCounts(ctx: Ctx, today: DateStr) {
  const rows = await ctx.db
    .select({ date: dailyTodos.date, lockedAt: dailyTodos.lockedAt, n: sql<number>`count(${todoItems.id})`.mapWith(Number) })
    .from(dailyTodos)
    .leftJoin(todoItems, eq(todoItems.todoId, dailyTodos.id))
    .where(and(sql`${dailyTodos.date} >= ${today}`, sql`${dailyTodos.date} <= ${addDays(today, PLAN_AHEAD_DAYS)}`))
    .groupBy(dailyTodos.id);
  return new Map(rows.map((r) => [r.date, { count: r.n, locked: !!r.lockedAt }]));
}

function assertPlannable(date: DateStr, today: DateStr) {
  if (!isDateStr(date)) throw new DomainError('Tanggal tidak valid.');
  if (date < today) throw new DomainError('To-do hari yang sudah lewat tidak bisa diubah.');
  if (date > addDays(today, PLAN_AHEAD_DAYS))
    throw new DomainError(`To-do hanya bisa disusun sampai ${PLAN_AHEAD_DAYS} hari ke depan.`);
}

async function draftTodo(ctx: Ctx, date: DateStr, today: DateStr) {
  assertPlannable(date, today);
  const todo = await ensureTodo(ctx, date);
  if (todo.lockedAt) throw new DomainError('To-do ini sudah dikunci. Isinya tidak bisa diubah lagi.');
  return todo;
}

/** FR-25: tambah task ke draf to-do. Task selesai boleh ditambahkan (untuk dibuka kembali). */
export async function addToTodo(ctx: Ctx, date: DateStr, taskIds: string[], today: DateStr) {
  const todo = await draftTodo(ctx, date, today);
  if (!taskIds.length) return;
  const rows = await ctx.db.select().from(tasks).where(inArray(tasks.id, taskIds));
  if (rows.length !== new Set(taskIds).size) throw new DomainError('Task tidak ditemukan.');
  const canceled = rows.find((t) => taskStatus(t) === 'batal');
  if (canceled) throw new DomainError(`Task "${canceled.name}" sudah dibatalkan.`);
  const existing = await ctx.db
    .select({ taskId: todoItems.taskId })
    .from(todoItems)
    .where(eq(todoItems.todoId, todo.id));
  const have = new Set(existing.map((e) => e.taskId));
  const dup = rows.find((t) => have.has(t.id));
  if (dup) throw new DomainError(`Task "${dup.name}" sudah ada di to-do ${fmtShort(date)}.`);
  const [{ m }] = await ctx.db
    .select({ m: max(todoItems.order) })
    .from(todoItems)
    .where(eq(todoItems.todoId, todo.id));
  let order = (m ?? 0) + 1;
  const ordered = taskIds.filter((id, i) => taskIds.indexOf(id) === i);
  await ctx.db.insert(todoItems).values(ordered.map((taskId) => ({ todoId: todo.id, taskId, order: order++ })));
}

export async function removeFromTodo(ctx: Ctx, date: DateStr, taskId: string, today: DateStr) {
  const todo = await draftTodo(ctx, date, today);
  await ctx.db.delete(todoItems).where(and(eq(todoItems.todoId, todo.id), eq(todoItems.taskId, taskId)));
}

export async function reorderTodo(ctx: Ctx, date: DateStr, taskIds: string[], today: DateStr) {
  const todo = await draftTodo(ctx, date, today);
  for (const [i, taskId] of taskIds.entries())
    await ctx.db
      .update(todoItems)
      .set({ order: i + 1 })
      .where(and(eq(todoItems.todoId, todo.id), eq(todoItems.taskId, taskId)));
}

/** FR-28: kunci to-do hari ini. Sekali dikunci tidak bisa dibuka. To-do kosong tidak bisa dikunci. */
export async function lockTodo(ctx: Ctx, date: DateStr, today: DateStr): Promise<DomainEvent[]> {
  if (date !== today) throw new DomainError('Hanya to-do hari ini yang bisa dikunci.');
  const todo = await getTodoByDate(ctx, date);
  if (todo?.lockedAt) throw new DomainError('To-do hari ini sudah dikunci.');
  const [{ n }] = todo
    ? await ctx.db
        .select({ n: sql<number>`count(*)`.mapWith(Number) })
        .from(todoItems)
        .where(eq(todoItems.todoId, todo.id))
    : [{ n: 0 }];
  if (!todo || n === 0) throw new DomainError('To-do masih kosong. Tambahkan minimal satu task dulu.');
  await ctx.db.update(dailyTodos).set({ lockedAt: now(), autoLocked: false }).where(eq(dailyTodos.id, todo.id));
  return [{ type: 'TodoDikunci', date, auto: false }];
}

async function lockedTodayItem(ctx: Ctx, taskId: string, today: DateStr) {
  const todo = await getTodoByDate(ctx, today);
  if (!todo?.lockedAt)
    throw new DomainError('Kunci to-do hari ini dulu. Progress dan centang hanya bisa diubah dari to-do yang dikunci.');
  const [item] = await ctx.db
    .select()
    .from(todoItems)
    .where(and(eq(todoItems.todoId, todo.id), eq(todoItems.taskId, taskId)))
    .limit(1);
  if (!item) throw new DomainError('Task ini tidak ada di to-do hari ini.');
  return item;
}

/** FR-29: centang item hanya di to-do hari ini yang sudah dikunci. */
export async function checkTodoItem(ctx: Ctx, taskId: string, checked: boolean, today: DateStr) {
  const item = await lockedTodayItem(ctx, taskId, today);
  const [t] = await ctx.db.select().from(tasks).where(eq(tasks.id, taskId));
  if (t && taskStatus(t) === 'batal') throw new DomainError('Task ini sudah dibatalkan.');
  await ctx.db.update(todoItems).set({ checked }).where(eq(todoItems.id, item.id));
}

export const progressInputSchema = z.object({
  taskId: z.string().min(1),
  after: z.coerce.number().int().min(0, 'Progress 0 sampai 10.').max(10, 'Progress 0 sampai 10.'),
  description: z
    .string()
    .trim()
    .min(1, 'Tulis apa yang dikerjakan.')
    .max(1000, 'Keterangan paling panjang 1000 karakter.'),
});
export type ProgressInput = z.input<typeof progressInputSchema>;

/**
 * FR-16/17: ubah progress lewat to-do hari ini yang sudah dikunci, wajib dengan keterangan.
 * Progress 10 = task selesai dan keluar dari to-do mendatang. Menurunkan progress
 * task selesai membuka task kembali.
 */
export async function updateProgress(ctx: Ctx, raw: ProgressInput, today: DateStr): Promise<DomainEvent[]> {
  const input = progressInputSchema.parse(raw);
  await lockedTodayItem(ctx, input.taskId, today);
  const [t] = await ctx.db.select().from(tasks).where(eq(tasks.id, input.taskId));
  if (!t) throw new DomainError('Task tidak ditemukan.');
  if (taskStatus(t) === 'batal') throw new DomainError('Task ini sudah dibatalkan.');
  if (input.after === t.progress) throw new DomainError('Progress belum berubah.', 'after');

  await ctx.db.insert(progressLogs).values({
    taskId: t.id,
    date: today,
    before: t.progress,
    after: input.after,
    description: input.description,
  });
  const events: DomainEvent[] = [];
  const wasDone = !!t.doneAt;
  const isDone = input.after === 10;
  await ctx.db
    .update(tasks)
    .set({ progress: input.after, doneAt: isDone ? (t.doneAt ?? now()) : null })
    .where(eq(tasks.id, t.id));
  if (isDone && !wasDone) {
    await removeFromUpcomingTodos(ctx, [t.id], today);
    events.push({ type: 'TaskSelesai', taskId: t.id });
  }
  if (!isDone && wasDone) events.push({ type: 'TaskDibukaKembali', taskId: t.id });
  return events;
}

/**
 * FR-30: pergantian hari. To-do hari yang sudah lewat dan belum dikunci dikunci
 * otomatis; task di dalamnya yang belum dicentang tercatat tidak dikerjakan.
 * Aman dipanggil berkali-kali (idempoten).
 */
export async function prosesPergantianHari(ctx: Ctx, today: DateStr): Promise<DomainEvent[]> {
  const stale = await ctx.db
    .select({ id: dailyTodos.id, date: dailyTodos.date })
    .from(dailyTodos)
    .where(and(lt(dailyTodos.date, today), isNull(dailyTodos.lockedAt)));
  if (!stale.length) return [];
  await ctx.db
    .update(dailyTodos)
    .set({ lockedAt: now(), autoLocked: true })
    .where(
      inArray(
        dailyTodos.id,
        stale.map((s) => s.id),
      ),
    );
  const dates = stale.map((s) => s.date).sort();
  return [
    ...dates.map((date) => ({ type: 'TodoDikunci' as const, date, auto: true })),
    { type: 'HariBerganti', lockedDates: dates },
  ];
}
