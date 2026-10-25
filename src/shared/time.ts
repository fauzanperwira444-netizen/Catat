// Tanggal kalender di Catat selalu berupa teks YYYY-MM-DD dalam zona waktu Catat.
// Semua perhitungan "hari ini" lewat modul ini supaya bisa diatur saat pengujian.
import { timeZone } from './config';

export type DateStr = string; // YYYY-MM-DD

let fixedNow: Date | null = null;

/** Hanya untuk pengujian: kunci jam sistem Catat pada waktu tertentu. */
export function setNowForTesting(d: Date | null) {
  fixedNow = d;
}

export function now(): Date {
  return fixedNow ? new Date(fixedNow) : new Date();
}

function parts(d: Date) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZone(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** Tanggal hari ini di zona waktu Catat. */
export function today(): DateStr {
  return parts(now()).date;
}

/** Jam sekarang (HH:mm) di zona waktu Catat. */
export function currentTime(): string {
  return parts(now()).time;
}

/** Tanggal dan jam (HH:mm) dari sebuah waktu kejadian, di zona waktu Catat. */
export function localParts(d: Date) {
  return parts(d);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isDateStr(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function isTimeStr(s: string): boolean {
  return TIME_RE.test(s);
}

function toUtc(s: DateStr): Date {
  return new Date(`${s}T00:00:00Z`);
}

export function addDays(s: DateStr, n: number): DateStr {
  const d = toUtc(s);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Selisih hari b - a. */
export function diffDays(a: DateStr, b: DateStr): number {
  return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / 86_400_000);
}

/** 0 = Senin … 6 = Minggu */
export function weekdayIndex(s: DateStr): number {
  return (toUtc(s).getUTCDay() + 6) % 7;
}

export function startOfWeek(s: DateStr): DateStr {
  return addDays(s, -weekdayIndex(s));
}

export function startOfMonth(s: DateStr): DateStr {
  return `${s.slice(0, 7)}-01`;
}

export function addMonths(s: DateStr, n: number): DateStr {
  const [y, m] = s.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, '0')}-01`;
}

export function daysInMonth(s: DateStr): number {
  return diffDays(startOfMonth(s), addMonths(s, 1));
}

export function rangeDays(from: DateStr, to: DateStr): DateStr[] {
  const out: DateStr[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

// ---- Format tampilan (bahasa Indonesia) ----

export const DAY_SHORT = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
export const DAY_LONG = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
export const MONTH_LONG = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

function ymd(s: DateStr) {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m, d };
}

/** "Sen, 26 Okt" */
export function fmtShort(s: DateStr): string {
  const { m, d } = ymd(s);
  return `${DAY_SHORT[weekdayIndex(s)]}, ${d} ${MONTH_SHORT[m - 1]}`;
}

/** "26 Okt" */
export function fmtDayMonth(s: DateStr): string {
  const { m, d } = ymd(s);
  return `${d} ${MONTH_SHORT[m - 1]}`;
}

/** "Senin, 26 Oktober 2026" */
export function fmtLong(s: DateStr): string {
  const { y, m, d } = ymd(s);
  return `${DAY_LONG[weekdayIndex(s)]}, ${d} ${MONTH_LONG[m - 1]} ${y}`;
}

/** "Oktober 2026" */
export function fmtMonth(s: DateStr): string {
  const { y, m } = ymd(s);
  return `${MONTH_LONG[m - 1]} ${y}`;
}

/** "1 – 16 Okt" atau "17 Okt – 2 Nov" */
export function fmtRange(a: DateStr, b: DateStr): string {
  const A = ymd(a);
  const B = ymd(b);
  if (A.y === B.y && A.m === B.m) return `${A.d} – ${B.d} ${MONTH_SHORT[B.m - 1]}`;
  return `${fmtDayMonth(a)} – ${fmtDayMonth(b)}`;
}

/** "23.59" */
export function fmtTime(t: string | null | undefined): string {
  return t ? t.replace(':', '.') : '';
}

/**
 * Label deadline relatif: "Hari ini 23.59", "Besok", "Kamis 10.00",
 * lalu tanggal lengkap untuk lebih dari 7 hari, dan "Telat n hari".
 */
export function fmtDeadline(date: DateStr, time: string | null, ref: DateStr = today()): string {
  const diff = diffDays(ref, date);
  const t = time ? ` ${fmtTime(time)}` : '';
  if (diff < 0) return `Telat ${-diff} hari`;
  if (diff === 0) return `Hari ini${t}`;
  if (diff === 1) return `Besok${t}`;
  if (diff <= 6) return `${DAY_LONG[weekdayIndex(date)]}${t}`;
  return `${fmtShort(date)}${t}`;
}

/** "07.42" dari waktu kejadian */
export function fmtClock(d: Date): string {
  return fmtTime(localParts(d).time);
}
