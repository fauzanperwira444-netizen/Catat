import Link from 'next/link';
import { Lock } from 'lucide-react';
import { LockTodoButton } from '@/components/buttons';
import { OverlayHost, type SP } from '@/components/overlays/OverlayHost';
import { TaskPicker } from '@/components/TaskPicker';
import { TaskTable } from '@/components/TaskTable';
import { activeTasks, doneTasks } from '@/modules/tasks/views';
import { getTodo, PLAN_AHEAD_DAYS, upcomingTodoCounts } from '@/modules/todos/service';
import { pageCtx } from '@/server/page';
import { addDays, DAY_LONG, DAY_SHORT, fmtClock, isDateStr, MONTH_LONG, weekdayIndex } from '@/shared/time';

export const metadata = { title: 'To-do' };

export default async function TodoPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { ctx, today } = await pageCtx();
  const last = addDays(today, PLAN_AHEAD_DAYS);
  const raw = typeof sp.d === 'string' ? sp.d : '';
  const date = isDateStr(raw) && raw >= today && raw <= last ? raw : today;
  const [todo, counts, active, done] = await Promise.all([
    getTodo(ctx, date, today),
    upcomingTodoCounts(ctx, today),
    activeTasks(ctx, today),
    doneTasks(ctx, today),
  ]);
  const days = Array.from({ length: PLAN_AHEAD_DAYS + 1 }, (_, i) => addDays(today, i));
  const locked = todo.state === 'terkunci';
  const isToday = date === today;
  const dayName = DAY_LONG[weekdayIndex(date)];
  const [, m, dd] = date.split('-').map(Number);
  const checked = todo.items.filter((i) => i.checked).length;

  return (
    <>
      <main className="page" style={{ gap: 24 }}>
        <header>
          <div className="eyebrow">To-do</div>
          <h1 className="title">Rancang to-do</h1>
          <div className="muted" style={{ marginTop: 4 }}>
            Susun to-do untuk hari ini sampai {PLAN_AHEAD_DAYS} hari ke depan. Rancangan hari mendatang bisa diubah kapan
            saja.
          </div>
        </header>

        <div className="days8" role="tablist" aria-label="Pilih tanggal">
          {days.map((d, i) => {
            const c = counts.get(d);
            const label = i === 0 ? 'Hari ini' : i === 1 ? 'Besok' : DAY_LONG[weekdayIndex(d)];
            return (
              <Link
                key={d}
                className="dd"
                role="tab"
                aria-selected={d === date}
                href={i === 0 ? '/todo' : `/todo?d=${d}`}
                scroll={false}
              >
                <span className="d1">{label}</span>
                <span className="d2">
                  {DAY_SHORT[weekdayIndex(d)]} {Number(d.slice(8))}
                </span>
                <span className="d3">
                  {c?.locked && <Lock size={12} aria-hidden />}
                  {c && c.count ? `${c.count} task` : 'Kosong'}
                </span>
              </Link>
            );
          })}
        </div>

        <section className="section" aria-labelledby="day-h">
          <div className="section-head" style={{ alignItems: 'baseline' }}>
            <h2 className="h2" id="day-h">
              {dayName}, {dd} {MONTH_LONG[m - 1]}{' '}
              <span className="count">
                {locked ? `${checked} dari ${todo.items.length} diceklis` : `${todo.items.length} task`}
              </span>
            </h2>
            {locked ? (
              <span className="pill">
                <Lock size={14} aria-hidden />
                Terkunci pukul {fmtClock(todo.lockedAt!)}
              </span>
            ) : (
              <span className="small muted">
                {isToday ? 'Rancangan · kunci untuk mulai mengerjakan' : 'Rancangan · bisa diubah sampai dikunci pada hari itu'}
              </span>
            )}
          </div>
          {isToday && !locked && todo.items.length > 0 && (
            <div className="callout">
              <Lock size={16} aria-hidden style={{ color: 'var(--text-2)', flex: 'none' }} />
              <div className="body">
                To-do hari ini belum dikunci
                <div className="small muted">
                  Kunci untuk mulai menceklis dan mencatat progress. Setelah dikunci, daftar task tidak bisa diubah.
                </div>
              </div>
              <LockTodoButton date={today} count={todo.items.length} />
            </div>
          )}
          {todo.items.length === 0 ? (
            <div className="empty">
              {locked ? 'To-do ini kosong.' : `Belum ada task untuk ${isToday ? 'hari ini' : dayName}. Tambah dari daftar di kanan.`}
            </div>
          ) : (
            <TaskTable
              rows={todo.items.map((i) => ({ task: i.task, checked: i.checked }))}
              today={today}
              mode={locked ? 'locked' : 'plan'}
              todoDate={date}
            />
          )}
          {!locked && (
            <div className="small muted">
              Tambah task dari daftar di kanan. Task yang selesai atau dibatalkan keluar otomatis dari rancangan ini.
            </div>
          )}
        </section>
      </main>

      <aside className="aside" aria-labelledby="pick-h" style={{ gap: 12, flexBasis: 340 }}>
        <h2 className="h2" id="pick-h">
          Pilih task
        </h2>
        <TaskPicker
          date={date}
          dayName={dayName}
          active={active}
          done={done}
          inTodo={todo.items.map((i) => i.task.id)}
          today={today}
          locked={locked}
        />
      </aside>
      <OverlayHost ctx={ctx} today={today} sp={sp} />
    </>
  );
}
