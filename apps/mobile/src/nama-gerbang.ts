/**
 * Gerbang nama wajib (keputusan pemilik 2026-09-24): setelah dompet siap,
 * aplikasi tidak bisa dipakai sebelum nama tampilan diisi — baik dompet yang
 * baru dibuat maupun yang diimpor.
 *
 * Murni, supaya bisa diuji tanpa React Native. Dua aturan yang mudah salah
 * kalau ditulis inline di layout:
 *
 * 1. **Gagal-terbuka.** `nama === undefined` berarti aplikasi BELUM tahu —
 *    permintaan profil sedang jalan, atau gagal karena jaringan. Dalam
 *    keadaan itu gerbang TIDAK boleh menutup: mengunci orang di luar
 *    aplikasinya sendiri karena sinyal jelek jauh lebih buruk daripada satu
 *    sesi tanpa nama. Yang ditutup hanya saat server benar-benar bilang
 *    namanya kosong.
 * 2. **Tanpa dompet, tidak ada gerbang nama.** Layar Mulai duluan; menanyakan
 *    nama sebelum ada dompet berarti tidak ada yang bisa menandatangani
 *    penyimpanannya.
 */
export function perluIsiNama(punyaDompet: boolean, nama: string | null | undefined): boolean {
  if (!punyaDompet) return false;
  if (nama === undefined) return false;
  return (nama ?? "").trim() === "";
}
