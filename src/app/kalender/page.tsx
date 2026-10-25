import Link from 'next/link';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { Sq } from '@/components/bits';
import { OverlayHost, type SP } from '@/components/overlays/OverlayHost';
import { daySummary } from '@/components/WeekStrip';
import { calendarDays, laneBars, monthGrid, sessionBars, type CalendarDay, type SessionBar } from '@/modules/calendar/service';
import { colorMeta } from '@/shared/colors';
import { pageCtx } from '@/server/page';
import {
  addDays,
  addMonths,
  DAY_SHORT,
  fmtMonth,
  isDateStr,
  MONTH_LONG,
  MONTH_SHORT,
  startOfMonth,
  startOfWeek,
  weekdayIndex,
} from '@/shared/time';

export const metadata = { title: 'Kalender' };

function Bars({ bars, weekStart, gap = 4 }: { bars: SessionBar[]; weekStart: string; gap?: number }) {
  return (
    <>
      {laneBars(bars, weekStart).map((lane, i) => (
        <div key={i} className="g7" style={{ gap }}>
          {lane.map((b) => {
            const c = colorMeta(b.color);
            return (
              <div
                key={b.sessionId}
                className={clsx('sbar', b.continuesBefore && 'cont-before', b.continuesAfter && 'cont-after')}
                style={{ gridColumn: `${b.col} / span ${b.span}`, background: c.bg, color: c.text }}
                title={`${b.projectName} · ${b.sessionName}${b.canceled ? ' (batal)' : ''}`}
              >
                <Sq color={b.color} />
                {b.projectName} · {b.sessionName}
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { ctx, today } = await pageCtx();
  const view = sp.v === 'minggu' ? 'minggu' : 'bulan';
  const anchor = typeof sp.d === 'string' && isDateStr(sp.d) ? sp.d : today;
  const href = (v: string, d: string) => `/kalender?v=${v}&d=${d}`;
  const dayHref = (d: string) => `${href(view, anchor)}&o=hari&hari=${d}`;

  let title: string;
  let prev: string;
  let next: string;
  let body: React.ReactNode;

  if (view === 'bulan') {
    const ms = startOfMonth(anchor);
    const grid = monthGrid(ms);
    const [days, bars] = await Promise.all([
      calendarDays(ctx, grid.from, grid.to, today),
      sessionBars(ctx, grid.from, grid.to),
    ]);
    const byDate = new Map(days.map((d) => [d.date, d]));
    title = fmtMonth(ms);
    prev = href('bulan', addMonths(ms, -1));
    next = href('bulan', addMonths(ms, 1));
    body = (
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 720 }}>
          <div className="g7 small muted" style={{ paddingBottom: 6, borderBottom: '1px solid var(--divider)' }}>
            {DAY_SHORT.map((d) => (
              <span key={d} style={{ padding: '0 6px' }}>
                {d}
              </span>
            ))}
          </div>
          {grid.weeks.map((w) => (
            <div
              key={w[0]}
              style={{
                borderBottom: '1px solid var(--divider)',
                padding: '6px 0 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                minHeight: 104,
                boxSizing: 'border-box',
              }}
            >
              <div className="g7">
                {w.map((d) => {
                  const inMonth = d.slice(0, 7) === ms.slice(0, 7);
                  const isToday = d === today;
                  const n = Number(d.slice(8));
                  return (
                    <Link
                      key={d}
                      className="dcell"
                      href={dayHref(d)}
                      scroll={false}
                      aria-label={`${n} ${MONTH_LONG[Number(d.slice(5, 7)) - 1]}${isToday ? ', hari ini' : ''}`}
                      style={isToday ? { background: 'var(--accent-bg)' } : undefined}
                    >
                      <span
                        className="dnum"
                        style={{
                          color: isToday ? 'var(--accent)' : inMonth ? 'var(--text)' : 'var(--text-3)',
                          fontWeight: isToday ? 600 : 400,
                        }}
                      >
                        {n === 1 && !inMonth ? `1 ${MONTH_SHORT[Number(d.slice(5, 7)) - 1]}` : n}
                      </span>
                    </Link>
                  );
                })}
              </div>
              <Bars bars={bars} weekStart={w[0]} />
              <div className="g7">
                {w.map((d) => (
                  <span key={d} className="sum" style={d === today ? { color: 'var(--accent-text)' } : undefined}>
                    {summary(byDate.get(d)!, today)}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  } else {
    const ws = startOfWeek(anchor);
    const we = addDays(ws, 6);
    const [days, bars] = await Promise.all([calendarDays(ctx, ws, we, today), sessionBars(ctx, ws, we)]);
    const [ys, msn, ds] = ws.split('-').map(Number);
    const [ye, men, de] = we.split('-').map(Number);
    title =
      msn === men
        ? `${ds} – ${de} ${MONTH_LONG[men - 1]} ${ye}`
        : `${ds} ${MONTH_SHORT[msn - 1]}${ys !== ye ? ` ${ys}` : ''} – ${de} ${MONTH_SHORT[men - 1]} ${ye}`;
    prev = href('minggu', addDays(ws, -7));
    next = href('minggu', addDays(ws, 7));
    body = (
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 860, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="g7" style={{ gap: 6, paddingBottom: 6, borderBottom: '1px solid var(--divider)' }}>
            {days.map((d) => {
              const isToday = d.date === today;
              return (
                <div key={d.date} style={{ padding: '0 6px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span className="small" style={{ color: isToday ? 'var(--accent-text)' : 'var(--text-2)' }}>
                    {DAY_SHORT[weekdayIndex(d.date)]}
                    {isToday && ' · hari ini'}
                  </span>
                  <span
                    className="tabular"
                    style={{ fontSize: 20, lineHeight: '28px', fontWeight: 600, color: isToday ? 'var(--accent)' : 'var(--text)' }}
                  >
                    {Number(d.date.slice(8))}
                  </span>
                  <span className="small muted">{daySummary(d, today) || (d.date < today ? 'Tanpa to-do' : 'Kosong')}</span>
                </div>
              );
            })}
          </div>
          <Bars bars={bars} weekStart={ws} gap={6} />
          <div className="g7" style={{ gap: 6, alignItems: 'start', minHeight: 360 }}>
            {days.map((d) => (
              <WeekColumn key={d.date} d={d} today={today} href={dayHref(d.date)} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <main className="page" style={{ gap: 20 }}>
        <header className="page-head">
          <div>
            <div className="eyebrow">Kalender</div>
            <h1 className="title">{title}</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div className="seg" role="group" aria-label="Tampilan">
              <Link href={href('bulan', anchor)} aria-current={view === 'bulan'}>
                Bulan
              </Link>
              <Link href={href('minggu', anchor)} aria-current={view === 'minggu'}>
                Minggu
              </Link>
            </div>
            <Link className="btn" href={href(view, today)}>
              Hari ini
            </Link>
            <Link className="icon-btn" href={prev} aria-label={view === 'bulan' ? 'Bulan sebelumnya' : 'Minggu sebelumnya'}>
              <ChevronLeft size={16} />
            </Link>
            <Link className="icon-btn" href={next} aria-label={view === 'bulan' ? 'Bulan berikutnya' : 'Minggu berikutnya'}>
              <ChevronRight size={16} />
            </Link>
          </div>
        </header>
        {body}
        <div className="small muted" style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {view === 'bulan' ? (
            <>
              <span>
                Angka di bawah garis sesi: task diceklis dari to-do hari itu, atau jumlah rancangan untuk hari mendatang.
              </span>
              <span>Klik tanggal untuk membuka detail hari.</span>
            </>
          ) : (
            <span>
              Kotak terisi berarti task diceklis hari itu. Angka di bawah nama adalah perubahan progress pada hari itu. Klik
              kolom hari untuk membuka detailnya.
            </span>
          )}
        </div>
      </main>
      <OverlayHost ctx={ctx} today={today} sp={sp} />
    </>
  );
}

function summary(d: CalendarDay, today: string) {
  const s = daySummary(d, today);
  if (d.date === today && d.items.length && !d.todo?.lockedAt) return `${d.items.length} task · belum dikunci`;
  return s === '–' ? '' : s;
}

function WeekColumn({ d, today, href }: { d: CalendarDay; today: string; href: string }) {
  const isToday = d.date === today;
  const locked = !!d.todo?.lockedAt;
  return (
    <Link className="wcol" href={href} scroll={false} style={isToday ? { background: 'var(--accent-bg)' } : undefined}>
      {d.items.map((i) => (
        <div className="it" key={i.task.id}>
          <span className={i.checked ? 'box on' : 'box'} style={!locked ? { opacity: 0.45 } : undefined}>
            {i.checked && <Check size={9} strokeWidth={3} />}
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="t" style={i.task.status === 'batal' ? { textDecoration: 'line-through', color: 'var(--text-2)' } : undefined}>
              {i.task.name}
            </div>
            <div className="m">
              {i.task.projectColor ? <Sq color={i.task.projectColor} /> : <span className="sq" style={{ background: '#91918e' }} />}
              <span>
                {i.delta ? `${i.delta.before} → ${i.delta.after}` : locked ? 'Tanpa update' : 'Belum dikunci'}
              </span>
            </div>
          </div>
        </div>
      ))}
    </Link>
  );
}
