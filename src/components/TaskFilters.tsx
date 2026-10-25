'use client';
import { useOverlay } from './client';

export function TaskFilters({
  status,
  origin,
  sessionId,
  counts,
  origins,
  sessions,
}: {
  status: string;
  origin: string;
  sessionId: string;
  counts: { aktif: number; selesai: number; batal: number };
  origins: { value: string; label: string; group: 'projek' | 'label' }[];
  sessions: { id: string; name: string }[];
}) {
  const { setParams } = useOverlay();
  const opts = [
    ['aktif', 'Aktif', counts.aktif],
    ['selesai', 'Selesai', counts.selesai],
    ['batal', 'Batal', counts.batal],
    ['semua', 'Semua', null],
  ] as const;
  const isProject = origin && !origin.startsWith('label:');
  return (
    <div role="group" aria-label="Filter" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      <div className="seg" role="group" aria-label="Status">
        {opts.map(([v, l, n]) => (
          <button
            key={v}
            type="button"
            className={status === v ? 'on' : undefined}
            aria-pressed={status === v}
            onClick={() => setParams({ status: v === 'aktif' ? null : v })}
          >
            {l}
            {n !== null && <span className="n">{n}</span>}
          </button>
        ))}
      </div>
      <label htmlFor="f-proj" className="sr-only">
        Projek atau label
      </label>
      <select
        id="f-proj"
        className="sel"
        value={origin}
        onChange={(e) => setParams({ asal: e.target.value || null, sesi: null })}
      >
        <option value="">Semua projek dan label</option>
        <optgroup label="Projek">
          {origins
            .filter((o) => o.group === 'projek')
            .map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
        </optgroup>
        <optgroup label="Label task mandiri">
          {origins
            .filter((o) => o.group === 'label')
            .map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
        </optgroup>
      </select>
      <label htmlFor="f-sesi" className="sr-only">
        Sesi
      </label>
      <select
        id="f-sesi"
        className="sel"
        value={sessionId}
        disabled={!isProject}
        style={!isProject ? { color: 'var(--text-2)' } : undefined}
        onChange={(e) => setParams({ sesi: null, s: e.target.value || null })}
      >
        <option value="">{isProject ? 'Semua sesi' : 'Semua sesi · pilih projek dulu'}</option>
        {sessions.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </div>
  );
}
