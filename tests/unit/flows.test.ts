import { beforeEach, describe, expect, it } from 'vitest';
import type { Ctx } from '@/server/db';
import {
  cancelProject,
  colorsInUse,
  completeProjectEarly,
  createProject,
  createSession,
  getProject,
  removeSession,
  updateSession,
} from '@/modules/projects/service';
import { cancelTask, createTask, getTaskDetail, updateTask } from '@/modules/tasks/service';
import { lateTasks, nextSevenDays } from '@/modules/tasks/views';
import {
  addToTodo,
  checkTodoItem,
  getTodo,
  lockTodo,
  prosesPergantianHari,
  updateProgress,
} from '@/modules/todos/service';
import { calendarDays } from '@/modules/calendar/service';
import { renameLabel } from '@/modules/labels/service';
import { DomainError } from '@/shared/errors';
import { freshDb, setNow } from '../helpers';

const TODAY = '2026-10-25';
let ctx: Ctx;

beforeEach(async () => {
  ctx = await freshDb();
});

async function projectWithSession(color: 'orange' | 'blue' = 'orange', name = 'SISA') {
  const p = await createProject(ctx, { name, color }, TODAY);
  const s = await createSession(ctx, p.id, { name: 'Prototype', startDate: '2026-10-17', endDate: '2026-11-02' }, TODAY);
  return { p, s };
}

const rejects = async (fn: () => Promise<unknown>, msg: RegExp) => {
  await expect(fn()).rejects.toThrow(DomainError);
  await expect(fn()).rejects.toThrow(msg);
};

describe('projek dan sesi', () => {
  it('FR-02: warna tidak boleh dipakai dua projek yang belum selesai', async () => {
    await projectWithSession('orange');
    await rejects(() => createProject(ctx, { name: 'Lain', color: 'orange' }, TODAY), /dipakai projek "SISA"/);
    await createProject(ctx, { name: 'Lain', color: 'blue' }, TODAY);
    expect([...(await colorsInUse(ctx, TODAY)).keys()].sort()).toEqual(['blue', 'orange']);
  });

  it('FR-08: sesi tidak boleh bertabrakan', async () => {
    const { p } = await projectWithSession();
    await rejects(
      () => createSession(ctx, p.id, { name: 'X', startDate: '2026-11-02', endDate: '2026-11-10' }, TODAY),
      /bertabrakan dengan sesi "Prototype"/,
    );
    await createSession(ctx, p.id, { name: 'Uji', startDate: '2026-11-03', endDate: '2026-11-10' }, TODAY);
  });

  it('FR-09: periode baru harus memuat deadline task', async () => {
    const { s } = await projectWithSession();
    await createTask(ctx, { name: 'Revisi BMC', kind: 'projek', sessionId: s.id, deadlineDate: '2026-10-30', difficulty: 3 }, TODAY);
    await rejects(
      () => updateSession(ctx, s.id, { name: 'Prototype', startDate: '2026-10-17', endDate: '2026-10-28' }, TODAY),
      /1 task punya deadline di luar periode baru/,
    );
  });

  it('FR-10: sesi kosong dihapus, sesi bertask dibatalkan beserta tasknya', async () => {
    const { p, s } = await projectWithSession();
    const s2 = await createSession(ctx, p.id, { name: 'Kosong', startDate: '2026-11-05', endDate: '2026-11-06' }, TODAY);
    expect((await removeSession(ctx, s2.id, TODAY)).result).toBe('dihapus');
    const t = await createTask(ctx, { name: 'A', kind: 'projek', sessionId: s.id, deadlineDate: '2026-10-30', difficulty: 3 }, TODAY);
    expect((await removeSession(ctx, s.id, TODAY)).result).toBe('dibatalkan');
    expect((await getTaskDetail(ctx, t.id, TODAY)).task.status).toBe('batal');
  });

  it('FR-04: selesai lebih cepat ditolak bila masih ada task aktif', async () => {
    const { p, s } = await projectWithSession();
    const future = await createSession(ctx, p.id, { name: 'Nanti', startDate: '2026-11-10', endDate: '2026-11-20' }, TODAY);
    const t = await createTask(ctx, { name: 'Revisi BMC', kind: 'projek', sessionId: s.id, deadlineDate: '2026-10-30', difficulty: 3 }, TODAY);
    try {
      await completeProjectEarly(ctx, p.id, TODAY);
      expect.fail('harus ditolak');
    } catch (e) {
      expect((e as DomainError).details).toEqual(['Revisi BMC']);
    }
    await cancelTask(ctx, t.id, TODAY);
    await completeProjectEarly(ctx, p.id, TODAY);
    const after = await getProject(ctx, p.id, TODAY);
    expect(after.status).toBe('selesai');
    expect(after.sessions.find((x) => x.id === s.id)?.endDate).toBe(TODAY);
    expect(after.sessions.find((x) => x.id === future.id)?.canceledAt).not.toBeNull();
    // warna lepas
    await createProject(ctx, { name: 'Baru', color: 'orange' }, TODAY);
  });

  it('FR-05: batal projek membatalkan task dan mengeluarkannya dari to-do mendatang', async () => {
    const { p, s } = await projectWithSession();
    const t = await createTask(ctx, { name: 'A', kind: 'projek', sessionId: s.id, deadlineDate: '2026-10-30', difficulty: 3 }, TODAY);
    await addToTodo(ctx, TODAY, [t.id], TODAY);
    await addToTodo(ctx, '2026-10-27', [t.id], TODAY);
    await cancelProject(ctx, p.id, TODAY);
    expect((await getTodo(ctx, TODAY, TODAY)).items).toHaveLength(0);
    expect((await getTodo(ctx, '2026-10-27', TODAY)).items).toHaveLength(0);
    expect((await getProject(ctx, p.id, TODAY)).status).toBe('batal');
  });
});

