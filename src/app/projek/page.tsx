import Link from 'next/link';
import clsx from 'clsx';
import { OpenButton } from '@/components/buttons';
import { Sq } from '@/components/bits';
import { OverlayHost, type SP } from '@/components/overlays/OverlayHost';
import { StatusTag } from '@/components/projectBits';
import { holdsColor, type ProjectStatus } from '@/modules/projects/rules';
import { listProjects, type ProjectSummary } from '@/modules/projects/service';
import { pageCtx } from '@/server/page';
import { fmtDayMonth, fmtRange } from '@/shared/time';

export const metadata = { title: 'Projek' };

const GROUPS: { title: string; statuses: ProjectStatus[] }[] = [
  { title: 'Perlu perhatian', statuses: ['melewati_jadwal'] },
  { title: 'Berjalan', statuses: ['berjalan'] },
  { title: 'Belum mulai', statuses: ['belum_mulai', 'belum_dijadwalkan'] },
  { title: 'Selesai', statuses: ['selesai'] },
  { title: 'Batal', statuses: ['batal'] },
];

function sessionLine(p: ProjectSummary): { text: string; accent?: boolean } {
  if (p.status === 'belum_dijadwalkan') return { text: 'Tambah sesi pertama', accent: true };
  if (p.status === 'selesai' || p.status === 'batal') return { text: '—' };
  if (p.status === 'melewati_jadwal') return { text: 'Sesi terakhir sudah lewat' };
  if (p.currentSession) return { text: `${p.currentSession.name} · s.d. ${fmtDayMonth(p.currentSession.endDate)}` };
  if (p.nextSession) return { text: `${p.nextSession.name} · mulai ${fmtDayMonth(p.nextSession.startDate)}` };
  return { text: '—' };
}

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { ctx, today } = await pageCtx();
  const all = await listProjects(ctx, today);
  const filter = typeof sp.status === 'string' ? sp.status : 'semua';
  const counts = {
    aktif: all.filter((p) => holdsColor(p.status)).length,
    selesai: all.filter((p) => p.status === 'selesai').length,
    batal: all.filter((p) => p.status === 'batal').length,
    semua: all.length,
  };
  const visible = all.filter((p) =>
    filter === 'aktif' ? holdsColor(p.status) : filter === 'selesai' || filter === 'batal' ? p.status === filter : true,
  );
  const tabs = [
    ['aktif', 'Aktif'],
    ['selesai', 'Selesai'],
    ['batal', 'Batal'],
    ['semua', 'Semua'],
  ] as const;

  return (
    <>
      <main className="page" style={{ gap: 16 }}>
        <header className="page-head">
          <h1 className="title" style={{ margin: 0 }}>
            Projek
          </h1>
          <OpenButton params={{ o: 'projek-baru' }} plus>
            Projek
          </OpenButton>
        </header>
        <div className="seg" role="group" aria-label="Status projek" style={{ alignSelf: 'flex-start' }}>
          {tabs.map(([v, l]) => (
            <Link
              key={v}
              href={v === 'semua' ? '/projek' : `/projek?status=${v}`}
              aria-current={filter === v}
              style={{ gap: 6 }}
            >
              {l} <span style={{ color: filter === v ? '#fff' : 'var(--text-2)' }}>{counts[v]}</span>
            </Link>
          ))}
        </div>
        {all.length === 0 ? (
          <div className="empty">
            Belum ada projek. Buat projek untuk mulai menyusun sesi dan task jangka panjang.
            <OpenButton params={{ o: 'projek-baru' }} className="btn" plus>
              Buat projek
            </OpenButton>
          </div>
        ) : (
          <div className="rows">
            <div className="row proj head">
              <span>Projek</span>
              <span>Status</span>
              <span>Periode</span>
              <span>Sesi saat ini</span>
              <span>Task aktif</span>
            </div>
            {GROUPS.map((g) => {
              const ps = visible.filter((p) => g.statuses.includes(p.status));
              if (!ps.length) return null;
              return (
                <div key={g.title}>
                  <div className="grp">{g.title}</div>
                  {ps.map((p) => {
                    const line = sessionLine(p);
                    const dead = p.status === 'batal';
                    return (
                      <Link key={p.id} className={clsx('row proj')} href={`/projek/${p.id}`}>
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            fontWeight: dead ? 400 : 500,
                            color: dead ? 'var(--text-3)' : p.status === 'selesai' ? 'var(--text-2)' : undefined,
                            textDecoration: dead ? 'line-through' : undefined,
                            minWidth: 0,
                          }}
                        >
                          {dead ? <span className="sq" style={{ background: '#c9c9c5' }} /> : <Sq color={p.color} />}
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                        </span>
                        <span>
                          <StatusTag status={p.status} />
                        </span>
                        <span className="meta">{p.range ? fmtRange(p.range.start, p.range.end) : 'Belum ada sesi'}</span>
                        <span className="meta" style={line.accent ? { color: 'var(--accent)' } : undefined}>
                          {line.text}
                        </span>
                        <span className="meta" style={p.status === 'melewati_jadwal' ? { color: 'var(--late)' } : undefined}>
                          {p.activeTaskCount} task
                        </span>
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </main>
      <OverlayHost ctx={ctx} today={today} sp={sp} />
    </>
  );
}
