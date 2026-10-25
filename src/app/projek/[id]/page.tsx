import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, FileText } from 'lucide-react';
import { Drop } from '@/components/Drop';
import { OverlayHost, type SP } from '@/components/overlays/OverlayHost';
import { ProjectActions, SessionActions } from '@/components/ProjectActions';
import { SessionStatusTag, StatusTag } from '@/components/projectBits';
import { TaskTable } from '@/components/TaskTable';
import { liveSessions, sessionStatus } from '@/modules/projects/rules';
import { getProject } from '@/modules/projects/service';
import { filteredTasks } from '@/modules/tasks/views';
import { colorMeta } from '@/shared/colors';
import { DomainError } from '@/shared/errors';
import { pageCtx } from '@/server/page';
import { diffDays, fmtDayMonth, fmtRange } from '@/shared/time';

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { ctx, today } = await pageCtx();
  let p;
  try {
    p = await getProject(ctx, id, today);
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }
  const tasks = await filteredTasks(ctx, { status: 'semua', origin: id }, today);
  const c = colorMeta(p.color);
  const live = liveSessions(p.sessions);
  const closed = !!p.canceledAt || !!p.completedEarlyAt;
  const editable = !closed;
  const nonCanceledTasks = tasks.filter((t) => t.status !== 'batal');
  const doneCount = tasks.filter((t) => t.status === 'selesai').length;
  const year = p.range ? p.range.end.slice(0, 4) : '';

  // Timeline: sesi dan jeda proporsional terhadap jumlah hari.
  const segments: { kind: 'sesi' | 'jeda'; days: number; s?: (typeof live)[number] }[] = [];
  live.forEach((s, i) => {
    if (i > 0) {
      const gap = diffDays(live[i - 1].endDate, s.startDate) - 1;
      if (gap > 0) segments.push({ kind: 'jeda', days: gap });
    }
    segments.push({ kind: 'sesi', days: diffDays(s.startDate, s.endDate) + 1, s });
  });
  const total = p.range ? diffDays(p.range.start, p.range.end) + 1 : 0;
  const todayPos = p.range && today >= p.range.start && today <= p.range.end ? (diffDays(p.range.start, today) + 0.5) / total : null;

  const ordered = [...p.sessions].sort((a, b) => (a.startDate < b.startDate ? -1 : 1));

  return (
    <>
      <main className="page">
        <header style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="lbl">
            <Link href="/projek" style={{ color: 'var(--text-2)' }}>
              Projek
            </Link>{' '}
            / {p.name}
          </div>
          <div className="page-head" style={{ alignItems: 'center' }}>
            <h1 className="title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 16, height: 16, borderRadius: 3, background: p.canceledAt ? '#c9c9c5' : c.mark, flex: 'none' }} />
              {p.name}
            </h1>
            <ProjectActions
              id={p.id}
              name={p.name}
              canEdit={editable}
              canComplete={p.status === 'berjalan'}
              canCancel={editable && p.status !== 'selesai'}
            />
          </div>
          <div className="muted" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <StatusTag status={p.status} />
            {p.range && (
              <span className="tabular">
                {fmtRange(p.range.start, p.range.end)} {year}
              </span>
            )}
            <span>·</span>
            <span>{live.length} sesi</span>
            <span>·</span>
            <span>
              {nonCanceledTasks.length} task, {doneCount} selesai
            </span>
          </div>
        </header>

        <section className="section" aria-labelledby="tl-h" style={{ gap: 8 }}>
          <h2 className="h2" id="tl-h">
            Timeline sesi
          </h2>
          {live.length === 0 ? (
            <div className="empty">
              Projek ini belum dijadwalkan. Tambahkan sesi pertama untuk menentukan periodenya.
              {editable && (
                <Link className="btn btn-primary" href={`/projek/${p.id}?o=sesi-baru&projek=${p.id}`} scroll={false}>
                  Tambah sesi pertama
                </Link>
              )}
            </div>
          ) : (
            <div style={{ position: 'relative', paddingTop: 4 }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {segments.map((seg, i) =>
                  seg.kind === 'jeda' ? (
                    <div key={i} style={{ flex: `${seg.days} 1 0`, minWidth: 0 }} title={`Jeda ${seg.days} hari`} />
                  ) : (
                    <div
                      key={seg.s!.id}
                      title={`${seg.s!.name} · ${fmtRange(seg.s!.startDate, seg.s!.endDate)}`}
                      style={{
                        flex: `${seg.days} 1 0`,
                        minWidth: 0,
                        background: c.bg,
                        color: c.text,
                        borderRadius: 3,
                        padding: sessionStatus(seg.s!, today) === 'berjalan' ? '4px 6px' : '6px 8px',
                        border: sessionStatus(seg.s!, today) === 'berjalan' ? `2px solid ${c.mark}` : undefined,
                        fontWeight: sessionStatus(seg.s!, today) === 'berjalan' ? 500 : undefined,
                        fontSize: 12,
                        lineHeight: '16px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {seg.s!.name} ·{' '}
                      {sessionStatus(seg.s!, today) === 'belum_mulai'
                        ? `mulai ${fmtDayMonth(seg.s!.startDate)}`
                        : sessionStatus(seg.s!, today) === 'berjalan'
                          ? 'berjalan'
                          : 'selesai'}
                    </div>
                  ),
                )}
              </div>
              {todayPos !== null && (
                <div
                  aria-hidden
                  style={{ position: 'absolute', top: 0, height: 36, left: `${todayPos * 100}%`, width: 2, background: 'var(--accent)' }}
                />
              )}
              <div className="small muted tabular" style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', marginTop: 8, height: 16 }}>
                <span>{fmtDayMonth(p.range!.start)}</span>
                {todayPos !== null && (
                  <span
                    style={{
                      position: 'absolute',
                      left: `${Math.min(Math.max(todayPos * 100, 12), 88)}%`,
                      transform: 'translateX(-50%)',
                      color: 'var(--accent)',
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Hari ini, {fmtDayMonth(today)}
                  </span>
                )}
                <span>{fmtDayMonth(p.range!.end)}</span>
              </div>
            </div>
          )}
        </section>

        {ordered.length > 0 && (
          <section aria-labelledby="ses-h" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <h2 className="h2" id="ses-h" style={{ marginBottom: 4 }}>
              Sesi
            </h2>
            <div>
              {ordered.map((s) => {
                const st = sessionStatus(s, today);
                const sTasks = tasks.filter((t) => t.sessionId === s.id);
                const counted = sTasks.filter((t) => t.status !== 'batal');
                const done = counted.filter((t) => t.status === 'selesai').length;
                const active = counted.length - done;
                const countText =
                  counted.length === 0
                    ? 'Belum ada task'
                    : done === counted.length
                      ? `${counted.length} task, semuanya selesai`
                      : done
                        ? `${counted.length} task, ${done} selesai`
                        : `${counted.length} task`;
                return (
                  <details key={s.id} className="sess" open={st === 'berjalan' || st === 'belum_mulai' || undefined}>
                    <summary>
                      <ChevronRight size={16} className="chev" aria-hidden />
                      <span
                        style={{
                          fontSize: 16,
                          lineHeight: '24px',
                          fontWeight: 600,
                          textDecoration: st === 'batal' ? 'line-through' : undefined,
                          color: st === 'batal' ? 'var(--text-2)' : undefined,
                        }}
                      >
                        {s.name}
                      </span>
                      <span className="lbl tabular">{fmtRange(s.startDate, s.endDate)}</span>
                      <SessionStatusTag status={st} />
                      <span className="lbl" style={{ marginLeft: 'auto' }}>
                        {countText}
                      </span>
                    </summary>
                    <div className="sess-body">
                      {(s.description || s.goals) && (
                        <div className="form-grid" style={{ gap: 16 }}>
                          <div>
                            <div className="lbl">Deskripsi</div>
                            <div style={{ marginTop: 2, whiteSpace: 'pre-wrap' }}>{s.description || '—'}</div>
                          </div>
                          <div>
                            <div className="lbl">Goals</div>
                            <div style={{ marginTop: 2, whiteSpace: 'pre-wrap' }}>{s.goals || '—'}</div>
                          </div>
                        </div>
                      )}
                      <TaskTable
                        rows={sTasks.map((t) => ({ task: t }))}
                        today={today}
                        mode="session"
                        emptyText="Belum ada task di sesi ini."
                      />
                      {editable && st !== 'batal' && (
                        <SessionActions
                          projectId={p.id}
                          sessionId={s.id}
                          name={s.name}
                          hasTasks={sTasks.length > 0}
                          activeTaskCount={active}
                        />
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
          </section>
        )}
      </main>

      <aside className="aside" aria-label="Info projek">
        <Drop id="proj-tentang" title="Tentang projek">
          <div style={{ padding: '4px 4px 0', whiteSpace: 'pre-wrap' }} className={p.description ? undefined : 'muted'}>
            {p.description || 'Belum ada deskripsi.'}
          </div>
        </Drop>
        <Drop id="proj-tim" title="Tim" count={p.team.length}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 4px 0' }}>
            {p.team.length === 0 && <span className="muted">Belum ada anggota.</span>}
            {p.team.map((m, i) => (
              <span key={i}>{m}</span>
            ))}
          </div>
        </Drop>
        <Drop id="proj-tautan" title="Tautan dokumen" count={p.links.length}>
          {p.links.length === 0 && (
            <span className="muted" style={{ padding: '4px 4px 0' }}>
              Belum ada tautan.
            </span>
          )}
          {p.links.map((l, i) => (
            <a
              key={i}
              href={l.url}
              target="_blank"
              rel="noreferrer noopener"
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 4, borderRadius: 4 }}
            >
              <FileText size={16} aria-hidden style={{ flex: 'none' }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name || l.url}</span>
            </a>
          ))}
        </Drop>
        <Drop id="proj-warna" title="Warna">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 4px 0' }}>
            <span style={{ width: 14, height: 14, borderRadius: 3, background: c.mark }} />
            {c.name}
            {!['berjalan', 'belum_mulai', 'belum_dijadwalkan', 'melewati_jadwal'].includes(p.status) && (
              <span className="small muted">· sudah dilepas</span>
            )}
          </div>
        </Drop>
      </aside>
      <OverlayHost ctx={ctx} today={today} sp={sp} />
    </>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx, today } = await pageCtx();
  try {
    return { title: (await getProject(ctx, id, today)).name };
  } catch {
    return { title: 'Projek' };
  }
}
