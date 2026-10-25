// "Minggu ini": tujuh hari dengan ringkasan to-do dan garis sesi projek.
import Link from 'next/link';
import clsx from 'clsx';
import { laneBars, type CalendarDay, type SessionBar } from '@/modules/calendar/service';
import { colorMeta } from '@/shared/colors';
import { DAY_SHORT, weekdayIndex } from '@/shared/time';
import { Sq } from './bits';

export function daySummary(d: CalendarDay, today: string): string {
  if (!d.items.length) return d.date < today ? '–' : '';
  if (d.todo?.lockedAt) return `${d.checkedCount}/${d.items.length} diceklis`;
  if (d.date === today) return `${d.items.length} task`;
  return `${d.items.length} rancangan`;
}

export function WeekStrip({
  days,
  bars,
  today,
  hrefFor,
}: {
  days: CalendarDay[];
  bars: SessionBar[];
  today: string;
  hrefFor?: (date: string) => string;
}) {
  const lanes = laneBars(bars, days[0].date);
  return (
    <div className="cal-box">
      <div style={{ minWidth: 520 }}>
        <div className="grid7">
          {days.map((d) => (
            <Link
              key={d.date}
              className="day"
              href={hrefFor ? hrefFor(d.date) : `?o=hari&hari=${d.date}`}
              scroll={false}
              aria-current={d.date === today ? 'date' : undefined}
            >
              {DAY_SHORT[weekdayIndex(d.date)]}
              <b>{Number(d.date.slice(8))}</b>
              <span>{daySummary(d, today) || ' '}</span>
            </Link>
          ))}
        </div>
        {lanes.map((lane, i) => (
          <div key={i} className="grid7" style={{ marginTop: i === 0 ? 8 : 4 }}>
            {lane.map((b) => {
              const c = colorMeta(b.color);
              return (
                <div
                  key={b.sessionId}
                  className={clsx('sbar', b.continuesBefore && 'cont-before', b.continuesAfter && 'cont-after')}
                  style={{ gridColumn: `${b.col} / span ${b.span}`, background: c.bg, color: c.text }}
                  title={`${b.projectName} · ${b.sessionName}`}
                >
                  <Sq color={b.color} />
                  {b.projectName} · {b.sessionName}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
