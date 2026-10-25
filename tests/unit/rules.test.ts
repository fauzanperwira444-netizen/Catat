import { describe, expect, it } from 'vitest';
import { projectStatus, sessionNow, visibleSessionRange } from '@/modules/projects/rules';
import { laneBars, monthGrid } from '@/modules/calendar/service';
import { compareTasks } from '@/shared/sort';
import { addDays, diffDays, fmtDeadline, fmtRange, isDateStr, localParts, startOfWeek } from '@/shared/time';

const S = (startDate: string, endDate: string, canceledAt: Date | null = null, name = 's') => ({
  id: name + startDate,
  name,
  startDate,
  endDate,
  canceledAt,
});
const P = { completedEarlyAt: null, canceledAt: null };

describe('waktu', () => {
  it('menghitung tanggal dan selisih', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(diffDays('2026-10-25', '2026-10-28')).toBe(3);
    expect(startOfWeek('2026-10-25')).toBe('2026-10-19'); // Minggu → Senin sebelumnya
    expect(isDateStr('2026-02-30')).toBe(false);
  });
  it('memakai zona waktu Asia/Jakarta', () => {
    expect(localParts(new Date('2026-10-24T18:30:00Z'))).toEqual({ date: '2026-10-25', time: '01:30' });
  });
  it('memformat deadline relatif', () => {
    expect(fmtDeadline('2026-10-25', '23:59', '2026-10-25')).toBe('Hari ini 23.59');
    expect(fmtDeadline('2026-10-26', null, '2026-10-25')).toBe('Besok');
    expect(fmtDeadline('2026-10-29', '10:00', '2026-10-25')).toBe('Kamis 10.00');
    expect(fmtDeadline('2026-10-22', null, '2026-10-25')).toBe('Telat 3 hari');
    expect(fmtRange('2026-10-01', '2026-10-16')).toBe('1 – 16 Okt');
  });
});

describe('urutan task (FR-23)', () => {
  it('deadline paling awal, lalu paling sulit, lalu jam', () => {
    const list = [
      { name: 'c', deadlineDate: '2026-10-26', deadlineTime: null, difficulty: 5 },
      { name: 'b', deadlineDate: '2026-10-25', deadlineTime: null, difficulty: 2 },
      { name: 'a', deadlineDate: '2026-10-25', deadlineTime: '10:00', difficulty: 4 },
      { name: 'd', deadlineDate: '2026-10-25', deadlineTime: '09:00', difficulty: 2 },
    ].sort(compareTasks);
    expect(list.map((t) => t.name)).toEqual(['a', 'd', 'b', 'c']);
  });
});

describe('status projek (FR-03)', () => {
  const ss = [S('2026-10-01', '2026-10-16'), S('2026-10-20', '2026-11-05')];
  it.each([
    [[], 0, '2026-10-25', 'belum_dijadwalkan'],
    [ss, 0, '2026-09-30', 'belum_mulai'],
    [ss, 0, '2026-10-18', 'berjalan'], // jeda antar sesi tetap berjalan
    [ss, 2, '2026-11-06', 'melewati_jadwal'],
    [ss, 0, '2026-11-06', 'selesai'],
  ] as const)('%#', (sessions, active, today, expected) => {
    expect(projectStatus(P, [...sessions], active, today)).toBe(expected);
  });
  it('sesi batal tidak dihitung, batal dan selesai lebih cepat menang', () => {
    expect(projectStatus(P, [S('2026-10-01', '2026-10-05', new Date())], 0, '2026-10-03')).toBe('belum_dijadwalkan');
    expect(projectStatus({ ...P, canceledAt: new Date() }, ss, 0, '2026-10-10')).toBe('batal');
    expect(projectStatus({ ...P, completedEarlyAt: new Date() }, ss, 0, '2026-10-10')).toBe('selesai');
  });
  it('sesi sekarang dan berikutnya', () => {
    expect(sessionNow(ss, '2026-10-18').current).toBeUndefined();
    expect(sessionNow(ss, '2026-10-18').next?.startDate).toBe('2026-10-20');
    expect(sessionNow(ss, '2026-10-21').current?.startDate).toBe('2026-10-20');
  });
  it('garis sesi batal dipotong di tanggal batal', () => {
    const cut = new Date('2026-10-10T05:00:00+07:00');
    expect(visibleSessionRange(S('2026-10-01', '2026-10-16', cut), P)).toEqual({
      startDate: '2026-10-01',
      endDate: '2026-10-10',
    });
    expect(visibleSessionRange(S('2026-10-20', '2026-10-30'), { ...P, canceledAt: cut })).toBeNull();
  });
});

describe('kalender', () => {
  it('grid bulan mulai Senin', () => {
    const g = monthGrid('2026-10-01');
    expect(g.from).toBe('2026-09-28');
    expect(g.to).toBe('2026-11-01');
    expect(g.weeks).toHaveLength(5);
  });
  it('garis sesi per lajur projek', () => {
    const bar = (projectId: string, startDate: string, endDate: string) => ({
      sessionId: projectId + startDate,
      projectId,
      projectName: projectId,
      sessionName: 's',
      color: 'blue',
      startDate,
      endDate,
      canceled: false,
    });
    const lanes = laneBars(
      [bar('a', '2026-10-01', '2026-10-16'), bar('a', '2026-10-17', '2026-10-30'), bar('b', '2026-10-15', '2026-10-25')],
      '2026-10-12',
    );
    expect(lanes).toHaveLength(2);
    expect(lanes[0].map((b) => [b.col, b.span])).toEqual([
      [1, 5],
      [6, 2],
    ]);
    expect(lanes[1][0]).toMatchObject({ col: 4, span: 4, continuesAfter: true });
  });
});
