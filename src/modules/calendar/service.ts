// Kalender dan riwayat (FR-33 … FR-35).
// Riwayat dibaca dari to-do, log progress, dan sesi. Nama task/label/projek
// selalu yang terbaru karena dirujuk lewat id.
import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm';
import type { Ctx } from '@/server/db';
import { dailyTodos, progressLogs, projects, sessions, tasks, todoItems } from '@/server/schema';
import { addDays, rangeDays, startOfWeek, type DateStr } from '@/shared/time';
import { visibleSessionRange } from '@/modules/projects/rules';
import { loadTaskViews, type TaskView } from '@/modules/tasks/views';

export type DayItem = {
  task: TaskView;
  checked: boolean;
  /** Perubahan progress pada hari itu, mis. { before: 2, after: 4 }. */
  delta: { before: number; after: number } | null;
  notes: string[];
};

export type CalendarDay = {
  date: DateStr;
  todo: { lockedAt: Date | null; autoLocked: boolean } | null;
  /** Item to-do, ditambah task yang punya log progress hari itu tetapi tidak ada di to-do. */
  items: DayItem[];
  checkedCount: number;
};

export type SessionBar = {
  sessionId: string;
  projectId: string;
  projectName: string;
  sessionName: string;
  color: string;
  startDate: DateStr;
  endDate: DateStr;
  canceled: boolean;
};

export async function sessionBars(ctx: Ctx, from: DateStr, to: DateStr): Promise<SessionBar[]> {
  const rows = await ctx.db
    .select({ s: sessions, p: projects })
    .from(sessions)
    .innerJoin(projects, eq(sessions.projectId, projects.id))
    .where(and(lte(sessions.startDate, to), gte(sessions.endDate, from)))
    .orderBy(asc(projects.createdAt), asc(sessions.startDate));
  const out: SessionBar[] = [];
  for (const { s, p } of rows) {
    const r = visibleSessionRange(s, p);
    if (!r || r.endDate < from || r.startDate > to) continue;
    out.push({
      sessionId: s.id,
      projectId: p.id,
      projectName: p.name,
      sessionName: s.name,
      color: p.color,
      startDate: r.startDate,
      endDate: r.endDate,
      canceled: !!(s.canceledAt || p.canceledAt),
    });
  }
  return out;
}

export async function calendarDays(ctx: Ctx, from: DateStr, to: DateStr, today: DateStr): Promise<CalendarDay[]> {
  const todos = await ctx.db
    .select()
    .from(dailyTodos)
    .where(and(gte(dailyTodos.date, from), lte(dailyTodos.date, to)));
  const items = todos.length
    ? await ctx.db
        .select()
        .from(todoItems)
        .where(
          inArray(
            todoItems.todoId,
            todos.map((t) => t.id),
          ),
        )
        .orderBy(asc(todoItems.order))
    : [];
  const logs = await ctx.db
    .select()
    .from(progressLogs)
    .where(and(gte(progressLogs.date, from), lte(progressLogs.date, to)))
    .orderBy(asc(progressLogs.createdAt));
  const taskIds = [...new Set([...items.map((i) => i.taskId), ...logs.map((l) => l.taskId)])];
  const views = taskIds.length ? await loadTaskViews(ctx, inArray(tasks.id, taskIds), today) : [];
  const byId = new Map(views.map((v) => [v.id, v]));

  return rangeDays(from, to).map((date) => {
    const todo = todos.find((t) => t.date === date) ?? null;
    const dayLogs = logs.filter((l) => l.date === date);
    const deltaOf = (taskId: string) => {
      const ls = dayLogs.filter((l) => l.taskId === taskId);
      return ls.length
        ? { delta: { before: ls[0].before, after: ls[ls.length - 1].after }, notes: ls.map((l) => l.description) }
        : { delta: null, notes: [] };
    };
    const dayItems: DayItem[] = todo
      ? items
          .filter((i) => i.todoId === todo.id && byId.has(i.taskId))
          .map((i) => ({ task: byId.get(i.taskId)!, checked: i.checked, ...deltaOf(i.taskId) }))
      : [];
    const inTodo = new Set(dayItems.map((i) => i.task.id));
    for (const taskId of new Set(dayLogs.map((l) => l.taskId)))
      if (!inTodo.has(taskId) && byId.has(taskId))
        dayItems.push({ task: byId.get(taskId)!, checked: false, ...deltaOf(taskId) });
    return {
      date,
      todo: todo ? { lockedAt: todo.lockedAt, autoLocked: todo.autoLocked } : null,
      items: dayItems,
      checkedCount: dayItems.filter((i) => i.checked).length,
    };
  });
}

/** Grid bulan: minggu Senin–Minggu yang mencakup seluruh bulan. */
export function monthGrid(monthStart: DateStr): { from: DateStr; to: DateStr; weeks: DateStr[][] } {
  const from = startOfWeek(monthStart);
  const [y, m] = monthStart.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const to = addDays(startOfWeek(lastDay), 6);
  const days = rangeDays(from, to);
  const weeks: DateStr[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return { from, to, weeks };
}

/** Susun garis sesi per minggu ke dalam lajur supaya tidak saling menimpa. */
export function laneBars(bars: SessionBar[], weekStart: DateStr) {
  const weekEnd = addDays(weekStart, 6);
  const inWeek = bars
    .filter((b) => b.startDate <= weekEnd && b.endDate >= weekStart)
    .map((b) => {
      const s = b.startDate < weekStart ? weekStart : b.startDate;
      const e = b.endDate > weekEnd ? weekEnd : b.endDate;
      const col = rangeDays(weekStart, s).length; // 1-based
      const span = rangeDays(s, e).length;
      return { ...b, col, span, continuesBefore: b.startDate < weekStart, continuesAfter: b.endDate > weekEnd };
    });
  // Satu lajur per projek bila muat; projek yang sama tidak pernah bertabrakan (FR-08).
  const lanes: (typeof inWeek)[] = [];
  const laneOfProject = new Map<string, number>();
  for (const b of inWeek) {
    let li = laneOfProject.get(b.projectId);
    if (li === undefined) {
      li = lanes.length;
      lanes.push([]);
      laneOfProject.set(b.projectId, li);
    }
    lanes[li].push(b);
  }
  return lanes;
}
