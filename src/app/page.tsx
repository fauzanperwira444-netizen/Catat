import Link from 'next/link';
import { Lock } from 'lucide-react';
import { OpenButton, LockTodoButton } from '@/components/buttons';
import { CompactTask } from '@/components/CompactTask';
import { Drop } from '@/components/Drop';
import { OverlayHost, type SP } from '@/components/overlays/OverlayHost';
import { ProjectCard } from '@/components/ProjectCards';
import { TaskTable } from '@/components/TaskTable';
import { WeekStrip } from '@/components/WeekStrip';
import { calendarDays, sessionBars } from '@/modules/calendar/service';
import { holdsColor } from '@/modules/projects/rules';
import { listProjects } from '@/modules/projects/service';
import { lateTasks, nextSevenDays } from '@/modules/tasks/views';
import { getTodo } from '@/modules/todos/service';
import { pageCtx } from '@/server/page';
import { addDays, fmtClock, fmtLong, startOfWeek } from '@/shared/time';

export const metadata = { title: 'Home' };

export default async function Home({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { ctx, today } = await pageCtx();
  const weekStart = startOfWeek(today);
  const weekEnd = addDays(weekStart, 6);
  const [todo, days, bars, projects, late, week] = await Promise.all([
    getTodo(ctx, today, today),
    calendarDays(ctx, weekStart, weekEnd, today),
    sessionBars(ctx, weekStart, weekEnd),
    listProjects(ctx, today),
    lateTasks(ctx, today),
    nextSevenDays(ctx, today),
  ]);
  const shown = projects.filter((p) => holdsColor(p.status));
  const locked = todo.state === 'terkunci';
  const checked = todo.items.filter((i) => i.checked).length;

  return (
    <>
      <main className="page">
        <header className="page-head">
          <div>
            <div className="eyebrow">Home</div>
            <h1 className="title">{fmtLong(today)}</h1>
          </div>
          <OpenButton params={{ o: 'task-baru' }} plus>
            Task
          </OpenButton>
        </header>

        <section className="section" aria-labelledby="cal-h" style={{ gap: 8 }}>
          <h2 className="h2" id="cal-h">
            Minggu ini
          </h2>
          <WeekStrip days={days} bars={bars} today={today} />
        </section>

        <section className="section" aria-labelledby="todo-h">
          <div className="section-head">
            <h2 className="h2" id="todo-h">
              To-do hari ini{' '}
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
              <Link href="/todo" style={{ fontSize: 14 }}>
                {todo.items.length ? 'Ubah to-do' : 'Susun to-do'}
              </Link>
            )}
          </div>
          {!locked && todo.items.length > 0 && (
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
              {locked ? 'To-do hari ini kosong.' : 'Belum ada task di to-do hari ini.'}
              {!locked && (
                <Link className="btn" href="/todo">
                  Susun to-do hari ini
                </Link>
              )}
            </div>
          ) : (
            <TaskTable
              rows={todo.items.map((i) => ({ task: i.task, checked: i.checked }))}
              today={today}
              mode={locked ? 'locked' : 'draft'}
              todoDate={today}
            />
          )}
        </section>
      </main>

      <aside className="aside" aria-label="Ringkasan">
        <Drop id="home-projek" title="Projek" count={shown.length}>
          {shown.length === 0 && (
            <div className="hint" style={{ padding: '4px' }}>
              Belum ada projek aktif. <Link href="/projek?o=projek-baru">Buat projek</Link>
            </div>
          )}
          {shown.map((p) => (
            <ProjectCard key={p.id} p={p} />
          ))}
        </Drop>
        <Drop id="home-telat" title="Task terlambat" count={late.length} countClass={late.length ? 'late' : undefined}>
          {late.length === 0 && (
            <div className="hint" style={{ padding: '4px' }}>
              Tidak ada task terlambat.
            </div>
          )}
          {late.map((t) => (
            <CompactTask key={t.id} task={t} today={today} />
          ))}
        </Drop>
        <Drop id="home-7hari" title="Task deadline 7 hari" count={week.length}>
          {week.length === 0 && (
            <div className="hint" style={{ padding: '4px' }}>
              Tidak ada deadline dalam 7 hari ke depan.
            </div>
          )}
          {week.map((t) => (
            <CompactTask key={t.id} task={t} today={today} />
          ))}
        </Drop>
      </aside>
      <OverlayHost ctx={ctx} today={today} sp={sp} />
    </>
  );
}
