/** Zona waktu Catat. Default Asia/Jakarta (NFR-14), bisa diubah lewat konfigurasi. */
export function timeZone(): string {
  return (typeof process !== 'undefined' && process.env.CATAT_TIMEZONE?.trim()) || 'Asia/Jakarta';
}
