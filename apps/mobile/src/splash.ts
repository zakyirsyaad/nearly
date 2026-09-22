import type { KeadaanDompet } from "./dompet/konteks-dompet";

/**
 * Spec desain UI §3.5: splash disembunyikan setelah font selesai — termuat
 * ATAU gagal dimuat (font yang gagal jatuh ke font sistem, §11 batas #2) —
 * DAN keadaan dompet bukan "memuat". Spinner "memuat" gerbang dompet
 * digantikan splash.
 */
export function bolehSembunyikanSplash(fontSelesai: boolean, keadaanDompet: KeadaanDompet): boolean {
  return fontSelesai && keadaanDompet !== "memuat";
}