describe('task', () => {
  it('FR-11: deadline di dalam sesi; FR-12: task mandiri wajib label', async () => {
    const { s } = await projectWithSession();
    await rejects(
      () => createTask(ctx, { name: 'A', kind: 'projek', sessionId: s.id, deadlineDate: '2026-11-05', difficulty: 3 }, TODAY),
      /di dalam periode sesi "Prototype"/,
    );
    await expect(createTask(ctx, { name: 'A', kind: 'mandiri', deadlineDate: TODAY, difficulty: 3 }, TODAY)).rejects.toThrow(
      /wajib punya label/,
    );
  });

  it('label dipakai ulang tanpa peduli huruf besar-kecil dan bisa diganti nama', async () => {
    const a = await createTask(ctx, { name: 'A', kind: 'mandiri', labelName: 'Tugas kuliah', deadlineDate: TODAY, difficulty: 2 }, TODAY);
    const b = await createTask(ctx, { name: 'B', kind: 'mandiri', labelName: 'tugas KULIAH', deadlineDate: TODAY, difficulty: 2 }, TODAY);
    expect(a.labelId).toBe(b.labelId);
    await renameLabel(ctx, { id: a.labelId!, name: 'Kuliah' });
    expect((await getTaskDetail(ctx, b.id, TODAY)).task.labelName).toBe('Kuliah');
  });

  it('FR-21/22: daftar 7 hari dan task telat', async () => {
    await createTask(ctx, { name: 'Telat', kind: 'mandiri', labelName: 'L', deadlineDate: '2026-10-20', difficulty: 2 }, TODAY);
    await createTask(ctx, { name: 'Dekat', kind: 'mandiri', labelName: 'L', deadlineDate: '2026-11-01', difficulty: 2 }, TODAY);
    await createTask(ctx, { name: 'Jauh', kind: 'mandiri', labelName: 'L', deadlineDate: '2026-11-02', difficulty: 2 }, TODAY);
    expect((await lateTasks(ctx, TODAY)).map((t) => t.name)).toEqual(['Telat']);
    expect((await nextSevenDays(ctx, TODAY)).map((t) => t.name)).toEqual(['Dekat']);
  });

  it('FR-18: task batal tidak bisa diubah', async () => {
    const t = await createTask(ctx, { name: 'A', kind: 'mandiri', labelName: 'L', deadlineDate: TODAY, difficulty: 2 }, TODAY);
    await cancelTask(ctx, t.id, TODAY);
    await rejects(
      () => updateTask(ctx, t.id, { name: 'B', kind: 'mandiri', labelName: 'L', deadlineDate: TODAY, difficulty: 2 }, TODAY),
      /Hanya task aktif/,
    );
  });
});

