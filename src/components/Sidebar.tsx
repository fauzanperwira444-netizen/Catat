import { CalendarDays, Database, Folder, House, List, ListChecks } from 'lucide-react';
import { holdsColor } from '@/modules/projects/rules';
import type { ProjectSummary } from '@/modules/projects/service';
import { Sq } from './bits';
import { NavLink } from './NavLink';

export function Sidebar({ projects }: { projects: ProjectSummary[] }) {
  const active = projects.filter((p) => holdsColor(p.status));
  return (
    <nav className="sidebar" aria-label="Navigasi utama">
      <div className="brand">Catat</div>
      <NavLink href="/" exact>
        <House size={16} aria-hidden />
        Home
      </NavLink>
      <NavLink href="/todo">
        <ListChecks size={16} aria-hidden />
        To-do
      </NavLink>
      <NavLink href="/kalender">
        <CalendarDays size={16} aria-hidden />
        Kalender
      </NavLink>
      <NavLink href="/task">
        <List size={16} aria-hidden />
        Semua task
      </NavLink>
      <NavLink href="/projek" exact>
        <Folder size={16} aria-hidden />
        Projek
      </NavLink>
      {active.length > 0 && <div className="nav-group">Projek aktif</div>}
      {active.map((p) => (
        <NavLink key={p.id} href={`/projek/${p.id}`}>
          <Sq color={p.color} />
          <span className="label">{p.name}</span>
        </NavLink>
      ))}
      <div style={{ flexGrow: 1, minHeight: 24 }} />
      <NavLink href="/data">
        <Database size={16} aria-hidden />
        Data
      </NavLink>
    </nav>
  );
}
