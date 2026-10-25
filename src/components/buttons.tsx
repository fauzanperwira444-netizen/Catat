'use client';
import { Lock, Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { lockTodoAction } from '@/app/actions';
import { useAction, useOverlay } from './client';
import { Confirm } from './Dialog';

/** Tombol yang membuka overlay lewat URL. */
export function OpenButton({
  params,
  children,
  className = 'btn btn-primary',
  plus,
  ariaLabel,
}: {
  params: Record<string, string>;
  children?: ReactNode;
  className?: string;
  plus?: boolean;
  ariaLabel?: string;
}) {
  const { open } = useOverlay();
  return (
    <button type="button" className={className} aria-label={ariaLabel} onClick={() => open(params)}>
      {plus && <Plus size={16} aria-hidden />}
      {children}
    </button>
  );
}

export function LockTodoButton({ date, count, className }: { date: string; count: number; className?: string }) {
  const [confirm, setConfirm] = useState(false);
  const { run, pending, error, setError } = useAction();
  return (
    <>
      <button
        type="button"
        className={clsx('btn btn-primary', className)}
        disabled={count === 0}
        title={count === 0 ? 'Tambahkan minimal satu task dulu' : undefined}
        onClick={() => setConfirm(true)}
      >
        <Lock size={16} aria-hidden />
        Kunci to-do
      </button>
      {confirm && (
        <Confirm
          title="Kunci to-do hari ini?"
          body={`${count} task akan dikunci. Setelah dikunci, daftar task tidak bisa diubah, tetapi kamu bisa menceklis dan mencatat progress.`}
          confirmLabel="Kunci to-do"
          pending={pending}
          error={error}
          onCancel={() => {
            setConfirm(false);
            setError(null);
          }}
          onConfirm={() => run(() => lockTodoAction(date), () => setConfirm(false))}
        />
      )}
    </>
  );
}
