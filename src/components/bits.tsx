// Potongan tampilan kecil tanpa state. Aman dipakai di server maupun klien.
import { AlertCircle, Check } from 'lucide-react';
import type { TaskView } from '@/modules/tasks/views';
import { colorMeta } from '@/shared/colors';
import { fmtDeadline, fmtShort, type DateStr } from '@/shared/time';

export function Sq({ color, size = 7 }: { color: string; size?: number }) {
  return <span className="sq" style={{ background: colorMeta(color).mark, width: size, height: size }} />;
}

/** Tag asal task: projek berwarna, atau label abu-abu untuk task mandiri. */
export function OriginTag({ task }: { task: Pick<TaskView, 'labelName' | 'projectColor'> }) {
  if (!task.projectColor) return <span className="tag">{task.labelName}</span>;
  const c = colorMeta(task.projectColor);
  return (
    <span className="tag" style={{ background: c.bg, color: c.text }}>
      <Sq color={task.projectColor} />
      {task.labelName}
    </span>
  );
}

export function ProjectTag({ name, color }: { name: string; color: string }) {
  const c = colorMeta(color);
  return (
    <span className="tag" style={{ background: c.bg, color: c.text }}>
      <Sq color={color} />
      {name}
    </span>
  );
}

export function Difficulty({ value }: { value: number }) {
  return (
    <span className="dif" aria-label={`Kesulitan ${value} dari 5`} role="img">
      {[1, 2, 3, 4, 5].map((i) => (
        <i key={i} className={i <= value ? 'on' : undefined} />
      ))}
    </span>
  );
}

export function Progress({ value, late, width }: { value: number; late?: boolean; width?: number }) {
  return (
    <span className="prog" aria-label={`Progress ${value} dari 10`}>
      <span className="bar" style={width ? { width } : undefined}>
        {value > 0 && (
          <i style={{ width: `${value * 10}%`, background: value === 10 ? 'var(--done)' : late ? 'var(--late)' : 'var(--accent)' }} />
        )}
      </span>
      {value}
    </span>
  );
}

/** Kolom deadline: "Telat 2 hari", "Selesai", "Besok 08.00", dst. */
export function Deadline({ task, today, withDate }: { task: TaskView; today: DateStr; withDate?: boolean }) {
  if (task.status === 'batal') return <span className="when">Batal</span>;
  if (task.status === 'selesai')
    return (
      <span className="when done">
        <Check size={14} aria-hidden />
        Selesai
      </span>
    );
  const label = fmtDeadline(task.deadlineDate, task.deadlineTime, today);
  if (task.late)
    return (
      <span className="when late">
        <AlertCircle size={14} aria-hidden />
        {label}
        {withDate && ` · ${fmtShort(task.deadlineDate)}`}
      </span>
    );
  const isToday = task.deadlineDate === today;
  return (
    <span className="when" style={isToday ? { color: 'var(--text)', fontWeight: 500 } : undefined}>
      {label}
    </span>
  );
}
