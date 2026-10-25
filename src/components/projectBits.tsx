import { AlertCircle, Check, X } from 'lucide-react';
import { STATUS_LABEL, type ProjectStatus } from '@/modules/projects/rules';

export function StatusTag({ status }: { status: ProjectStatus }) {
  const label = STATUS_LABEL[status];
  switch (status) {
    case 'melewati_jadwal':
      return (
        <span className="tag" style={{ background: 'var(--late-bg)', color: 'var(--late)' }}>
          <AlertCircle size={12} aria-hidden />
          {label}
        </span>
      );
    case 'berjalan':
      return (
        <span className="tag" style={{ background: 'var(--accent-bg)', color: 'var(--accent-text)' }}>
          {label}
        </span>
      );
    case 'belum_dijadwalkan':
      return (
        <span className="tag" style={{ background: '#fff', boxShadow: 'inset 0 0 0 1px var(--border-strong)' }}>
          {label}
        </span>
      );
    case 'selesai':
      return (
        <span className="tag" style={{ background: 'var(--done-bg)', color: 'var(--done)' }}>
          <Check size={12} aria-hidden />
          {label}
        </span>
      );
    case 'batal':
      return (
        <span className="tag">
          <X size={12} aria-hidden />
          {label}
        </span>
      );
    default:
      return <span className="tag">{label}</span>;
  }
}

export function SessionStatusTag({ status }: { status: 'batal' | 'selesai' | 'berjalan' | 'belum_mulai' }) {
  if (status === 'selesai')
    return (
      <span className="tag" style={{ background: 'var(--done-bg)', color: 'var(--done)' }}>
        Selesai
      </span>
    );
  if (status === 'berjalan')
    return (
      <span className="tag" style={{ background: 'var(--accent-bg)', color: 'var(--accent-text)' }}>
        Berjalan
      </span>
    );
  if (status === 'batal') return <span className="tag">Batal</span>;
  return <span className="tag">Belum mulai</span>;
}
