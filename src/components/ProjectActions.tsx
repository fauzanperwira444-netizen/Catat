'use client';
import * as M from '@radix-ui/react-dropdown-menu';
import { MoreHorizontal, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import {
  cancelProjectAction,
  completeProjectEarlyAction,
  removeSessionAction,
} from '@/app/actions';
import { useAction, useOverlay } from './client';
import { Confirm } from './Dialog';

export function ProjectActions({
  id,
  name,
  canEdit,
  canComplete,
  canCancel,
}: {
  id: string;
  name: string;
  canEdit: boolean;
  canComplete: boolean;
  canCancel: boolean;
}) {
  const { open } = useOverlay();
  const [dialog, setDialog] = useState<'selesai' | 'batal' | null>(null);
  const { run, pending, error, setError } = useAction();
  const closeDialog = () => {
    setDialog(null);
    setError(null);
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {canEdit && (
        <button type="button" className="btn btn-ghost" onClick={() => open({ o: 'projek-ubah', id })}>
          <Pencil size={16} aria-hidden />
          Edit
        </button>
      )}
      {canComplete && (
        <button type="button" className="btn" onClick={() => setDialog('selesai')}>
          Tandai selesai
        </button>
      )}
      {canEdit && (
        <button type="button" className="btn btn-primary" onClick={() => open({ o: 'sesi-baru', projek: id })}>
          <Plus size={16} aria-hidden />
          Sesi
        </button>
      )}
      {canCancel && (
        <M.Root>
          <M.Trigger className="icon-btn" aria-label="Aksi lain projek">
            <MoreHorizontal size={16} />
          </M.Trigger>
          <M.Portal>
            <M.Content className="menu" align="end" sideOffset={4}>
              <M.Item className="menu-item danger" onSelect={() => setDialog('batal')}>
                Batalkan projek
              </M.Item>
            </M.Content>
          </M.Portal>
        </M.Root>
      )}
      {dialog === 'selesai' && (
        <Confirm
          title={`Tandai "${name}" selesai?`}
          body="Sesi yang sedang berjalan diakhiri hari ini dan sesi yang belum mulai dibatalkan. Warna projek dilepas. Tindakan ini tidak bisa diurungkan."
          confirmLabel="Tandai selesai"
          pending={pending}
          error={error}
          onCancel={closeDialog}
          onConfirm={() => run(() => completeProjectEarlyAction(id), () => setDialog(null))}
        />
      )}
      {dialog === 'batal' && (
        <Confirm
          title={`Batalkan projek "${name}"?`}
          body="Semua task aktif projek ini ikut dibatalkan dan dikeluarkan dari to-do mendatang. Riwayat tetap tersimpan dan warnanya dilepas. Tindakan ini tidak bisa diurungkan."
          confirmLabel="Batalkan projek"
          danger
          pending={pending}
          error={error}
          onCancel={closeDialog}
          onConfirm={() => run(() => cancelProjectAction(id), () => setDialog(null))}
        />
      )}
    </div>
  );
}

export function SessionActions({
  projectId,
  sessionId,
  name,
  hasTasks,
  activeTaskCount,
}: {
  projectId: string;
  sessionId: string;
  name: string;
  hasTasks: boolean;
  activeTaskCount: number;
}) {
  const { open } = useOverlay();
  const [confirm, setConfirm] = useState(false);
  const { run, pending, error, setError } = useAction();
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => open({ o: 'task-baru', projek: projectId, sesi: sessionId })}
      >
        <Plus size={16} aria-hidden />
        Task
      </button>
      <button type="button" className="btn btn-ghost" onClick={() => open({ o: 'sesi-ubah', id: sessionId })}>
        <Pencil size={16} aria-hidden />
        Edit sesi
      </button>
      <M.Root>
        <M.Trigger className="icon-btn" aria-label={`Aksi lain sesi ${name}`}>
          <MoreHorizontal size={16} />
        </M.Trigger>
        <M.Portal>
          <M.Content className="menu" align="start" sideOffset={4} style={{ width: 240 }}>
            <M.Item className="menu-item danger" onSelect={() => setConfirm(true)}>
              {hasTasks ? 'Batalkan sesi' : 'Hapus sesi'}
            </M.Item>
            <div className="hint" style={{ padding: '4px 8px 6px' }}>
              {hasTasks
                ? 'Sesi ini sudah punya task, jadi hanya bisa dibatalkan. Task aktifnya ikut dibatalkan.'
                : 'Sesi tanpa task dihapus permanen.'}
            </div>
          </M.Content>
        </M.Portal>
      </M.Root>
      {confirm && (
        <Confirm
          title={hasTasks ? `Batalkan sesi "${name}"?` : `Hapus sesi "${name}"?`}
          body={
            hasTasks
              ? `${activeTaskCount} task aktif ikut dibatalkan. Riwayat tetap tersimpan. Tindakan ini tidak bisa diurungkan.`
              : 'Sesi ini belum punya task dan akan dihapus permanen.'
          }
          confirmLabel={hasTasks ? 'Batalkan sesi' : 'Hapus sesi'}
          danger
          pending={pending}
          error={error}
          onCancel={() => {
            setConfirm(false);
            setError(null);
          }}
          onConfirm={() => run(() => removeSessionAction(sessionId), () => setConfirm(false))}
        />
      )}
    </div>
  );
}
