'use client';
import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import clsx from 'clsx';

/** Overlay tengah 640px (design system). Selalu terbuka; menutup = onClose. */
export function Overlay({
  title,
  eyebrow,
  onClose,
  children,
  variant,
  hideTitle,
}: {
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
  variant?: 'form' | 'narrow';
  hideTitle?: boolean;
}) {
  return (
    <D.Root open onOpenChange={(o) => !o && onClose()}>
      <D.Portal>
        <D.Overlay className="overlay-bg" />
        <D.Content
          className={clsx('overlay', variant)}
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            // Fokus ke isian yang ditandai autoFocus, bukan ke tombol tutup.
            e.preventDefault();
            const el = e.currentTarget as HTMLElement;
            const target = el.querySelector<HTMLElement>('[data-autofocus]') ?? el;
            target.focus({ preventScroll: true });
          }}
          tabIndex={-1}
          style={{ outline: 'none' }}
        >
          <div className="overlay-top">
            {eyebrow ? (
              <span className="eyebrow">{eyebrow}</span>
            ) : (
              <D.Title className="h2" style={{ margin: 0, fontSize: 20, lineHeight: '28px', fontWeight: 600 }}>
                {title}
              </D.Title>
            )}
            <D.Close className="icon-btn" aria-label="Tutup">
              <X size={16} />
            </D.Close>
          </div>
          {eyebrow && hideTitle && <D.Title className="sr-only">{title}</D.Title>}
          {eyebrow && !hideTitle && (
            <D.Title className="h2" style={{ margin: '-12px 0 0', fontSize: 20, lineHeight: '28px', fontWeight: 600 }}>
              {title}
            </D.Title>
          )}
          {children}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/** Dialog konfirmasi untuk aksi yang tidak bisa diurungkan. */
export function Confirm({
  title,
  body,
  confirmLabel,
  danger,
  pending,
  error,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  pending?: boolean;
  error?: { error: string; details?: string[] } | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <D.Root open onOpenChange={(o) => !o && onCancel()}>
      <D.Portal>
        <D.Overlay className="overlay-bg" style={{ zIndex: 55 }} />
        <D.Content className="overlay narrow" style={{ zIndex: 56, top: 120, gap: 16 }} aria-describedby={undefined}>
          <D.Title style={{ margin: 0, fontSize: 16, lineHeight: '24px', fontWeight: 600 }}>{title}</D.Title>
          <div style={{ color: 'var(--text)' }}>{body}</div>
          {error && <FormError error={error} />}
          <div className="form-actions">
            <button type="button" className="btn" onClick={onCancel}>
              Batal
            </button>
            <button
              type="button"
              className={danger ? 'btn btn-danger-solid' : 'btn btn-primary'}
              disabled={pending}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

export function FormError({ error }: { error: { error: string; details?: string[] } }) {
  return (
    <div className="form-error" role="alert">
      {error.error}
      {error.details?.length ? (
        <ul>
          {error.details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
