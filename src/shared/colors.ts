// Palet warna projek (design system Catat). Merah dan hijau sengaja tidak
// tersedia supaya tidak tertukar dengan status telat dan selesai.

export const PROJECT_COLORS = ['brown', 'orange', 'yellow', 'blue', 'purple', 'pink'] as const;
export type ProjectColor = (typeof PROJECT_COLORS)[number];

export const COLOR_META: Record<ProjectColor, { name: string; mark: string; bg: string; text: string }> = {
  brown: { name: 'Cokelat', mark: '#9f6b53', bg: '#f4eeee', text: '#7d523e' },
  orange: { name: 'Oranye', mark: '#d9730d', bg: '#faebdd', text: '#9a4c06' },
  yellow: { name: 'Kuning', mark: '#b9851f', bg: '#fbf3db', text: '#7f5a10' },
  blue: { name: 'Biru', mark: '#337ea9', bg: '#e7f3f8', text: '#25607f' },
  purple: { name: 'Ungu', mark: '#9065b0', bg: '#f6f3f9', text: '#6d4888' },
  pink: { name: 'Pink', mark: '#c14c8a', bg: '#faf1f5', text: '#97336a' },
};

export function isProjectColor(c: string): c is ProjectColor {
  return (PROJECT_COLORS as readonly string[]).includes(c);
}

export function colorMeta(c: string) {
  return isProjectColor(c) ? COLOR_META[c] : COLOR_META.blue;
}
