'use client';
import { AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { createSessionAction, updateSessionAction } from '@/app/actions';
import { fmtRange } from '@/shared/time';
import { Sq } from '../bits';
import { useAction, useOverlay } from '../client';
import { FormError, Overlay } from '../Dialog';

export type SessionFormData = {
  mode: 'baru' | 'ubah';
  sessionId?: string;
  projectId: string;
  projectName: string;
  color: string;
  lastSession?: { name: string; startDate: string; endDate: string };
  initial: { name: string; startDate: string; endDate: string; description: string; goals: string };
};

export function SessionForm({ data }: { data: SessionFormData }) {
  const { close } = useOverlay();
  const { run, pending, error } = useAction();
  const [v, setV] = useState(data.initial);
  const f = error?.fields ?? {};
  const fe = (k: string) => f[k] ?? (error?.field === k ? error.error : undefined);
  const dateErr = fe('startDate') ?? fe('endDate');
  const dateErrDetails = error?.field === 'startDate' ? error.details : undefined;

  return (
    <Overlay title={data.mode === 'baru' ? 'Tambah sesi' : 'Edit sesi'} onClose={close} variant="form">
      <form
        noValidate
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (data.mode === 'baru') run(() => createSessionAction(data.projectId, v), () => close());
          else run(() => updateSessionAction(data.sessionId!, v), () => close());
        }}
      >
        <div className="small muted" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sq color={data.color} />
          Projek {data.projectName}
          {data.lastSession &&
            ` · sesi terakhir: ${data.lastSession.name}, ${fmtRange(data.lastSession.startDate, data.lastSession.endDate)}`}
        </div>
        <div className="field">
          <label htmlFor="s-nama">Nama sesi</label>
          <input
            id="s-nama"
            className="input"
            data-autofocus
            value={v.name}
            aria-invalid={!!fe('name')}
            onChange={(e) => setV({ ...v, name: e.target.value })}
          />
          {fe('name') && <div className="field-error">{fe('name')}</div>}
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="s-mulai">Tanggal mulai</label>
            <input
              id="s-mulai"
              className="input"
              type="date"
              value={v.startDate}
              aria-invalid={!!fe('startDate')}
              onChange={(e) => setV({ ...v, startDate: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="s-selesai">Tanggal selesai</label>
            <input
              id="s-selesai"
              className="input"
              type="date"
              value={v.endDate}
              min={v.startDate || undefined}
              aria-invalid={!!fe('endDate')}
              onChange={(e) => setV({ ...v, endDate: e.target.value })}
            />
          </div>
        </div>
        {dateErr && (
          <div className="err-line" role="alert">
            <AlertCircle size={14} aria-hidden style={{ flex: 'none' }} />
            <span>
              {dateErr}
              {dateErrDetails?.length ? (
                <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                  {dateErrDetails.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              ) : null}
            </span>
          </div>
        )}
        <div className="field">
          <label htmlFor="s-desk">Deskripsi</label>
          <textarea
            id="s-desk"
            className="textarea"
            rows={2}
            value={v.description}
            onChange={(e) => setV({ ...v, description: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="s-goal">Goals</label>
          <textarea
            id="s-goal"
            className="textarea"
            rows={2}
            value={v.goals}
            onChange={(e) => setV({ ...v, goals: e.target.value })}
          />
        </div>
        <div className="hint">Tautan dokumen sesi mengikuti tautan milik projek.</div>
        {error && !error.fields && !error.field && <FormError error={error} />}
        <div className="form-actions">
          <button type="button" className="btn" onClick={close}>
            Batal
          </button>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            Simpan sesi
          </button>
        </div>
      </form>
    </Overlay>
  );
}
