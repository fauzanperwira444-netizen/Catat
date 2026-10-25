'use client';
import { AlertCircle, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { createTaskAction, updateTaskAction } from '@/app/actions';
import { fmtRange } from '@/shared/time';
import { ProjectTag } from '../bits';
import { useAction, useOverlay } from '../client';
import { FormError, Overlay } from '../Dialog';

export type SessionOption = { id: string; name: string; startDate: string; endDate: string };
export type ProjectOption = { projectId: string; projectName: string; color: string; sessions: SessionOption[] };

export type TaskFormData = {
  mode: 'baru' | 'ubah';
  taskId?: string;
  projects: ProjectOption[];
  labels: { id: string; name: string }[];
  /** Bila dibuka dari halaman projek: jenis projek terkunci ke projek ini. */
  lockedProjectId?: string;
  initial: {
    name: string;
    kind: 'projek' | 'mandiri';
    sessionId: string;
    labelName: string;
    deadlineDate: string;
    deadlineTime: string;
    difficulty: number | null;
  };
};

export function TaskForm({ data }: { data: TaskFormData }) {
  const { close, open } = useOverlay();
  const { run, pending, error } = useAction();
  const [v, setV] = useState(data.initial);
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((s) => ({ ...s, [k]: val }));
  const lockedProject = data.projects.find((p) => p.projectId === data.lockedProjectId);
  const sessions = useMemo(
    () => (lockedProject ? lockedProject.sessions : data.projects.flatMap((p) => p.sessions)),
    [lockedProject, data.projects],
  );
  const session = sessions.find((s) => s.id === v.sessionId);
  const f = error?.fields ?? {};
  const fieldErr = (k: string) => f[k] ?? (error?.field === k ? error.error : undefined);
  const generalError = error && !error.fields && !error.field ? error : null;

  const submit = () => {
    const input = {
      name: v.name,
      kind: v.kind,
      sessionId: v.kind === 'projek' ? v.sessionId : null,
      labelName: v.kind === 'mandiri' ? v.labelName : null,
      deadlineDate: v.deadlineDate,
      deadlineTime: v.deadlineTime || null,
      difficulty: v.difficulty ?? 0,
    };
    if (data.mode === 'baru') run(() => createTaskAction(input), () => close());
    else run(() => updateTaskAction(data.taskId!, input), () => open({ o: 'task', id: data.taskId! }));
  };

  return (
    <Overlay title={data.mode === 'baru' ? 'Tambah task' : 'Edit task'} onClose={close} variant="form">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        noValidate
      >
        {!lockedProject && (
          <div className="field">
            <span className="label" id="fm-jenis">
              Jenis task
            </span>
            <div className="seg" role="radiogroup" aria-labelledby="fm-jenis" style={{ alignSelf: 'flex-start' }}>
              {(['mandiri', 'projek'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={v.kind === k}
                  aria-pressed={v.kind === k}
                  disabled={k === 'projek' && data.projects.length === 0}
                  title={k === 'projek' && data.projects.length === 0 ? 'Belum ada projek dengan sesi' : undefined}
                  onClick={() => set('kind', k)}
                >
                  {k === 'mandiri' ? 'Mandiri' : 'Projek'}
                </button>
              ))}
            </div>
          </div>
        )}

        {v.kind === 'projek' ? (
          <div className="form-grid">
            {lockedProject && (
              <div className="field">
                <span className="label">Label</span>
                <span>
                  <ProjectTag name={lockedProject.projectName} color={lockedProject.color} />
                </span>
                <span className="hint">Otomatis dari projek</span>
              </div>
            )}
            <div className={lockedProject ? 'field' : 'field full'}>
              <label htmlFor="t-sesi">Sesi</label>
              <select
                id="t-sesi"
                className="select"
                value={v.sessionId}
                aria-invalid={!!fieldErr('sessionId')}
                onChange={(e) => set('sessionId', e.target.value)}
              >
                <option value="">Pilih sesi…</option>
                {lockedProject
                  ? lockedProject.sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} · {fmtRange(s.startDate, s.endDate)}
                      </option>
                    ))
                  : data.projects.map((p) => (
                      <optgroup key={p.projectId} label={p.projectName}>
                        {p.sessions.map((s) => (
                          <option key={s.id} value={s.id}>
                            {p.projectName} · {s.name} · {fmtRange(s.startDate, s.endDate)}
                          </option>
                        ))}
                      </optgroup>
                    ))}
              </select>
              {fieldErr('sessionId') && <div className="field-error">{fieldErr('sessionId')}</div>}
            </div>
          </div>
        ) : null}

        <div className="field">
          <label htmlFor="fm-nama">Nama task</label>
          <input
            id="fm-nama"
            className="input"
            value={v.name}
            data-autofocus
            aria-invalid={!!fieldErr('name')}
            onChange={(e) => set('name', e.target.value)}
          />
          {fieldErr('name') && <div className="field-error">{fieldErr('name')}</div>}
        </div>

        {v.kind === 'mandiri' && (
          <LabelCombo
            value={v.labelName}
            labels={data.labels}
            error={fieldErr('labelName')}
            onChange={(name) => set('labelName', name)}
          />
        )}

        <div className="form-grid">
          <div className="field">
            <label htmlFor="fm-tgl">Tanggal deadline</label>
            <input
              id="fm-tgl"
              className="input"
              type="date"
              value={v.deadlineDate}
              min={v.kind === 'projek' ? session?.startDate : undefined}
              max={v.kind === 'projek' ? session?.endDate : undefined}
              aria-invalid={!!fieldErr('deadlineDate')}
              onChange={(e) => set('deadlineDate', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="fm-jam">Jam (opsional)</label>
            <input
              id="fm-jam"
              className="input"
              type="time"
              value={v.deadlineTime}
              onChange={(e) => set('deadlineTime', e.target.value)}
            />
          </div>
        </div>
        {fieldErr('deadlineDate') ? (
          <div className="err-line" role="alert">
            <AlertCircle size={14} aria-hidden style={{ flex: 'none' }} />
            <span>{fieldErr('deadlineDate')}</span>
          </div>
        ) : (
          v.kind === 'projek' &&
          session && <div className="hint">Deadline harus di dalam periode sesi: {fmtRange(session.startDate, session.endDate)}.</div>
        )}

        <div className="field">
          <span className="label" id="fm-dif">
            Kesulitan (wajib)
          </span>
          <div className="seg" role="radiogroup" aria-labelledby="fm-dif" style={{ alignSelf: 'flex-start' }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={v.difficulty === n}
                aria-pressed={v.difficulty === n}
                style={{ minWidth: 44 }}
                onClick={() => set('difficulty', n)}
              >
                {n}
              </button>
            ))}
          </div>
          {fieldErr('difficulty') && <div className="field-error">{fieldErr('difficulty')}</div>}
        </div>

        {data.mode === 'baru' && <div className="hint">Progress task baru dimulai dari 0 dan diperbarui lewat to-do.</div>}
        {generalError && <FormError error={generalError} />}

        <div className="form-actions">
          <button type="button" className="btn" onClick={close}>
            Batal
          </button>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            Simpan task
          </button>
        </div>
      </form>
    </Overlay>
  );
}

