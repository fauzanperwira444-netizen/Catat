// Pengujian tidak pernah menyentuh data asli: zona waktu dikunci ke Asia/Jakarta.
export default function setup() {
  process.env.CATAT_TIMEZONE = 'Asia/Jakarta';
}
