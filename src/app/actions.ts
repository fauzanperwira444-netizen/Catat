'use server';
// Server Actions: lapisan tipis di atas use case domain.
import { runAction } from '@/server/action';
import {
  cancelProject,
  completeProjectEarly,
  createProject,
  createSession,
  removeSession,
  updateProject,
  updateSession,
  type ProjectInput,
  type SessionInput,
} from '@/modules/projects/service';
import { cancelTask, createTask, updateTask, type TaskInput } from '@/modules/tasks/service';
import { renameLabel } from '@/modules/labels/service';
import {
  addToTodo,
  checkTodoItem,
  lockTodo,
  removeFromTodo,
  reorderTodo,
  updateProgress,
  type ProgressInput,
} from '@/modules/todos/service';

// Projek
export async function createProjectAction(input: ProjectInput) {
  return runAction(async (ctx, today) => ({ data: { id: (await createProject(ctx, input, today)).id } }));
}
export async function updateProjectAction(id: string, input: ProjectInput) {
  return runAction(async (ctx, today) => {
    await updateProject(ctx, id, input, today);
  });
}
export async function cancelProjectAction(id: string) {
  return runAction(async (ctx, today) => ({ events: await cancelProject(ctx, id, today), message: 'Projek dibatalkan.' }));
}
export async function completeProjectEarlyAction(id: string) {
  return runAction(async (ctx, today) => ({
    events: await completeProjectEarly(ctx, id, today),
    message: 'Projek diselesaikan.',
  }));
}

// Sesi
export async function createSessionAction(projectId: string, input: SessionInput) {
  return runAction(async (ctx, today) => {
    await createSession(ctx, projectId, input, today);
  });
}
export async function updateSessionAction(id: string, input: SessionInput) {
  return runAction(async (ctx, today) => {
    await updateSession(ctx, id, input, today);
  });
}
export async function removeSessionAction(id: string) {
  return runAction(async (ctx, today) => {
    const r = await removeSession(ctx, id, today);
    return { events: r.events, message: r.result === 'dihapus' ? 'Sesi dihapus.' : 'Sesi dibatalkan.' };
  });
}

// Task
export async function createTaskAction(input: TaskInput) {
  return runAction(async (ctx, today) => ({ data: { id: (await createTask(ctx, input, today)).id }, message: 'Task dibuat.' }));
}
export async function updateTaskAction(id: string, input: TaskInput) {
  return runAction(async (ctx, today) => {
    await updateTask(ctx, id, input, today);
  });
}
export async function cancelTaskAction(id: string) {
  return runAction(async (ctx, today) => ({ events: await cancelTask(ctx, id, today), message: 'Task dibatalkan.' }));
}
export async function renameLabelAction(id: string, name: string) {
  return runAction(async (ctx) => {
    await renameLabel(ctx, { id, name });
  });
}

// To-do
export async function addToTodoAction(date: string, taskIds: string[]) {
  return runAction(async (ctx, today) => {
    await addToTodo(ctx, date, taskIds, today);
  });
}
export async function removeFromTodoAction(date: string, taskId: string) {
  return runAction(async (ctx, today) => {
    await removeFromTodo(ctx, date, taskId, today);
  });
}
export async function reorderTodoAction(date: string, taskIds: string[]) {
  return runAction(async (ctx, today) => {
    await reorderTodo(ctx, date, taskIds, today);
  });
}
export async function lockTodoAction(date: string) {
  return runAction(async (ctx, today) => ({ events: await lockTodo(ctx, date, today), message: 'To-do dikunci.' }));
}
export async function checkTodoItemAction(taskId: string, checked: boolean) {
  return runAction(async (ctx, today) => {
    await checkTodoItem(ctx, taskId, checked, today);
  });
}
export async function updateProgressAction(input: ProgressInput) {
  return runAction(async (ctx, today) => {
    const events = await updateProgress(ctx, input, today);
    return {
      events,
      message: events.some((e) => e.type === 'TaskSelesai')
        ? 'Task selesai.'
        : events.some((e) => e.type === 'TaskDibukaKembali')
          ? 'Task dibuka kembali.'
          : 'Progress disimpan.',
    };
  });
}
