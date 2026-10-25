'use client';
import { AlertTriangle, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Stats } from '@/modules/data/service';
import { fmtShort, localParts } from '@/shared/time';
import { Confirm } from './Dialog';
import { useToast } from './client';

type Preview = { exportedAt: string; current: Stats; incoming: Stats };
const ROWS: [keyof Stats, string][] = [
  ['projects', 'Projek'],
  ['tasks', 'Task'],
  ['todoDays', 'Hari riwayat to-do'],
  ['progressLogs', 'Catatan progress'],
];

export function RestoreData() {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const toast = useToast();

  async function choose(f: File) {
    setError(null);
    const text = await f.text();
    const r = await fetch('/data/pulihkan?pratinjau=1', { method: 'POST', body: text });
    const j = await r.json();
    if (!j.ok) {
      setError(j.error);
      return;
    }
    setFile({ name: f.name, text });
    setPreview(j);
  }

  async function restore() {
    if (!file) return;
    setPending(true);
    const r = await fetch('/data/pulihkan', { method: 'POST', body: file.text });
    const j = await r.json();
    setPending(false);
    if (!j.ok) {
      setError(j.error);
      setPreview(null);
      return;
    }
    setPreview(null);
    setFile(null);
    toast('Data dipulihkan. Salinan data lama disimpan di folder cadangan.');
    router.refresh();
  }

  const exported = preview ? new Date(preview.exportedAt) : null;
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        aria-label="File ekspor"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) choose(f);
          e.target.value = '';
        }}
      />
      <button type="button" className="btn btn-danger" onClick={() => input.current?.click()}>
        <Upload size={16} aria-hidden />
        Pilih file ekspor
      </button>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {preview && file && exported && (
        <Confirm
          title="Ganti seluruh data dengan file ini?"
          danger
          pending={pending}
          confirmLabel={pending ? 'Memulihkan…' : 'Ganti data'}
          onCancel={() => {
            setPreview(null);
            setFile(null);
          }}
          onConfirm={restore}
          body={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                File <b style={{ fontWeight: 500 }}>{file.name}</b> diekspor pada {fmtShort(localParts(exported).date)}{' '}
                {exported.getFullYear()}. Perubahan sejak tanggal itu akan hilang. Salinan data saat ini disimpan otomatis di
                folder cadangan.
              </div>
              <div>
                <div className="cmp small muted">
                  <span />
                  <span>Saat ini</span>
                  <span>Dari file</span>
                </div>
                {ROWS.map(([k, l]) => (
                  <div className="cmp" key={k}>
                    <span>{l}</span>
                    <span>{preview.current[k]}</span>
                    <span>{preview.incoming[k]}</span>
                  </div>
                ))}
              </div>
              <div className="small" style={{ display: 'flex', gap: 6, color: 'var(--late)' }}>
                <AlertTriangle size={14} aria-hidden style={{ flex: 'none' }} />
                Tindakan ini mengganti seluruh data.
              </div>
            </div>
          }
        />
      )}
    </>
  );
}
