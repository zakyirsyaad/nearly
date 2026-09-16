/**
 * Label dan ukuran simpul di layar proyektor (spec 6 §6.3). Murni.
 */

export const PANJANG_NAMA_MAKS = 20;
export const BATAS_SIMPUL_BERLABEL = 300;
/** Skala zoom kanvas di atas ini dianggap "diperbesar": semua label digambar. */
export const SKALA_LABEL_PENUH = 2.5;

/**
 * `0x12ab…cdef` — enam karakter awal (termasuk `0x`), elipsis, empat karakter
 * akhir. Awal saja (`0x12ab…`) hanya 16 bit: alamat dengan awalan yang sama
 * bisa di-grind dalam hitungan detik untuk menyamar sebagai orang lain di
 * layar proyektor, padahal spec induk §9.2 bersandar pada alamat yang selalu
 * tampil di samping nama. Awal + akhir = 32 bit (spec 6 §6.3).
 */
export function alamatSingkat(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * `Budi · 0x12ab…cdef`, atau `0x12ab…cdef` saja bila nama kosong. TIDAK PERNAH
 * "Tanpa nama": di depan ruangan, label itu terbaca sebagai ejekan.
 * Nama dipotong per karakter Unicode (bukan per unit UTF-16), supaya emoji di
 * batas potongan tidak terbelah jadi kotak rusak.
 */
export function labelSimpul(displayName: string, address: string): string {
  const nama = Array.from(displayName.trim());
  if (nama.length === 0) return alamatSingkat(address);
  const tampil = nama.length > PANJANG_NAMA_MAKS ? `${nama.slice(0, PANJANG_NAMA_MAKS).join("")}…` : nama.join("");
  return `${tampil} · ${alamatSingkat(address)}`;
}

/**
 * Jari-jari simpul naik dengan tier. WARNA sengaja sama untuk semua tier:
 * warna tier terbaca sebagai peringkat di depan ruangan (spec 6 §6.3).
 */
const RADIUS: Record<string, number> = { Baru: 4, Dikenal: 5, Terpercaya: 6.5, Inti: 8 };
const RADIUS_BAWAAN = 4;

export function radiusSimpul(tierLabel: string): number {
  return RADIUS[tierLabel] ?? RADIUS_BAWAAN;
}

/** Semua label bila ≤ 300 simpul; di atas itu hanya simpul baru dan saat diperbesar. */
export function perluLabel(jumlahSimpul: number, simpulBaru: boolean, skala: number): boolean {
  return jumlahSimpul <= BATAS_SIMPUL_BERLABEL || simpulBaru || skala >= SKALA_LABEL_PENUH;
}
