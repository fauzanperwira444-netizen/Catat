// Catat v0 — model data (Drizzle + SQLite/libSQL).
//
// Aturan penyimpanan:
// - Tanggal kalender disimpan sebagai teks YYYY-MM-DD dalam zona waktu Catat.
// - Waktu kejadian disimpan sebagai timestamp (milidetik, UTC).
// - Projek, sesi bertask, dan task tidak pernah dihapus: pembatalan ditandai canceledAt.
// - Semua tabel memakai ID UUID serta createdAt/updatedAt, sebagai persiapan sinkronisasi.
import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { now } from '@/shared/time';

const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$defaultFn(() => now()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$defaultFn(() => now())
    .$onUpdateFn(() => now()),
};

export const projects = sqliteTable('projects', {
  id: id(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  /** JSON: string[] */
  team: text('team', { mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`),
  /** JSON: { name, url }[] */
  links: text('links', { mode: 'json' })
    .$type<{ name: string; url: string }[]>()
    .notNull()
    .default(sql`'[]'`),
  color: text('color').notNull(),
  completedEarlyAt: integer('completed_early_at', { mode: 'timestamp_ms' }),
  canceledAt: integer('canceled_at', { mode: 'timestamp_ms' }),
  ...timestamps,
});

export const sessions = sqliteTable(
  'sessions',
  {
    id: id(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    name: text('name').notNull(),
    startDate: text('start_date').notNull(),
    endDate: text('end_date').notNull(),
    description: text('description').notNull().default(''),
    goals: text('goals').notNull().default(''),
    canceledAt: integer('canceled_at', { mode: 'timestamp_ms' }),
    ...timestamps,
  },
  (t) => [index('sessions_project_idx').on(t.projectId), index('sessions_range_idx').on(t.startDate, t.endDate)],
);

export const labels = sqliteTable('labels', {
  id: id(),
  name: text('name').notNull().unique(),
  ...timestamps,
});

export const tasks = sqliteTable(
  'tasks',
  {
    id: id(),
    name: text('name').notNull(),
    sessionId: text('session_id').references(() => sessions.id),
    labelId: text('label_id').references(() => labels.id),
    deadlineDate: text('deadline_date').notNull(),
    /** HH:mm, null berarti tanpa jam (diperlakukan 23.59 dalam urutan). */
    deadlineTime: text('deadline_time'),
    difficulty: integer('difficulty').notNull(),
    progress: integer('progress').notNull().default(0),
    doneAt: integer('done_at', { mode: 'timestamp_ms' }),
    canceledAt: integer('canceled_at', { mode: 'timestamp_ms' }),
    ...timestamps,
  },
  (t) => [
    index('tasks_deadline_idx').on(t.deadlineDate),
    index('tasks_session_idx').on(t.sessionId),
    index('tasks_label_idx').on(t.labelId),
    index('tasks_status_idx').on(t.doneAt, t.canceledAt),
  ],
);

export const dailyTodos = sqliteTable('daily_todos', {
  id: id(),
  date: text('date').notNull().unique(),
  lockedAt: integer('locked_at', { mode: 'timestamp_ms' }),
  autoLocked: integer('auto_locked', { mode: 'boolean' }).notNull().default(false),
  ...timestamps,
});

export const todoItems = sqliteTable(
  'todo_items',
  {
    id: id(),
    todoId: text('todo_id')
      .notNull()
      .references(() => dailyTodos.id),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id),
    order: integer('order').notNull(),
    checked: integer('checked', { mode: 'boolean' }).notNull().default(false),
    ...timestamps,
  },
  (t) => [uniqueIndex('todo_items_unique').on(t.todoId, t.taskId), index('todo_items_task_idx').on(t.taskId)],
);

/** Riwayat progress. Tidak pernah diubah atau dihapus. */
export const progressLogs = sqliteTable(
  'progress_logs',
  {
    id: id(),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id),
    date: text('date').notNull(),
    before: integer('before').notNull(),
    after: integer('after').notNull(),
    description: text('description').notNull(),
    ...timestamps,
  },
  (t) => [index('progress_logs_task_idx').on(t.taskId), index('progress_logs_date_idx').on(t.date)],
);

export type Project = typeof projects.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Label = typeof labels.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type DailyTodo = typeof dailyTodos.$inferSelect;
export type TodoItem = typeof todoItems.$inferSelect;
export type ProgressLog = typeof progressLogs.$inferSelect;
