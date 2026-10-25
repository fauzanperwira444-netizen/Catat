import { OpenButton } from '@/components/buttons';
import { Drop } from '@/components/Drop';
import { LabelList } from '@/components/LabelList';
import { OverlayHost, type SP } from '@/components/overlays/OverlayHost';
import { TaskFilters } from '@/components/TaskFilters';
import { TaskTable } from '@/components/TaskTable';
import { listLabelsWithCounts } from '@/modules/labels/service';
import { liveSessions } from '@/modules/projects/rules';
import { listProjects } from '@/modules/projects/service';
import { filteredTasks, taskCounts, type TaskFilter } from '@/modules/tasks/views';
import { pageCtx } from '@/server/page';

export const metadata = { title: 'Semua task' };

const str = (v: unknown) => (typeof v === 'string' ? v : '');

export default async function AllTasksPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { ctx, today } = await pageCtx();
  const statusRaw = str(sp.status);
  const status = (['selesai', 'batal', 'semua'].includes(statusRaw) ? statusRaw : 'aktif') as TaskFilter['status'];
  const origin = str(sp.asal);
  const sessionId = str(sp.s);
  const [tasks, counts, labels, projects] = await Promise.all([
    filteredTasks(ctx, { status, origin: origin || undefined, sessionId: sessionId || undefined }, today),
    taskCounts(ctx),
    listLabelsWithCounts(ctx),
    listProjects(ctx, today),
  ]);
  const project = projects.find((p) => p.id === origin);
  const origins = [
    ...projects.map((p) => ({ value: p.id, label: p.name, group: 'projek' as const })),
    ...labels.map((l) => ({ value: `label:${l.id}`, label: l.name, group: 'label' as const })),
  ];
  const empty =
    status === 'aktif' ? 'Tidak ada task aktif untuk filter ini.' : `Tidak ada task ${status === 'semua' ? '' : status} untuk filter ini.`;

  return (
    <>
      <main className="page" style={{ gap: 20 }}>
        <header className="page-head">
          <div>
            <h1 className="title" style={{ margin: 0 }}>
              Semua task
            </h1>
            <div className="muted" style={{ marginTop: 2 }}>
              Urut deadline paling awal, lalu yang paling sulit
            </div>
          </div>
          <OpenButton params={{ o: 'task-baru' }} plus>
            Task
          </OpenButton>
        </header>
        <TaskFilters
          status={status!}
          origin={origin}
          sessionId={sessionId}
          counts={counts}
          origins={origins}
          sessions={project ? liveSessions(project.sessions).map((s) => ({ id: s.id, name: s.name })) : []}
        />
        <TaskTable rows={tasks.map((t) => ({ task: t }))} today={today} mode="all" emptyText={empty} />
      </main>
      <aside className="aside" aria-label="Pengaturan label" style={{ gap: 12 }}>
        <Drop id="task-label" title="Label task mandiri" count={labels.length}>
          <LabelList labels={labels} />
        </Drop>
      </aside>
      <OverlayHost ctx={ctx} today={today} sp={sp} />
    </>
  );
}
