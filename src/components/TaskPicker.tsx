'use client';
import { Check, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import type { TaskView } from '@/modules/tasks/views';
import { addToTodoAction } from '@/app/actions';
import { fmtDeadline } from '@/shared/time';
import { OriginTag } from './bits';
import { Drop } from './Drop';
import { useAction, useOverlay } from './client';

export function TaskPicker({
  date,
  dayName,
  active,
  done,
  inTodo,
  today,
  locked,
}: {
  date: string;
  dayName: string;
  active: TaskView[];
  done: TaskView[];
  inTodo: string[];
  today: string;
  locked: boolean;
}) {
  const [q, setQ] = useState('');
  const has = new Set(inTodo);
  const match = (t: TaskView) => {
    const s = q.trim().toLowerCase();
    return !s || t.name.toLowerCase().includes(s) || t.labelName.toLowerCase().includes(s);
  };
  const a = active.filter(match);
  const d = done.filter(match);
  return (
    <>
      <label htmlFor="cari" className="sr-only">
        Cari task
      </label>
      <div className="search">
        <Search size={14} aria-hidden />
        <input
          id="cari"
          type="search"
          className="input"
          placeholder="Cari task atau label"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="small muted">
        {locked ? 'To-do ini sudah dikunci, isinya tidak bisa diubah.' : 'Task aktif, urut deadline lalu kesulitan'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {a.length === 0 && <div className="hint">{q ? 'Tidak ada task yang cocok.' : 'Belum ada task aktif.'}</div>}
        {a.map((t) => (
          <PickRow key={t.id} t={t} date={date} dayName={dayName} today={today} added={has.has(t.id)} locked={locked} />
        ))}
      </div>
      <Drop id="todo-selesai" title="Task selesai" count={d.length}>
        <div className="hint" style={{ padding: '0 4px 4px' }}>
          Tambahkan ke to-do hari ini untuk membuka kembali, lalu turunkan progressnya.
        </div>
        {d.map((t) => (
          <PickRow key={t.id} t={t} date={date} dayName={dayName} today={today} added={has.has(t.id)} locked={locked} />
        ))}
      </Drop>
    </>
  );
}

function PickRow({
  t,
  date,
  dayName,
  today,
  added,
  locked,
}: {
  t: TaskView;
  date: string;
  dayName: string;
  today: string;
  added: boolean;
  locked: boolean;
}) {
  const { run, pending } = useAction();
  const { open } = useOverlay();
  return (
    <div className="pick">
      <div style={{ flex: 1, minWidth: 0 }}>
        <button
          type="button"
          className="t link-btn"
          style={{ color: added ? 'var(--text-2)' : 'var(--text)', display: 'block', maxWidth: '100%', textAlign: 'left' }}
          onClick={() => open({ o: 'task', id: t.id })}
        >
          {t.name}
        </button>
        <div className="m">
          <OriginTag task={t} />
          <span className={t.late ? 'late' : t.status === 'selesai' ? 'done' : undefined} style={{ whiteSpace: 'nowrap' }}>
            {t.status === 'selesai' ? 'Selesai' : fmtDeadline(t.deadlineDate, t.deadlineTime, today)}
          </span>
        </div>
      </div>
      {added ? (
        <span className="added">
          <Check size={14} aria-hidden />
          Sudah ada
        </span>
      ) : (
        !locked && (
          <button
            type="button"
            className="add-sm"
            disabled={pending}
            aria-label={`Tambah ${t.name} ke to-do ${dayName}`}
            onClick={() => run(() => addToTodoAction(date, [t.id]))}
          >
            <Plus size={14} aria-hidden />
            Tambah
          </button>
        )
      )}
    </div>
  );
}
