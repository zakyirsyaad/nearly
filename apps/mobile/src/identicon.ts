/**
 * Pola avatar yang diturunkan dari alamat dompet (2026-09-24).
 *
 * Alasannya: nama SENGAJA tidak unik (spec induk §9.2 — "tidak ada yang bisa
 * mengklaim sebuah nama → handle-squatting mati sepenuhnya"), jadi dua orang
 * boleh sama-sama bernama "Andi". Yang membedakan mereka adalah alamat, dan
 * alamat sulit dibaca sekilas. Pola ini membuat perbedaan itu terlihat tanpa
 * membaca satu karakter heksadesimal pun — dan karena diturunkan dari alamat,
 * ia tidak bisa dipalsukan dengan mengganti nama.
 *
 * Murni dan tanpa warna: warnanya dipilih komponen dari token tema (penjaga
 * tema melarang literal warna di luar theme/colors.ts).
 */

export const SISI_IDENTICON = 5;

/** FNV-1a 32-bit. Cukup untuk sebaran visual, bukan untuk keamanan. */
function hash(teks: string): number {
  let h = 0x811c9dc5;
  for (const ch of teks) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Kisi 5×5 simetris cermin (kolom 0↔4, 1↔3), seperti identicon GitHub:
 * simetri membuat bentuknya terbaca sebagai "wajah", bukan derau.
 *
 * Alamat dinormalkan huruf kecil — `0xAb…` dan `0xab…` adalah orang yang sama,
 * dan API pun membandingkannya begitu.
 */
export function polaIdenticon(alamat: string): boolean[][] {
  const h = hash(alamat.trim().toLowerCase());
  const tengah = Math.ceil(SISI_IDENTICON / 2); // 3 kolom kiri, sisanya cermin

  return Array.from({ length: SISI_IDENTICON }, (_, baris) =>
    Array.from({ length: SISI_IDENTICON }, (_, kolom) => {
      const k = kolom < tengah ? kolom : SISI_IDENTICON - 1 - kolom;
      // Bit berbeda per sel; dikalikan bilangan ganjil supaya baris dan kolom
      // tidak menghasilkan pola bergaris.
      const geser = (baris * tengah + k) % 32;
      return (((h >>> geser) ^ Math.imul(baris + 1, 0x9e37) ^ Math.imul(k + 1, 0x85eb)) & 1) === 1;
    }));
}
