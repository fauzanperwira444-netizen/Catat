'use client';
import * as M from '@radix-ui/react-dropdown-menu';
import { MoreHorizontal, X } from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';
import type { TaskView } from '@/modules/tasks/views';
import { cancelTaskAction, checkTodoItemAction, removeFromTodoAction } from '@/app/actions';
import { Deadline, Difficulty, OriginTag, Progress } from './bits';
import { useAction, useOverlay } from './client';
import { Confirm } from './Dialog';

export type Row = { task: TaskView; checked?: boolean };
type Mode = 'locked' | 'draft' | 'none' | 'plan' | 'all' | 'session';

export function TaskTable({
  rows,
  today,
  mode = 'none',
  todoDate,
  withDate,
  emptyText,
}: {
  rows: Row[];
  today: string;
  /** locked: ceklis aktif · draft: ceklis nonaktif · none: tanpa kolom ceklis · plan: tombol keluarkan */
  mode?: Mode;
  todoDate?: string;
  withDate?: boolean;
  emptyText?: string;
}) {
  const plain = mode === 'none' || mode === 'plan' || mode === 'all' || mode === 'session';
  if (!rows.length && emptyText) return <div className="empty">{emptyText}</div>;
  return (
    <div className="rows" role="table" aria-label="Daftar task">
      <div className={clsx('row head', mode !== 'locked' && mode !== 'draft' && (mode === 'none' ? 'plain' : mode))} role="row">
        {!plain && <span role="columnheader" aria-label="Ceklis" />}
        <span role="columnheader">Task</span>
        {mode !== 'session' && <span role="columnheader">Label</span>}
        {mode === 'all' && <span role="columnheader">Sesi</span>}
        <span role="columnheader">Deadline</span>
        <span role="columnheader">Sulit</span>
        <span role="columnheader">Progress</span>
        <span />
      </div>
      {rows.map((r) => (
        <TaskRow key={r.task.id} row={r} today={today} mode={mode} todoDate={todoDate} withDate={withDate} />
      ))}
    </div>
  );
}

function TaskRow({
  row,
  today,
  mode,
  todoDate,
  withDate,
}: {
  row: Row;
  today: string;
  mode: Mode;
  todoDate?: string;
  withDate?: boolean;
}) {
  const { task } = row;
  const { open } = useOverlay();
  const { run, pending } = useAction();
  const [checked, setChecked] = useState(!!row.checked);
  const canceled = task.status === 'batal';
  return (
    <div
      className={clsx('row', mode !== 'locked' && mode !== 'draft' && (mode === 'none' ? 'plain' : mode), canceled && 'canceled')}
      role="row"
    >
      {(mode === 'locked' || mode === 'draft') && (
        <input
          type="checkbox"
          className="cb"
          aria-label={`Ceklis ${task.name}`}
          checked={checked}
          disabled={mode === 'draft' || canceled || pending}
          title={mode === 'draft' ? 'Kunci to-do dulu untuk menceklis' : undefined}
          style={mode === 'draft' ? { opacity: 0.45 } : undefined}
          onChange={(e) => {
            const v = e.target.checked;
            setChecked(v);
            run(
              () => checkTodoItemAction(task.id, v),
              () => {},
            ).then((r) => !r.ok && setChecked(!v));
          }}
        />
      )}
      <button type="button" className="name" onClick={() => open({ o: 'task', id: task.id })}>
        {task.name}
      </button>
      {mode !== 'session' && (
        <span style={{ minWidth: 0 }}>
          <OriginTag task={task} />
        </span>
      )}
      {mode === 'all' && <span className="ses">{task.sessionName ?? '—'}</span>}
      <Deadline task={task} today={today} withDate={withDate} />
      <Difficulty value={task.difficulty} />
      <Progress value={task.progress} late={task.late} />
      {mode === 'plan' ? (
        <button
          type="button"
          className="rm"
          disabled={pending}
          aria-label={`Keluarkan ${task.name} dari to-do`}
          onClick={() => run(() => removeFromTodoAction(todoDate!, task.id))}
        >
          <X size={14} aria-hidden />
          Keluarkan
        </button>
      ) : (
        <TaskMenu task={task} todoDate={mode === 'draft' ? todoDate : undefined} />
      )}
    </div>
  );
}

export function TaskMenu({ task, todoDate }: { task: TaskView; todoDate?: string }) {
  const { open } = useOverlay();
  const { run, pending, error, setError } = useAction();
  const [confirm, setConfirm] = useState(false);
  const active = task.status === 'aktif';
  return (
    <>
      <M.Root>
        <M.Trigger className="more" aria-label={`Aksi lain untuk ${task.name}`}>
          <MoreHorizontal size={16} />
        </M.Trigger>
        <M.Portal>
          <M.Content className="menu" align="end" sideOffset={4}>
            <M.Item className="menu-item" onSelect={() => open({ o: 'task', id: task.id })}>
              Lihat detail
            </M.Item>
            <M.Item className="menu-item" disabled={!active} onSelect={() => open({ o: 'task-ubah', id: task.id })}>
              Edit task
            </M.Item>
            {todoDate && (
              <M.Item className="menu-item" onSelect={() => run(() => removeFromTodoAction(todoDate, task.id))}>
                Keluarkan dari to-do
              </M.Item>
            )}
            <M.Separator className="menu-sep" />
            <M.Item className="menu-item danger" disabled={!active} onSelect={() => setConfirm(true)}>
              Batalkan task
            </M.Item>
          </M.Content>
        </M.Portal>
      </M.Root>
      {confirm && (
        <Confirm
          title={`Batalkan task "${task.name}"?`}
          body="Task keluar dari to-do mendatang. Riwayat progresnya tetap tersimpan. Pembatalan tidak bisa diurungkan."
          confirmLabel="Batalkan task"
          danger
          pending={pending}
          error={error}
          onCancel={() => {
            setConfirm(false);
            setError(null);
          }}
          onConfirm={() => run(() => cancelTaskAction(task.id), () => setConfirm(false))}
        />
      )}
    </>
  );
}
