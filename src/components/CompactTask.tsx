'use client';
import type { TaskView } from '@/modules/tasks/views';
import { fmtDeadline } from '@/shared/time';
import { OriginTag, Progress } from './bits';
import { useOverlay } from './client';

/** Baris task ringkas untuk kolom kanan. */
export function CompactTask({ task, today }: { task: TaskView; today: string }) {
  const { open } = useOverlay();
  return (
    <button type="button" className="crow" onClick={() => open({ o: 'task', id: task.id })}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="t">{task.name}</div>
        <div className="m">
          <OriginTag task={task} />
          <span className={task.late ? 'late' : undefined} style={{ whiteSpace: 'nowrap' }}>
            {fmtDeadline(task.deadlineDate, task.deadlineTime, today)}
          </span>
        </div>
      </div>
      <Progress value={task.progress} late={task.late} width={36} />
    </button>
  );
}
