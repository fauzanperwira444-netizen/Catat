// FR-23: urutan task = tanggal deadline paling awal, lalu yang paling sulit,
// lalu jam. Task tanpa jam diperlakukan sebagai 23.59.
// FR-22: task telat diurutkan dari yang paling lama telat (tanggal paling awal),
// lalu yang paling sulit — aturan yang sama.

export type Sortable = { deadlineDate: string; deadlineTime: string | null; difficulty: number; name?: string };

export function compareTasks(a: Sortable, b: Sortable): number {
  if (a.deadlineDate !== b.deadlineDate) return a.deadlineDate < b.deadlineDate ? -1 : 1;
  if (a.difficulty !== b.difficulty) return b.difficulty - a.difficulty;
  const ta = a.deadlineTime ?? '23:59';
  const tb = b.deadlineTime ?? '23:59';
  if (ta !== tb) return ta < tb ? -1 : 1;
  return (a.name ?? '').localeCompare(b.name ?? '', 'id');
}

export function sortTasks<T extends Sortable>(list: T[]): T[] {
  return [...list].sort(compareTasks);
}
