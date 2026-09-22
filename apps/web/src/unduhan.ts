/**
 * Tautan unduh APK Android dari VITE_APK_URL (spec distribusi D4, D10).
 * Hanya https: pengunjung memasang berkas ini di HP-nya, jadi tautan yang bisa
 * disadap di jalan tidak pernah ditampilkan. null = bagian unduh disembunyikan.
 */
export function tautanApk(nilai: string | undefined = import.meta.env.VITE_APK_URL): string | null {
  if (!nilai) return null;
  try {
    const url = new URL(nilai);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
