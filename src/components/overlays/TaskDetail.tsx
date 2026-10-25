'use client';
import { Pencil } from 'lucide-react';
import { useState } from 'react';
import type { ProgressLog } from '@/server/schema';
import type { TaskView } from '@/modules/tasks/views';
import { addToTodoAction, cancelTaskAction, updateProgressAction } from '@/app/actions';
import { fmtDeadline, fmtRange, fmtShort, fmtTime } from '@/shared/time';
import { Difficulty, OriginTag } from '../bits';
import { useAction, useOverlay } from '../client';
import { Confirm, FormError, Overlay } from '../Dialog';

export type TaskDetailData = {
  task: TaskView;
  logs: ProgressLog[];
  today: string;
  /** Keadaan task terhadap to-do hari ini. */
  todayState: 'terkunci-ada' | 'terkunci-tidak-ada' | 'draf-ada' | 'draf-tidak-ada';
};

export function TaskDetail({ data }: { data: TaskDetailData }) {
  const { task, logs, today, todayState } = data;
  const { close, open } = useOverlay();
  const cancel = useAction();
  const add = useAction();
  const [confirm, setConfirm] = useState(false);
  const active = task.status === 'aktif';
  const statusText =
    task.status === 'batal' ? 'Batal' : task.status === 'selesai' ? 'Selesai' : task.late ? 'Telat' : 'Aktif';

  return (
    <Overlay title={task.name} eyebrow="Detail task" onClose={close}>
      <div className="props">
        <div className="prop">
          <span>Label</span>
          <span style={{ minWidth: 0 }}>
            <OriginTag task={task} />
          </span>
        </div>
        {task.sessionName && (
          <div className="prop">
            <span>Sesi</span>
            <span>
              {task.sessionName} · {fmtRange(task.sessionStart!, task.sessionEnd!)}
            </span>
          </div>
        )}
        <div className="prop">
          <span>Deadline</span>
          <span className={task.late ? 'late' : undefined}>
            {fmtDeadline(task.deadlineDate, null, today)} · {fmtShort(task.deadlineDate)}
            {task.deadlineTime && ` ${fmtTime(task.deadlineTime)}`}
          </span>
        </div>
        <div className="prop">
          <span>Kesulitan</span>
          <Difficulty value={task.difficulty} />
        </div>
        <div className="prop">
          <span>Status</span>
          <span className={statusText === 'Telat' ? 'late' : statusText === 'Selesai' ? 'done' : undefined}>
            {statusText}
          </span>
        </div>
        <div className="prop">
          <span>Progress</span>
          <span className="tabular">{task.progress} dari 10</span>
        </div>
      </div>

      {task.status !== 'batal' &&
        (todayState === 'terkunci-ada' ? (
          <ProgressForm key={`${task.id}-${task.progress}`} task={task} />
        ) : (
          <section className="overlay-section" aria-label="Perbarui progress">
            <h3 className="h3">Perbarui progress</h3>
            <div className="hint" style={{ fontSize: 14, lineHeight: '20px' }}>
              {todayState === 'draf-ada'
                ? 'Task ini ada di to-do hari ini. Kunci to-do dulu untuk mencatat progress.'
                : todayState === 'draf-tidak-ada'
                  ? 'Progress dicatat lewat to-do hari ini. Tambahkan task ini ke to-do, lalu kunci.'
                  : 'Progress hanya bisa dicatat untuk task di to-do hari ini. To-do hari ini sudah dikunci tanpa task ini.'}
            </div>
            {todayState === 'draf-tidak-ada' && (
              <div>
                <button
                  type="button"
                  className="btn"
                  disabled={add.pending}
                  onClick={() => add.run(() => addToTodoAction(today, [task.id]))}
                >
                  Tambah ke to-do hari ini
                </button>
              </div>
            )}
          </section>
        ))}

      <section className="overlay-section" aria-labelledby="hist-h" style={{ gap: 12 }}>
        <h3 className="h3" id="hist-h">
          Riwayat progress
        </h3>
        {logs.length === 0 && <div className="hint">Belum ada catatan progress.</div>}
        {logs.map((l) => (
          <div key={l.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div className="small muted tabular" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{fmtShort(l.date)}</span>
              <span>
                {l.before} → {l.after}
              </span>
            </div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{l.description}</div>
          </div>
        ))}
      </section>

      {active && (
        <div className="overlay-foot" style={{ marginTop: 'auto' }}>
          <button type="button" className="btn btn-ghost" onClick={() => open({ o: 'task-ubah', id: task.id })}>
            <Pencil size={16} aria-hidden />
            Edit task
          </button>
          <button type="button" className="btn btn-danger" onClick={() => setConfirm(true)}>
            Batalkan task
          </button>
        </div>
      )}
      {confirm && (
        <Confirm
          title={`Batalkan task "${task.name}"?`}
          body="Task keluar dari to-do mendatang. Riwayat progresnya tetap tersimpan. Pembatalan tidak bisa diurungkan."
          confirmLabel="Batalkan task"
          danger
          pending={cancel.pending}
          error={cancel.error}
          onCancel={() => setConfirm(false)}
          onConfirm={() => cancel.run(() => cancelTaskAction(task.id), () => setConfirm(false))}
        />
      )}
    </Overlay>
  );
}

function ProgressForm({ task }: { task: TaskView }) {
  const [value, setValue] = useState(task.progress);
  const [desc, setDesc] = useState('');
  const { run, pending, error, setError } = useAction();
  const changed = value !== task.progress;
  const descError = error?.fields?.description;
  return (
    <section className="overlay-section" aria-labelledby="upd-h">
      <h3 className="h3" id="upd-h">
        Perbarui progress
      </h3>
      <div className="small muted tabular">
        Sebelumnya {task.progress}
        {changed && ` · menjadi ${value}`}
        {value === 10 && changed && ' · task akan selesai'}
        {task.progress === 10 && changed && ' · task dibuka kembali'}
      </div>
      <label htmlFor="prog-slider" className="sr-only">
        Progress
      </label>
      <div style={{ position: 'relative', height: 20, margin: '0 7px' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 8, height: 4, borderRadius: 2, background: 'var(--gray-bg)' }} />
        <div
          style={{
            position: 'absolute',
            left: 0,
            width: `${value * 10}%`,
            top: 8,
            height: 4,
            borderRadius: 2,
            background: 'var(--accent)',
          }}
        />
        <div
          title="Nilai sebelumnya"
          style={{
            position: 'absolute',
            left: `${task.progress * 10}%`,
            top: 3,
            width: 2,
            height: 14,
            marginLeft: -1,
            background: 'var(--text-2)',
          }}
        />
        <input
          id="prog-slider"
          type="range"
          min={0}
          max={10}
          step={1}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          style={{ position: 'absolute', inset: 0, width: '100%', margin: 0, opacity: 0, cursor: 'pointer' }}
        />
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: `${value * 10}%`,
            top: 2,
            width: 16,
            height: 16,
            marginLeft: -8,
            borderRadius: '50%',
            background: '#fff',
            border: '1.5px solid var(--accent)',
            boxSizing: 'border-box',
            pointerEvents: 'none',
          }}
        />
      </div>
      <div aria-hidden className="small muted tabular" style={{ display: 'flex', justifyContent: 'space-between' }}>
        {Array.from({ length: 11 }, (_, i) => (
          <span key={i} style={i === value ? { color: 'var(--accent)', fontWeight: 500 } : undefined}>
            {i}
          </span>
        ))}
      </div>
      <label htmlFor="desc" className="small muted" style={{ marginTop: 4 }}>
        Deskripsi progress
      </label>
      <textarea
        id="desc"
        className="textarea"
        rows={3}
        value={desc}
        aria-invalid={!!descError}
        placeholder="Apa yang dikerjakan hari ini?"
        onChange={(e) => setDesc(e.target.value)}
      />
      {descError && <div className="field-error">{descError}</div>}
      {error && !error.fields && <FormError error={error} />}
      <div className="form-actions">
        <button
          type="button"
          className="btn"
          disabled={!changed && !desc}
          onClick={() => {
            setValue(task.progress);
            setDesc('');
            setError(null);
          }}
        >
          Batal
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!changed || pending}
          onClick={() =>
            run(() => updateProgressAction({ taskId: task.id, after: value, description: desc }), () => setDesc(''))
          }
        >
          Simpan
        </button>
      </div>
    </section>
  );
}
