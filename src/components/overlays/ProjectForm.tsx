'use client';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createProjectAction, updateProjectAction } from '@/app/actions';
import { COLOR_META, PROJECT_COLORS, type ProjectColor } from '@/shared/colors';
import { useAction, useOverlay } from '../client';
import { FormError, Overlay } from '../Dialog';

export type ProjectFormData = {
  mode: 'baru' | 'ubah';
  projectId?: string;
  /** warna → nama projek lain yang memakainya */
  colorsInUse: Record<string, string>;
  initial: {
    name: string;
    description: string;
    team: string[];
    links: { name: string; url: string }[];
    color: ProjectColor | '';
  };
};

export function ProjectForm({ data }: { data: ProjectFormData }) {
  const { close } = useOverlay();
  const router = useRouter();
  const { run, pending, error } = useAction();
  const [v, setV] = useState(data.initial);
  const f = error?.fields ?? {};
  const fe = (k: string) => f[k] ?? (error?.field === k ? error.error : undefined);
  const linkErr = Object.entries(f).find(([k]) => k.startsWith('links'))?.[1];
  const teamErr = Object.entries(f).find(([k]) => k.startsWith('team'))?.[1];

  const submit = () => {
    const input = {
      name: v.name,
      description: v.description,
      team: v.team.map((t) => t.trim()).filter(Boolean),
      links: v.links.filter((l) => l.name.trim() || l.url.trim()),
      color: v.color as ProjectColor,
    };
    if (data.mode === 'baru')
      run(
        () => createProjectAction(input),
        (r) => router.push(`/projek/${(r.data as { id: string }).id}`),
      );
    else run(() => updateProjectAction(data.projectId!, input), () => close());
  };

  return (
    <Overlay title={data.mode === 'baru' ? 'Projek baru' : 'Edit projek'} onClose={close} variant="form">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <div className="field">
          <label htmlFor="p-nama">Nama projek</label>
          <input
            id="p-nama"
            className="input"
            data-autofocus
            value={v.name}
            aria-invalid={!!fe('name')}
            onChange={(e) => setV({ ...v, name: e.target.value })}
          />
          {fe('name') && <div className="field-error">{fe('name')}</div>}
        </div>
        <div className="field">
          <label htmlFor="p-desk">Deskripsi singkat</label>
          <textarea
            id="p-desk"
            className="textarea"
            rows={2}
            value={v.description}
            onChange={(e) => setV({ ...v, description: e.target.value })}
          />
        </div>

        <div className="field">
          <span className="label">Tim</span>
          {v.team.map((t, i) => (
            <div className="repeat-row" key={i}>
              <label htmlFor={`p-t${i}`} className="sr-only">
                Anggota {i + 1}
              </label>
              <input
                id={`p-t${i}`}
                className="input"
                value={t}
                placeholder={`Anggota ${i + 1}`}
                onChange={(e) => setV({ ...v, team: v.team.map((x, j) => (j === i ? e.target.value : x)) })}
              />
              <button
                type="button"
                className="icon-btn"
                aria-label={`Hapus anggota ${i + 1}`}
                onClick={() => setV({ ...v, team: v.team.filter((_, j) => j !== i) })}
              >
                <X size={16} />
              </button>
            </div>
          ))}
          {teamErr && <div className="field-error">{teamErr}</div>}
          <button type="button" className="add" onClick={() => setV({ ...v, team: [...v.team, ''] })}>
            <Plus size={16} aria-hidden />
            Tambah anggota
          </button>
        </div>

        <div className="field">
          <span className="label">Tautan dokumen</span>
          {v.links.map((l, i) => (
            <div className="repeat-row" key={i}>
              <label htmlFor={`p-l${i}n`} className="sr-only">
                Nama tautan {i + 1}
              </label>
              <input
                id={`p-l${i}n`}
                className="input"
                style={{ flex: '0 0 32%' }}
                placeholder="Nama, mis. Proposal"
                value={l.name}
                onChange={(e) =>
                  setV({ ...v, links: v.links.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })
                }
              />
              <label htmlFor={`p-l${i}u`} className="sr-only">
                Alamat tautan {i + 1}
              </label>
              <input
                id={`p-l${i}u`}
                className="input"
                type="url"
                placeholder="https://…"
                value={l.url}
                onChange={(e) =>
                  setV({ ...v, links: v.links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })
                }
              />
              <button
                type="button"
                className="icon-btn"
                aria-label={`Hapus tautan ${l.name || i + 1}`}
                onClick={() => setV({ ...v, links: v.links.filter((_, j) => j !== i) })}
              >
                <X size={16} />
              </button>
            </div>
          ))}
          {linkErr && <div className="field-error">{linkErr}</div>}
          <button
            type="button"
            className="add"
            onClick={() => setV({ ...v, links: [...v.links, { name: '', url: '' }] })}
          >
            <Plus size={16} aria-hidden />
            Tambah tautan
          </button>
        </div>

        <div className="field">
          <span className="label" id="p-warna">
            Warna
          </span>
          <div className="swatches" role="radiogroup" aria-labelledby="p-warna">
            {PROJECT_COLORS.map((c) => {
              const holder = data.colorsInUse[c];
              const m = COLOR_META[c];
              return (
                <button
                  key={c}
                  type="button"
                  className="sw"
                  role="radio"
                  aria-checked={v.color === c}
                  aria-disabled={!!holder}
                  onClick={() => !holder && setV({ ...v, color: c })}
                >
                  <span className="c" style={{ background: m.mark }} />
                  <span className="n">{m.name}</span>
                  <span className="u">{holder ?? 'Tersedia'}</span>
                </button>
              );
            })}
          </div>
          {fe('color') ? (
            <div className="field-error">{fe('color')}</div>
          ) : (
            <span className="hint">Warna yang dipakai projek lain yang belum selesai tidak bisa dipilih.</span>
          )}
        </div>

        {data.mode === 'baru' && (
          <div className="hint">
            Projek baru berstatus &quot;belum dijadwalkan&quot; sampai sesi pertama ditambahkan di halaman detail projek.
          </div>
        )}
        {error && !error.fields && !error.field && <FormError error={error} />}
        <div className="form-actions">
          <button type="button" className="btn" onClick={close}>
            Batal
          </button>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {data.mode === 'baru' ? 'Buat projek' : 'Simpan projek'}
          </button>
        </div>
      </form>
    </Overlay>
  );
}
