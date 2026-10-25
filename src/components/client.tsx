'use client';
// Infrastruktur klien: navigasi overlay lewat URL, toast, dan pemanggil aksi.
import { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ActionResult } from '@/server/action';

export const OVERLAY_KEYS = ['o', 'id', 'sesi', 'projek', 'hari', 'tanggal'];

export function useOverlay() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const base = useCallback(() => {
    const p = new URLSearchParams(sp.toString());
    for (const k of OVERLAY_KEYS) p.delete(k);
    return p;
  }, [sp]);
  const open = useCallback(
    (params: Record<string, string>) => {
      const p = base();
      for (const [k, v] of Object.entries(params)) p.set(k, v);
      router.push(`${pathname}?${p.toString()}`, { scroll: false });
    },
    [base, pathname, router],
  );
  const close = useCallback(() => {
    const p = base().toString();
    router.push(p ? `${pathname}?${p}` : pathname, { scroll: false });
  }, [base, pathname, router]);
  /** Ganti parameter halaman (bukan overlay), mis. filter. */
  const setParams = useCallback(
    (params: Record<string, string | null>) => {
      const p = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(params)) {
        if (v === null || v === '') p.delete(k);
        else p.set(k, v);
      }
      const s = p.toString();
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    },
    [pathname, router, sp],
  );
  return { open, close, setParams };
}

// ---------- Toast ----------
const ToastCtx = createContext<(msg: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((m: string) => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 2600);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && (
        <div className="toast" role="status" aria-live="polite">
          {msg}
        </div>
      )}
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}

// ---------- Aksi ----------
type Failure = Extract<ActionResult, { ok: false }>;

/** Jalankan Server Action dengan status pending, toast sukses, dan galat tersimpan. */
export function useAction() {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [error, setError] = useState<Failure | null>(null);
  const run = useCallback(
    <T,>(fn: () => Promise<ActionResult<T>>, onOk?: (r: Extract<ActionResult<T>, { ok: true }>) => void) =>
      new Promise<ActionResult<T>>((resolve) => {
        start(async () => {
          const r = await fn();
          if (r.ok) {
            setError(null);
            if (r.message) toast(r.message);
            onOk?.(r);
          } else {
            setError(r);
            if (!r.fields && !r.field) toast(r.error);
          }
          resolve(r);
        });
      }),
    [toast],
  );
  return { run, pending, error, setError };
}

/** Status buka/tutup dropdown kolom kanan, diingat di browser (default terbuka). */
export function useRemembered(key: string, initial = true) {
  const [open, setOpen] = useState(initial);
  useEffect(() => {
    try {
      const v = localStorage.getItem(`catat:${key}`);
      if (v !== null) setOpen(v === '1');
    } catch {
      /* abaikan */
    }
  }, [key]);
  const set = useCallback(
    (v: boolean) => {
      setOpen(v);
      try {
        localStorage.setItem(`catat:${key}`, v ? '1' : '0');
      } catch {
        /* abaikan */
      }
    },
    [key],
  );
  return [open, set] as const;
}
