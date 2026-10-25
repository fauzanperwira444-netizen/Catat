/**
 * Kesalahan aturan bisnis. Pesannya ditampilkan langsung ke pengguna,
 * jadi selalu menyebut apa yang salah dan apa yang perlu dilakukan.
 */
export class DomainError extends Error {
  constructor(
    message: string,
    /** Nama kolom form yang bermasalah, bila ada. */
    public readonly field?: string,
    /** Rincian tambahan, misalnya daftar task yang menghalangi. */
    public readonly details?: string[],
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export function assert(cond: unknown, message: string, field?: string, details?: string[]): asserts cond {
  if (!cond) throw new DomainError(message, field, details);
}