function LabelCombo({
  value,
  labels,
  error,
  onChange,
}: {
  value: string;
  labels: { id: string; name: string }[];
  error?: string;
  onChange: (v: string) => void;
}) {
  const [openList, setOpenList] = useState(false);
  const q = value.trim().toLowerCase();
  const matches = labels.filter((l) => !q || l.name.toLowerCase().includes(q));
  const exact = labels.some((l) => l.name.toLowerCase() === q);
  return (
    <div className="field combo">
      <label htmlFor="fm-label">Label (wajib)</label>
      <input
        id="fm-label"
        className="input"
        role="combobox"
        aria-expanded={openList}
        aria-controls="fm-list"
        aria-autocomplete="list"
        autoComplete="off"
        value={value}
        aria-invalid={!!error}
        placeholder="Ketik atau pilih label"
        onFocus={() => setOpenList(true)}
        onBlur={() => setTimeout(() => setOpenList(false), 120)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpenList(true);
        }}
        onKeyDown={(e) => e.key === 'Escape' && openList && (e.stopPropagation(), setOpenList(false))}
      />
      {error && <div className="field-error">{error}</div>}
      {openList && (q || matches.length > 0) && (
        <div id="fm-list" role="listbox" className="combo-list">
          {q && !exact && (
            <div className="opt" role="option" aria-selected onMouseDown={() => setOpenList(false)}>
              <Plus size={16} aria-hidden />
              Buat label baru <span className="tag">{value.trim()}</span>
            </div>
          )}
          {matches.length > 0 && <div className="opt-group">Label yang ada</div>}
          {matches.map((l) => (
            <div
              key={l.id}
              className="opt"
              role="option"
              aria-selected={l.name.toLowerCase() === q}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(l.name);
                setOpenList(false);
              }}
            >
              <span className="tag">{l.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
