import Link from 'next/link';
import { STATUS_LABEL } from '@/modules/projects/rules';
import type { ProjectSummary } from '@/modules/projects/service';
import { fmtDayMonth, fmtRange } from '@/shared/time';
import { Sq } from './bits';

/** Ringkasan satu baris tentang posisi projek saat ini (FR-20). */
export function projectNowLine(p: ProjectSummary): { text: string; accent?: boolean } {
  if (p.status === 'belum_dijadwalkan') return { text: 'Tambah sesi pertama', accent: true };
  if (p.status === 'belum_mulai' && p.nextSession)
    return { text: `Sesi pertama mulai ${fmtDayMonth(p.nextSession.startDate)}` };
  if (p.currentSession)
    return { text: `${p.currentSession.name} · ${fmtRange(p.currentSession.startDate, p.currentSession.endDate)}` };
  if (p.status === 'berjalan' && p.nextSession)
    return { text: `Jeda · berikutnya ${p.nextSession.name}, mulai ${fmtDayMonth(p.nextSession.startDate)}` };
  if (p.status === 'melewati_jadwal') return { text: `${p.activeTaskCount} task aktif lewat jadwal` };
  return { text: p.range ? fmtRange(p.range.start, p.range.end) : '' };
}

export function ProjectCard({ p }: { p: ProjectSummary }) {
  const line = projectNowLine(p);
  return (
    <Link className="pcard" href={`/projek/${p.id}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>
        <Sq color={p.color} size={10} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
        <span
          className="small"
          style={{
            marginLeft: 'auto',
            fontWeight: 400,
            color: p.status === 'melewati_jadwal' ? 'var(--late)' : 'var(--text-2)',
            whiteSpace: 'nowrap',
          }}
        >
          {STATUS_LABEL[p.status]}
        </span>
      </div>
      <div className="small" style={{ color: line.accent ? 'var(--accent)' : 'var(--text-2)', paddingLeft: 18 }}>
        {line.text}
      </div>
    </Link>
  );
}
