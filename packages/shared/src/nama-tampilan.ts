/**
 * Aturan nama tampilan (spec 4b+5 §7.2). Satu fungsi murni, dipakai API dan
 * layar mobile, supaya kedua sisi tidak berselisih soal nama yang sah.
 *
 * Nama TIDAK unik (spec induk §9.2) — alamat selalu tampil di sebelahnya.
 */
export const MAKS_NAMA_TAMPILAN = 32;

/**
 * Rentang code point kategori Unicode `Cc` (kontrol) dan `Cf` (format),
 * Unicode 17.0 — termasuk penanda arah teks (U+202A–U+202E, U+2066–U+2069)
 * dan karakter lebar-nol (U+200B–U+200F). Karakter itu bisa membalik urutan
 * tampilan di sebelah alamat dan dipakai menyamar.
 *
 * Tabel eksplisit, BUKAN `/\p{Cc}|\p{Cf}/u`: fungsi ini juga jalan di Hermes
 * (Expo Go), dan regex yang tidak didukung mesin JS di HP gagal saat bundel
 * dimuat — seluruh aplikasi mati, bukan hanya layar ini. Tes
 * `nama-tampilan.test.ts` membandingkan tabel ini dengan `\p{Cc}|\p{Cf}` milik
 * Node untuk SETIAP code point, jadi tabel yang tertinggal dari Unicode
 * versi Node akan memerahkan tes.
 */
export const RENTANG_KONTROL_FORMAT: readonly (readonly [number, number])[] = [
  [0x0, 0x1f], [0x7f, 0x9f], [0xad, 0xad], [0x600, 0x605], [0x61c, 0x61c],
  [0x6dd, 0x6dd], [0x70f, 0x70f], [0x890, 0x891], [0x8e2, 0x8e2], [0x180e, 0x180e],
  [0x200b, 0x200f], [0x202a, 0x202e], [0x2060, 0x2064], [0x2066, 0x206f],
  [0xfeff, 0xfeff], [0xfff9, 0xfffb], [0x110bd, 0x110bd], [0x110cd, 0x110cd],
  [0x13430, 0x1343f], [0x1bca0, 0x1bca3], [0x1d173, 0x1d17a], [0xe0001, 0xe0001],
  [0xe0020, 0xe007f],
];

export function karakterTerlarang(codePoint: number): boolean {
  // Surrogate tunggal (U+D800–U+DFFF) tidak bisa disimpan Postgres sebagai
  // teks; tanpa penolakan ini ia lolos ke upsert dan menjadi 500.
  if (codePoint >= 0xd800 && codePoint <= 0xdfff) return true;
  return RENTANG_KONTROL_FORMAT.some(([dari, sampai]) => codePoint >= dari && codePoint <= sampai);
}

/** Panjang nama SETELAH trim, dalam code point — emoji 👍 dihitung satu. */
export function panjangNamaTampilan(nama: string): number {
  return [...nama.trim()].length;
}

export type HasilNamaTampilan =
  | { ok: true; nama: string }
  | { ok: false; alasan: "terlalu_panjang" | "karakter_terlarang" };

/** Nama kosong SAH — itu cara menghapus nama. */
export function periksaNamaTampilan(masukan: string): HasilNamaTampilan {
  const nama = masukan.trim();
  for (const ch of nama) {
    if (karakterTerlarang(ch.codePointAt(0)!)) return { ok: false, alasan: "karakter_terlarang" };
  }
  if ([...nama].length > MAKS_NAMA_TAMPILAN) return { ok: false, alasan: "terlalu_panjang" };
  return { ok: true, nama };
}
