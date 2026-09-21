/**
 * 12 kata pemulihan hanya boleh terbuka selagi aplikasi AKTIF di depan
 * (review B1 M3). iOS berpindah ke "inactive" lebih dulu saat app switcher
 * dibuka, dan cuplikan layarnya diambil sebelum "background" — jadi menunggu
 * "background" berarti cuplikannya sudah memuat 12 kata. Harga yang diterima:
 * menarik Control Center juga menutup kata.
 *
 * Murni (tanpa impor react-native), supaya bisa diuji tanpa modul native.
 */
export function kataHarusDitutup(keadaanApp: string): boolean {
  return keadaanApp !== "active";
}
