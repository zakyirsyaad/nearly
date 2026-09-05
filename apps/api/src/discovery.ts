import type { DiscoveryRow } from "./ports";

export type DiscoveryCandidate = DiscoveryRow & {
  hostConnections: number;
  hostSlashed: boolean;
};

/**
 * Spec §8, dan ini bagian yang paling gampang salah dibaca.
 *
 * Spec induk §7.7 melarang membatasi SIAPA yang boleh mengadakan event, karena
 * skor tidak boleh dipakai mengunci akses. Yang boleh diperoleh adalah
 * perhatian. Karena itu penyaringnya hanya dua, dan keduanya bukan soal
 * populer atau tidak:
 *
 * 1. Host ter-slash — sudah melewati peninjauan manusia atas laporan penipuan.
 * 2. Host tanpa koneksi — belum pernah bertemu siapa pun. Bot bisa menekan
 *    tombol; bot tidak bisa membangun graf.
 *
 * Sisanya DIURUTKAN, tidak disembunyikan. Menyembunyikan tier Baru akan
 * mengosongkan halaman ini di graf kecil dan menghukum host tulus yang baru.
 *
 * Murni, supaya keputusan ini bisa diuji tanpa Supabase.
 */
export function rankDiscovery(
  candidates: DiscoveryCandidate[], nowSec: number,
): DiscoveryRow[] {
  return candidates
    .filter((c) => !c.hostSlashed && c.hostConnections > 0 && Number(c.endsAt) >= nowSec)
    .sort((a, b) => {
      if (b.hostScore !== a.hostScore) return b.hostScore - a.hostScore;
      return Number(a.startsAt) - Number(b.startsAt);
    })
    .map(({ hostConnections: _c, hostSlashed: _s, ...row }) => row);
}
