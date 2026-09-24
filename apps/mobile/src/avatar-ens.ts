import { CONFIG } from "./config";

/**
 * URL avatar ENS lewat PROKSI API kita, bukan URL aslinya (2026-09-24).
 *
 * URL avatar ENS menunjuk ke server pemilik nama — gateway IPFS, host pribadi,
 * apa pun. Memuatnya langsung dari HP membocorkan IP setiap penonton ke host
 * itu, sehingga foto profil bisa berfungsi sebagai pelacak. Proksi di API yang
 * mengambilnya, dengan batas ukuran dan cache.
 *
 * Rute ini menjawab 404 untuk alamat tanpa avatar — itu keadaan NORMAL, dan
 * komponen avatar tinggal jatuh kembali ke pola identicon.
 */
export function urlAvatarEns(alamat: string): string {
  return `${CONFIG.apiUrl}/avatar/${alamat.trim().toLowerCase()}`;
}
