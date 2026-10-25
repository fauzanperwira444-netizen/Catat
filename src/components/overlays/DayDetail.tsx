'use client';
import { Check, Lock } from 'lucide-react';
import Link from 'next/link';
import type { CalendarDay, SessionBar } from '@/modules/calendar/service';
import { fmtClock, fmtLong } from '@/shared/time';
import { OriginTag, ProjectTag } from '../bits';
import { useOverlay } from '../client';
import { Overlay } from '../Dialog';

export function DayDetail({ day, sessions, today }: { day: CalendarDay; sessions: SessionBar[]; today: string }) {
  const { close, open } = useOverlay();
  const past = day.date < today;
  const isToday = day.date === today;
  const locked = !!day.todo?.lockedAt;
  const status = locked
    ? day.todo!.autoLocked
      ? 'Dikunci otomatis saat hari berganti'
      : `Terkunci pukul ${fmtClock(day.todo!.lockedAt!)}${past ? ' · riwayat tidak bisa diubah' : ''}`
    : past
      ? 'Tidak ada to-do'
      : 'Belum dikunci';
  const todoItems = day.items;
  return (
    <Overlay title={fmtLong(day.date)} eyebrow="Detail hari" onClose={close} hideTitle>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: -4 }}>
        <h2 className="h2">{fmtLong(day.date)}</h2>
        {(day.todo || past) && (
          <span className="pill">
            {locked && <Lock size={14} aria-hidden />}
            {status}
          </span>
        )}
      </div>
      {sessions.length > 0 && (
        <div className="small muted" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span>Sesi berjalan</span>
          {sessions.map((s) => (
            <ProjectTag key={s.sessionId} name={`${s.projectName} · ${s.sessionName}`} color={s.color} />
          ))}
        </div>
      )}
      <section aria-labelledby="dh-todo" style={{ display: 'flex', flexDirection: 'column' }}>
        <h3 className="h3" id="dh-todo">
          {locked
            ? `To-do · ${day.checkedCount} dari ${todoItems.length} diceklis`
            : `${past ? 'To-do' : 'Rancangan to-do'} · ${todoItems.length} task`}
        </h3>
        {todoItems.length === 0 && (
          <div className="hint" style={{ paddingTop: 8 }}>
            {past ? 'Tidak ada task di to-do hari ini.' : 'Belum ada task di rancangan to-do.'}
          </div>
        )}
        {todoItems.map((i) => (
          <div className="entry" key={i.task.id}>
            <span
              className={i.checked ? 'box on' : 'box'}
              role="img"
              aria-label={i.checked ? 'Diceklis' : 'Tidak diceklis'}
              style={!locked ? { opacity: 0.45 } : undefined}
            >
              {i.checked && <Check size={10} strokeWidth={3} />}
            </span>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="link-btn"
                  style={{
                    color: 'var(--text)',
                    textDecoration: i.task.status === 'batal' ? 'line-through' : undefined,
                  }}
                  onClick={() => open({ o: 'task', id: i.task.id })}
                >
                  {i.task.name}
                </button>
                <OriginTag task={i.task} />
                {i.task.status === 'batal' && <span className="small muted">Batal</span>}
                <span
                  className="small tabular"
                  style={{ marginLeft: 'auto', color: i.delta ? 'var(--text)' : 'var(--text-2)' }}
                >
                  {i.delta ? `Progress ${i.delta.before} → ${i.delta.after}` : locked || past ? 'Tanpa update progress' : ''}
                </span>
              </div>
              {i.notes.map((n, k) => (
                <div key={k} style={{ whiteSpace: 'pre-wrap' }}>
                  {n}
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
      <div className="overlay-foot" style={{ justifyContent: 'flex-end' }}>
        {!past && (
          <Link className="btn" href={isToday ? '/todo' : `/todo?d=${day.date}`}>
            {isToday ? 'Buka to-do hari ini' : 'Susun to-do'}
          </Link>
        )}
        <button type="button" className="btn" onClick={close}>
          Tutup
        </button>
      </div>
    </Overlay>
  );
}
