// Aturan murni projek dan sesi (tanpa database), mudah diuji.
import { localParts, type DateStr } from '@/shared/time';

export type ProjectStatus =
  | 'belum_dijadwalkan'
  | 'belum_mulai'
  | 'berjalan'
  | 'melewati_jadwal'
  | 'selesai'
  | 'batal';

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  belum_dijadwalkan: 'Belum dijadwalkan',
  belum_mulai: 'Belum mulai',
  berjalan: 'Berjalan',
  melewati_jadwal: 'Melewati jadwal',
  selesai: 'Selesai',
  batal: 'Batal',
};

export type SessionLike = {
  id: string;
  name: string;
  startDate: DateStr;
  endDate: DateStr;
  canceledAt: Date | null;
};

export type ProjectLike = { completedEarlyAt: Date | null; canceledAt: Date | null };

export function liveSessions<S extends SessionLike>(sessions: S[]): S[] {
  return sessions.filter((s) => !s.canceledAt).sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
}

export function projectRange(sessions: SessionLike[]): { start: DateStr; end: DateStr } | null {
  const live = liveSessions(sessions);
  if (!live.length) return null;
  return {
    start: live[0].startDate,
    end: live.reduce((m, s) => (s.endDate > m ? s.endDate : m), live[0].endDate),
  };
}

/**
 * FR-03: status projek dihitung dari tanggal, bukan disimpan.
 * Yang disimpan hanya akibat aksi pengguna (batal, selesai lebih cepat).
 */
export function projectStatus(
  p: ProjectLike,
  sessions: SessionLike[],
  activeTaskCount: number,
  today: DateStr,
): ProjectStatus {
  if (p.canceledAt) return 'batal';
  if (p.completedEarlyAt) return 'selesai';
  const range = projectRange(sessions);
  if (!range) return 'belum_dijadwalkan';
  if (today < range.start) return 'belum_mulai';
  if (today <= range.end) return 'berjalan';
  return activeTaskCount > 0 ? 'melewati_jadwal' : 'selesai';
}

/** Projek yang masih "memegang" warnanya: belum selesai dan belum batal. */
export function holdsColor(status: ProjectStatus): boolean {
  return status !== 'selesai' && status !== 'batal';
}

/** Sesi yang sedang dilalui, atau sesi berikutnya bila sedang jeda (FR-20). */
export function sessionNow<S extends SessionLike>(sessions: S[], today: DateStr): { current?: S; next?: S } {
  const live = liveSessions(sessions);
  const current = live.find((s) => s.startDate <= today && today <= s.endDate);
  const next = live.find((s) => s.startDate > today);
  return { current, next };
}

export function sessionStatus(s: SessionLike, today: DateStr): 'batal' | 'selesai' | 'berjalan' | 'belum_mulai' {
  if (s.canceledAt) return 'batal';
  if (today > s.endDate) return 'selesai';
  if (today >= s.startDate) return 'berjalan';
  return 'belum_mulai';
}

export function overlaps(a: { startDate: DateStr; endDate: DateStr }, b: { startDate: DateStr; endDate: DateStr }) {
  return a.startDate <= b.endDate && b.startDate <= a.endDate;
}

/**
 * Rentang garis sesi yang tampil di kalender. Sesi atau projek yang dibatalkan
 * hanya tampil sampai tanggal pembatalannya (FR-05, FR-10).
 */
export function visibleSessionRange(
  s: SessionLike,
  project: ProjectLike,
): { startDate: DateStr; endDate: DateStr } | null {
  const cuts = [s.canceledAt, project.canceledAt].filter(Boolean) as Date[];
  if (!cuts.length) return { startDate: s.startDate, endDate: s.endDate };
  const cut = cuts.map((d) => localParts(d).date).sort()[0];
  if (cut < s.startDate) return null;
  return { startDate: s.startDate, endDate: cut < s.endDate ? cut : s.endDate };
}
