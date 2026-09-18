/**
 * Semua kalimat dompet yang terlihat pengguna, murni dan teruji
 * (test/teks-dompet.test.ts).
 */

export type RingkasDompet = { punyaMnemonik: boolean; sudahDicadangkan: boolean };

/** Spanduk beranda: hanya dompet dari 12 kata yang belum ditandai sudah dicatat. */
export function perluPengingatCadangan(d: RingkasDompet): boolean {
  return d.punyaMnemonik && !d.sudahDicadangkan;
}

export const TEKS_PENGINGAT_CADANGAN =
  "Catat 12 kata pemulihanmu. Tanpa itu, identitas dan koneksimu hilang kalau HP hilang atau aplikasi dihapus.";

export const PERINGATAN_MNEMONIK_UTAMA =
  "Jangan pakai 12 kata dompet utama yang menyimpan aset. Kunci dompet disimpan di HP ini, bukan di dompet perangkat keras.";

export const PERINGATAN_LIHAT_MNEMONIK =
  "Siapa pun yang melihat 12 kata ini bisa memakai identitasmu. Pastikan tidak ada orang atau kamera yang melihat layarmu.";

export const TEKS_TANPA_MNEMONIK =
  "Dompet ini diimpor dari kunci privat (khusus pengembangan) dan tidak punya 12 kata pemulihan.";

export function peringatanGantiDompet(d: RingkasDompet): string {
  if (!d.punyaMnemonik) {
    return "Dompet ini akan dihapus dari HP. Tanpa 12 kata pemulihan, kamu hanya bisa memakainya lagi dengan kunci privat yang sama.";
  }
  if (!d.sudahDicadangkan) {
    return "Kamu BELUM mencatat 12 kata pemulihan. Kalau dompet ini dihapus sekarang, identitas, koneksi, dan riwayat pesanmu hilang selamanya.";
  }
  return "Dompet ini akan dihapus dari HP. Identitas, koneksi, dan riwayat pesanmu hanya bisa kembali lewat 12 kata pemulihan yang sudah kamu catat.";
}

/** "1. kata", "2. kata", … — nomor membantu mencatat urutan dengan benar. */
export function kataBernomor(mnemonik: string): string[] {
  return mnemonik.split(" ").map((k, i) => `${i + 1}. ${k}`);
}

const PESAN_GALAT: Record<string, string> = {
  mnemonik_tidak_sah: "12 kata itu tidak sah. Periksa ejaan dan urutannya.",
  kunci_tidak_sah: "Kunci privat tidak sah.",
  hanya_pengembangan: "Impor kunci privat hanya tersedia di mode pengembangan.",
  dompet_sudah_ada: "HP ini sudah punya dompet. Hapus dulu lewat Ganti dompet.",
  entropi_lemah: "HP ini gagal menghasilkan angka acak, jadi dompet tidak dibuat. Tutup aplikasi lalu coba lagi.",
  dompet_tidak_konsisten: "Dompet gagal tersimpan dengan benar dan sudah dibatalkan. Coba lagi.",
  dompet_gagal_dihapus: "Dompet gagal dihapus dari HP. Coba lagi.",
  dompet_rusak:
    "Data dompet di HP ini tidak terbaca. Jangan hapus aplikasi dulu — coba lagi, dan siapkan 12 kata pemulihanmu.",
};

export function pesanGalatDompet(e: unknown): string {
  const kode = e instanceof Error ? e.message : "";
  return PESAN_GALAT[kode] ?? "Dompet gagal disiapkan. Coba lagi.";
}
