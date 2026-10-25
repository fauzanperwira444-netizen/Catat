import { and, eq, gt, inArray, isNull, or } from 'drizzle-orm';
import type { Ctx } from '@/server/db';
import { dailyTodos, todoItems } from '@/server/schema';
import type { DateStr } from '@/shared/time';

/**
 * FR-31: task yang selesai atau dibatalkan dikeluarkan dari to-do hari mendatang
 * dan dari to-do hari ini yang belum dikunci. To-do yang sudah dikunci tidak diubah.
 */
export async function removeFromUpcomingTodos(ctx: Ctx, taskIds: string[], today: DateStr) {
  if (!taskIds.length) return;
  const todoIds = (
    await ctx.db
      .select({ id: dailyTodos.id })
      .from(dailyTodos)
      .where(or(gt(dailyTodos.date, today), and(eq(dailyTodos.date, today), isNull(dailyTodos.lockedAt))))
  ).map((r) => r.id);
  if (!todoIds.length) return;
  await ctx.db
    .delete(todoItems)
    .where(and(inArray(todoItems.taskId, taskIds), inArray(todoItems.todoId, todoIds)));
}

export async function getTodoByDate(ctx: Ctx, date: DateStr) {
  const rows = await ctx.db.select().from(dailyTodos).where(eq(dailyTodos.date, date)).limit(1);
  return rows[0];
}

export async function ensureTodo(ctx: Ctx, date: DateStr) {
  const existing = await getTodoByDate(ctx, date);
  if (existing) return existing;
  const [row] = await ctx.db.insert(dailyTodos).values({ date }).returning();
  return row;
}
