'use client';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { useRemembered } from './client';

/** Dropdown kolom kanan. Terbuka secara default, statusnya diingat. */
export function Drop({
  id,
  title,
  count,
  countClass,
  children,
}: {
  id: string;
  title: string;
  count?: number;
  countClass?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useRemembered(`drop:${id}`);
  return (
    <details
      className="drop"
      open={open}
      onToggle={(e) => {
        const now = (e.currentTarget as HTMLDetailsElement).open;
        if (now !== open) setOpen(now);
      }}
    >
      <summary>
        <ChevronRight size={16} className="chev" aria-hidden />
        {title}
        {count !== undefined && (
          <span className={countClass} style={{ fontWeight: 400, color: countClass ? undefined : 'var(--text-2)' }}>
            {count}
          </span>
        )}
      </summary>
      <div className="drop-body">{children}</div>
    </details>
  );
}
