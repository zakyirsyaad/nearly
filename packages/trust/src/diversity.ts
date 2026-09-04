import type { TrustEdge } from "./types";

/**
 * Lantai pengali diversitas.
 *
 * Tanpa lantai ini, pengguna baru yang jujur — satu koneksi, satu tempat —
 * mendapat entropi nol dan skor nol, PERSIS seperti bot. Dia memang harus
 * rendah, tapi tidak boleh difitnah.
 */
export const DIVERSITY_FLOOR = 0.15;

export const TIME_BUCKET_MS = 86_400_000;

/** ~40 km. Kita tidak tahu nama kotanya, jadi ini disebut "wilayah". */
export const REGION_PREFIX = 4;

export function regionOf(occasionId: string): string {
  return occasionId.split(":")[0]!.slice(0, REGION_PREFIX);
}

/**
 * Entropi Shannon dinormalisasi oleh ln(TOTAL PENGAMATAN), bukan ln(jumlah ember).
 *
 * Bedanya menentukan arti seluruh faktor diversitas. Dengan ln(jumlah ember),
 * yang terukur adalah KERATAAN saja: 50 koneksi merata di 2 occasion bernilai
 * 1.0, sama persis dengan 50 koneksi merata di 10 occasion. Dengan ln(total),
 * yang terukur adalah KELUASAN: 2 occasion memberi 0.177, 10 occasion memberi
 * 0.589, dan nilai 1.0 hanya tercapai kalau tiap koneksi terjadi di occasion
 * yang berbeda.
 *
 * Aturan inti spec §8 menuntut yang kedua. Angka 0.589 itu pun tertulis di
 * spec fase §4.3 dan dikunci sebuah test.
 */
export function normalizedEntropy(counts: number[]): number {
  const total = counts.reduce((s, c) => s + c, 0);
  if (total <= 1 || counts.length <= 1) return 0;

  let h = 0;
  for (const c of counts) {
    if (c <= 0) continue;
    const p = c / total;
    h -= p * Math.log(p);
  }
  return Math.min(1, h / Math.log(total));
}

export function neighborsOf(edges: TrustEdge[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  const add = (x: string, y: string) => {
    let s = map.get(x);
    if (!s) {
      s = new Set();
      map.set(x, s);
    }
    s.add(y);
  };
  for (const e of edges) {
    if (e.blocked) continue;
    add(e.a.toLowerCase(), e.b.toLowerCase());
    add(e.b.toLowerCase(), e.a.toLowerCase());
  }
  return map;
}

/** Porsi pasangan tetangga yang juga saling terkoneksi. */
export function clusteringCoefficient(
  address: string,
  neighbors: Map<string, Set<string>>,
): number {
  const own = neighbors.get(address);
  if (!own || own.size < 2) return 0;

  const list = [...own].sort();
  let links = 0;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (neighbors.get(list[i]!)?.has(list[j]!)) links++;
    }
  }
  const possible = (list.length * (list.length - 1)) / 2;
  return links / possible;
}

/**
 * D = H(occasion) x H(waktu) x (1 - clustering), lalu diangkat dari lantai.
 *
 * Ini sifat SATU ORANG (seberapa tersebar pertemuannya), bukan sifat satu
 * hubungan — karena itu diterapkan setelah PageRank, bukan sebagai bobot edge
 * (spec fase §4.6).
 */
export function diversityMultiplier(
  address: string,
  edges: TrustEdge[],
  neighbors: Map<string, Set<string>>,
): number {
  const mine = edges.filter(
    (e) => !e.blocked && (e.a.toLowerCase() === address || e.b.toLowerCase() === address),
  );
  if (mine.length === 0) return DIVERSITY_FLOOR;

  const byOccasion = new Map<string, number>();
  const byTime = new Map<number, number>();
  for (const e of mine) {
    byOccasion.set(e.occasionId, (byOccasion.get(e.occasionId) ?? 0) + 1);
    const bucket = Math.floor(e.atMs / TIME_BUCKET_MS);
    byTime.set(bucket, (byTime.get(bucket) ?? 0) + 1);
  }

  const d =
    normalizedEntropy([...byOccasion.values()]) *
    normalizedEntropy([...byTime.values()]) *
    (1 - clusteringCoefficient(address, neighbors));

  return DIVERSITY_FLOOR + (1 - DIVERSITY_FLOOR) * Math.max(0, Math.min(1, d));
}
