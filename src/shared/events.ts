// Event domain sederhana di dalam aplikasi.
// Modul memancarkan event setelah perubahan penting. Fitur masa depan
// (notifikasi, statistik, sinkronisasi) cukup mendengarkan event ini.

export type DomainEvent =
  | { type: 'TaskSelesai'; taskId: string }
  | { type: 'TaskDibukaKembali'; taskId: string }
  | { type: 'TaskDibatalkan'; taskId: string }
  | { type: 'TodoDikunci'; date: string; auto: boolean }
  | { type: 'ProjekDibatalkan'; projectId: string }
  | { type: 'ProjekSelesai'; projectId: string }
  | { type: 'SesiDibatalkan'; sessionId: string }
  | { type: 'HariBerganti'; lockedDates: string[] }
  | { type: 'DataDipulihkan' };

type Listener = (e: DomainEvent) => void | Promise<void>;

const listeners = new Set<Listener>();

export function onDomainEvent(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function emit(events: DomainEvent[]) {
  for (const e of events) {
    for (const fn of listeners) await fn(e);
  }
}
