import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="page">
      <div className="empty" style={{ maxWidth: 480 }}>
        Halaman atau data ini tidak ditemukan. Mungkin sudah dihapus atau tautannya salah.
        <Link className="btn" href="/">
          Kembali ke Home
        </Link>
      </div>
    </main>
  );
}
