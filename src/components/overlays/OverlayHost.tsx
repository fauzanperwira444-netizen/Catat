// Memilih overlay dari parameter URL (?o=…). Data disiapkan di server.
import type { Ctx } from '@/server/db';
import { calendarDays, sessionBars } from '@/modules/calendar/service';
import { listLabelsWithCounts } from '@/modules/labels/service';
import { liveSessions } from '@/modules/projects/rules';
import { colorsInUse, getProject, getSession, sessionsForTaskForm } from '@/modules/projects/service';
import { getTaskDetail } from '@/modules/tasks/service';
import { getTodo } from '@/modules/todos/service';
import { isProjectColor } from '@/shared/colors';
import { DomainError } from '@/shared/errors';
import { isDateStr } from '@/shared/time';
import { DayDetail } from './DayDetail';
import { ProjectForm } from './ProjectForm';
import { SessionForm } from './SessionForm';
import { TaskDetail } from './TaskDetail';
import { TaskForm } from './TaskForm';

export type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function OverlayHost({ ctx, today, sp }: { ctx: Ctx; today: string; sp: SP }) {
  const o = one(sp.o);
  const id = one(sp.id);
  try {
    switch (o) {
      case 'task':
        return id ? <TaskDetailHost ctx={ctx} today={today} id={id} /> : null;
      case 'task-baru':
      case 'task-ubah':
        return <TaskFormHost ctx={ctx} today={today} id={o === 'task-ubah' ? id : undefined} sp={sp} />;
      case 'projek-baru':
      case 'projek-ubah':
        return <ProjectFormHost ctx={ctx} today={today} id={o === 'projek-ubah' ? id : undefined} />;
      case 'sesi-baru':
      case 'sesi-ubah':
        return (
          <SessionFormHost
            ctx={ctx}
            today={today}
            projectId={one(sp.projek)}
            sessionId={o === 'sesi-ubah' ? id : undefined}
          />
        );
      case 'hari': {
        const d = one(sp.hari);
        if (!d || !isDateStr(d)) return null;
        const [day] = await calendarDays(ctx, d, d, today);
        const bars = await sessionBars(ctx, d, d);
        return <DayDetail day={day} sessions={bars} today={today} />;
      }
      default:
        return null;
    }
  } catch (e) {
    if (e instanceof DomainError) return null; // id tidak ditemukan: abaikan overlay
    throw e;
  }
}

async function TaskDetailHost({ ctx, today, id }: { ctx: Ctx; today: string; id: string }) {
  const d = await getTaskDetail(ctx, id, today);
  const todo = await getTodo(ctx, today, today);
  const inTodo = todo.items.some((i) => i.task.id === id);
  const locked = todo.state === 'terkunci';
  const todayState = locked
    ? inTodo
      ? 'terkunci-ada'
      : 'terkunci-tidak-ada'
    : inTodo
      ? 'draf-ada'
      : 'draf-tidak-ada';
  return <TaskDetail data={{ task: d.task, logs: d.logs, today, todayState }} />;
}

async function TaskFormHost({ ctx, today, id, sp }: { ctx: Ctx; today: string; id?: string; sp: SP }) {
  const projects = await sessionsForTaskForm(ctx, today);
  const labels = (await listLabelsWithCounts(ctx)).map((l) => ({ id: l.id, name: l.name }));
  if (id) {
    const { task } = await getTaskDetail(ctx, id, today);
    return (
      <TaskForm
        data={{
          mode: 'ubah',
          taskId: id,
          projects,
          labels,
          lockedProjectId: task.projectId ?? undefined,
          initial: {
            name: task.name,
            kind: task.kind,
            sessionId: task.sessionId ?? '',
            labelName: task.kind === 'mandiri' ? task.labelName : '',
            deadlineDate: task.deadlineDate,
            deadlineTime: task.deadlineTime ?? '',
            difficulty: task.difficulty,
          },
        }}
      />
    );
  }
  const projectId = one(sp.projek);
  const preset = projects.find((p) => p.projectId === projectId);
  const sesi = one(sp.sesi);
  const session =
    preset?.sessions.find((s) => s.id === sesi) ??
    preset?.sessions.find((s) => s.startDate <= today && today <= s.endDate) ??
    preset?.sessions.find((s) => s.startDate > today) ??
    preset?.sessions[0];
  const tanggal = one(sp.tanggal);
  return (
    <TaskForm
      data={{
        mode: 'baru',
        projects,
        labels,
        lockedProjectId: preset?.projectId,
        initial: {
          name: '',
          kind: preset ? 'projek' : 'mandiri',
          sessionId: session?.id ?? '',
          labelName: '',
          deadlineDate: tanggal && isDateStr(tanggal) ? tanggal : '',
          deadlineTime: '',
          difficulty: null,
        },
      }}
    />
  );
}

async function ProjectFormHost({ ctx, today, id }: { ctx: Ctx; today: string; id?: string }) {
  const used = Object.fromEntries(await colorsInUse(ctx, today, id));
  if (id) {
    const p = await getProject(ctx, id, today);
    return (
      <ProjectForm
        data={{
          mode: 'ubah',
          projectId: id,
          colorsInUse: used,
          initial: {
            name: p.name,
            description: p.description,
            team: p.team,
            links: p.links,
            color: isProjectColor(p.color) ? p.color : '',
          },
        }}
      />
    );
  }
  return (
    <ProjectForm
      data={{ mode: 'baru', colorsInUse: used, initial: { name: '', description: '', team: [], links: [], color: '' } }}
    />
  );
}

async function SessionFormHost({
  ctx,
  today,
  projectId,
  sessionId,
}: {
  ctx: Ctx;
  today: string;
  projectId?: string;
  sessionId?: string;
}) {
  const s = sessionId ? await getSession(ctx, sessionId) : undefined;
  const pid = s?.projectId ?? projectId;
  if (!pid) return null;
  const p = await getProject(ctx, pid, today);
  const live = liveSessions(p.sessions).filter((x) => x.id !== sessionId);
  const last = live[live.length - 1];
  return (
    <SessionForm
      data={{
        mode: s ? 'ubah' : 'baru',
        sessionId: s?.id,
        projectId: p.id,
        projectName: p.name,
        color: p.color,
        lastSession: last ? { name: last.name, startDate: last.startDate, endDate: last.endDate } : undefined,
        initial: s
          ? { name: s.name, startDate: s.startDate, endDate: s.endDate, description: s.description, goals: s.goals }
          : { name: '', startDate: '', endDate: '', description: '', goals: '' },
      }}
    />
  );
}
