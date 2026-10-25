'use client';
import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { renameLabelAction } from '@/app/actions';
import { useAction } from './client';

export function LabelList({ labels }: { labels: { id: string; name: string; activeCount: number }[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <>
      {labels.length === 0 && <div className="hint" style={{ padding: 4 }}>Belum ada label.</div>}
      {labels.map((l) =>
        editing === l.id ? (
          <RenameBox key={l.id} id={l.id} name={l.name} onDone={() => setEditing(null)} />
        ) : (
          <div className="lrow" key={l.id}>
            <span className="tag">{l.name}</span>
            <span className="small muted">{l.activeCount} task aktif</span>
            <button
              type="button"
              className="icon-btn"
              style={{ marginLeft: 'auto' }}
              aria-label={`Ganti nama label ${l.name}`}
              onClick={() => setEditing(l.id)}
            >
              <Pencil size={14} />
            </button>
          </div>
        ),
      )}
      <div className="hint" style={{ padding: '8px 4px 0' }}>
        Label baru dibuat dari form task. Label task projek mengikuti nama projek.
      </div>
    </>
  );
}

function RenameBox({ id, name, onDone }: { id: string; name: string; onDone: () => void }) {
  const [v, setV] = useState(name);
  const { run, pending, error } = useAction();
  const err = error ? (error.fields?.name ?? error.error) : null;
  return (
    <form
      style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 8, borderRadius: 4, background: 'var(--sidebar)' }}
      onSubmit={(e) => {
        e.preventDefault();
        run(() => renameLabelAction(id, v), onDone);
      }}
    >
      <label htmlFor={`lbl-${id}`} className="small muted">
        Ganti nama label
      </label>
      <input
        id={`lbl-${id}`}
        className="input"
        value={v}
        autoFocus
        aria-invalid={!!err}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && onDone()}
      />
      {err ? (
        <div className="field-error">{err}</div>
      ) : (
        <div className="hint">Nama baru juga tampil di riwayat. Nama yang sudah dipakai label lain akan ditolak.</div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
        <button type="button" className="btn" style={{ fontSize: 12, padding: '0 10px' }} onClick={onDone}>
          Batal
        </button>
        <button type="submit" className="btn btn-primary" style={{ fontSize: 12, padding: '0 10px' }} disabled={pending}>
          Simpan
        </button>
      </div>
    </form>
  );
}