describe('to-do dan progress', () => {
  async function twoTasks() {
    const a = await createTask(ctx, { name: 'A', kind: 'mandiri', labelName: 'L', deadlineDate: '2026-10-28', difficulty: 2 }, TODAY);
    const b = await createTask(ctx, { name: 'B', kind: 'mandiri', labelName: 'L', deadlineDate: '2026-10-28', difficulty: 4 }, TODAY);
    return { a, b };
  }

  it('FR-25: draf sampai 7 hari ke depan, tanpa duplikat', async () => {
    const { a } = await twoTasks();
    await addToTodo(ctx, '2026-11-01', [a.id], TODAY);
    await rejects(() => addToTodo(ctx, '2026-11-02', [a.id], TODAY), /sampai 7 hari/);
    await rejects(() => addToTodo(ctx, '2026-11-01', [a.id], TODAY), /sudah ada di to-do/);
    await rejects(() => addToTodo(ctx, '2026-10-24', [a.id], TODAY), /sudah lewat/);
  });

  it('FR-28/29/16: kunci, centang, progress hanya lewat to-do terkunci', async () => {
    const { a, b } = await twoTasks();
    await rejects(() => lockTodo(ctx, TODAY, TODAY), /masih kosong/);
    await addToTodo(ctx, TODAY, [a.id, b.id], TODAY);
    await rejects(() => checkTodoItem(ctx, a.id, true, TODAY), /Kunci to-do hari ini dulu/);
    await rejects(() => updateProgress(ctx, { taskId: a.id, after: 3, description: 'x' }, TODAY), /Kunci to-do/);
    await lockTodo(ctx, TODAY, TODAY);
    await rejects(() => lockTodo(ctx, TODAY, TODAY), /sudah dikunci/);
    await rejects(() => addToTodo(ctx, TODAY, [a.id], TODAY), /sudah dikunci/);
    await checkTodoItem(ctx, a.id, true, TODAY);
    await expect(updateProgress(ctx, { taskId: a.id, after: 3, description: '  ' }, TODAY)).rejects.toThrow(/Tulis apa/);
    await updateProgress(ctx, { taskId: a.id, after: 3, description: 'Bab 1' }, TODAY);
    const todo = await getTodo(ctx, TODAY, TODAY);
    expect(todo.state).toBe('terkunci');
    expect(todo.items).toHaveLength(2);
    expect(todo.items.find((i) => i.task.id === a.id)).toMatchObject({ checked: true, task: { progress: 3 } });
  });

  it('FR-16/17/31: progress 10 menyelesaikan task, menurunkan membuka kembali', async () => {
    const { a } = await twoTasks();
    await addToTodo(ctx, TODAY, [a.id], TODAY);
    await addToTodo(ctx, '2026-10-26', [a.id], TODAY);
    await lockTodo(ctx, TODAY, TODAY);
    const ev = await updateProgress(ctx, { taskId: a.id, after: 10, description: 'Selesai' }, TODAY);
    expect(ev.map((e) => e.type)).toEqual(['TaskSelesai']);
    expect((await getTodo(ctx, '2026-10-26', TODAY)).items).toHaveLength(0);
    expect((await getTodo(ctx, TODAY, TODAY)).items).toHaveLength(1); // terkunci tetap
    setNow('2026-10-25T09:00:00+07:00');
    const ev2 = await updateProgress(ctx, { taskId: a.id, after: 8, description: 'Ada revisi' }, TODAY);
    expect(ev2.map((e) => e.type)).toEqual(['TaskDibukaKembali']);
    const d = await getTaskDetail(ctx, a.id, TODAY);
    expect(d.task.status).toBe('aktif');
    expect(d.logs.map((l) => [l.before, l.after])).toEqual([
      [10, 8],
      [0, 10],
    ]);
  });

  it('FR-18: task batal setelah to-do dikunci tetap tampil bertanda batal', async () => {
    const { a } = await twoTasks();
    await addToTodo(ctx, TODAY, [a.id], TODAY);
    await lockTodo(ctx, TODAY, TODAY);
    await cancelTask(ctx, a.id, TODAY);
    const todo = await getTodo(ctx, TODAY, TODAY);
    expect(todo.items[0].task.status).toBe('batal');
  });

  it('FR-30: pergantian hari mengunci otomatis dan idempoten', async () => {
    const { a, b } = await twoTasks();
    await addToTodo(ctx, TODAY, [a.id], TODAY);
    await addToTodo(ctx, '2026-10-26', [b.id], TODAY);
    setNow('2026-10-27T06:00:00+07:00');
    const tomorrow2 = '2026-10-27';
    const ev = await prosesPergantianHari(ctx, tomorrow2);
    expect(ev.find((e) => e.type === 'HariBerganti')).toEqual({ type: 'HariBerganti', lockedDates: [TODAY, '2026-10-26'] });
    expect(await prosesPergantianHari(ctx, tomorrow2)).toEqual([]);
    const past = await getTodo(ctx, TODAY, tomorrow2);
    expect(past).toMatchObject({ state: 'lampau', autoLocked: true });
    await rejects(() => addToTodo(ctx, TODAY, [b.id], tomorrow2), /sudah lewat/);
  });

  it('FR-33: kalender memuat centang dan perubahan progress per hari', async () => {
    const { a, b } = await twoTasks();
    await addToTodo(ctx, TODAY, [a.id, b.id], TODAY);
    await lockTodo(ctx, TODAY, TODAY);
    await checkTodoItem(ctx, a.id, true, TODAY);
    await updateProgress(ctx, { taskId: a.id, after: 2, description: 'x' }, TODAY);
    await updateProgress(ctx, { taskId: a.id, after: 4, description: 'y' }, TODAY);
    const [day] = await calendarDays(ctx, TODAY, TODAY, TODAY);
    expect(day.checkedCount).toBe(1);
    expect(day.items.find((i) => i.task.id === a.id)).toMatchObject({ delta: { before: 0, after: 4 }, notes: ['x', 'y'] });
  });
});
