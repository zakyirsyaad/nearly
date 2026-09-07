import type { Address } from "viem";
import type { Kecocokan, Tanda } from "./ports";

/**
 * Kecocokan adalah IRISAN dua arah, dihitung bukan disimpan (spec §4.1).
 *
 * Konsekuensinya: kalau salah satu mencabut, kecocokannya lenyap dengan
 * sendirinya. Tidak ada tabel yang bisa desinkron dari tanda yang menjadi
 * sumbernya, dan tidak ada jalur kode yang bisa lupa menghapusnya.
 */
export function kecocokanDari(tandaOleh: Tanda[], tandaKe: Tanda[]): Kecocokan[] {
  const balik = new Map<string, number>();
  for (const t of tandaKe) balik.set(t.address.toLowerCase(), t.atMs);

  const keluar: Kecocokan[] = [];
  for (const t of tandaOleh) {
    const a = t.address.toLowerCase();
    const waktuBalik = balik.get(a);
    if (waktuBalik === undefined) continue;
    // Kecocokan baru ADA saat tanda KEDUA dibuat.
    keluar.push({ address: a as Address, sejakMs: Math.max(t.atMs, waktuBalik) });
  }

  // Pemecah seri deterministik — tanpa ini urutan dua kecocokan berwaktu sama
  // bergantung urutan masukan, dan tesnya jadi tidak bisa diandalkan.
  return keluar.sort((x, y) => (y.sejakMs - x.sejakMs) || x.address.localeCompare(y.address));
}

/** `null` berarti layar kecocokan belum pernah dibuka: semuanya baru. */
export function hitungBaru(kecocokan: Kecocokan[], dilihatAtMs: number | null): number {
  if (dilihatAtMs === null) return kecocokan.length;
  return kecocokan.filter((k) => k.sejakMs > dilihatAtMs).length;
}

/**
 * Berapa alamat di `a` yang juga ada di `b`. Dipakai loop event (spec §4.3).
 *
 * Duplikat di `a` dihitung SEKALI — kalau tidak, angka loop bisa melebihi
 * jumlah orang yang sebenarnya.
 */
export function irisan(a: readonly string[], b: readonly string[]): number {
  const himpunanB = new Set(b.map((x) => x.toLowerCase()));
  const sudah = new Set<string>();
  let n = 0;
  for (const x of a) {
    const l = x.toLowerCase();
    if (sudah.has(l)) continue;
    sudah.add(l);
    if (himpunanB.has(l)) n += 1;
  }
  return n;
}
