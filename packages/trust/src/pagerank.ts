import type { Seed } from "./types";
import type { DirectedGraph } from "./graph";

/** Nilai standar PageRank. */
export const DAMPING = 0.85;

/**
 * Personalized PageRank.
 *
 * SATU DETAIL YANG MEMBUAT SELURUH KLAIM ANTI-SYBIL BENAR: vektor teleport
 * diisi SEED, bukan disebar rata ke semua node. Di PageRank biasa setiap node
 * mendapat jatah awal, dan gumpalan bot yang padat justru MENUMPUK peringkat.
 * Dengan teleport hanya ke seed, kepercayaan cuma bisa masuk lewat seed, jadi
 * gumpalan tanpa jalur ke seed konvergen ke ~0.
 *
 * Kalau seseorang mengganti baris teleport ini jadi 1/N, produknya kehilangan
 * premisnya dan test pertama di pagerank.test.ts akan gagal.
 */
export function personalizedPageRank(
  graph: DirectedGraph,
  seeds: Seed[],
  nodes: string[],
  opts: { damping?: number; tolerance?: number; maxIterations?: number } = {},
): Map<string, number> {
  const damping = opts.damping ?? DAMPING;
  const tolerance = opts.tolerance ?? 1e-9;
  const maxIterations = opts.maxIterations ?? 100;

  const scores = new Map<string, number>();
  for (const n of nodes) scores.set(n, 0);

  // Vektor teleport dari seed, dinormalisasi ke total 1.
  const teleport = new Map<string, number>();
  const seedTotal = seeds.reduce((s, x) => s + Math.max(0, x.weight), 0);
  if (seedTotal <= 0) return scores; // tanpa seed, tidak ada kepercayaan sama sekali
  for (const s of seeds) {
    const key = s.address.toLowerCase();
    if (!scores.has(key)) continue;
    teleport.set(key, (teleport.get(key) ?? 0) + Math.max(0, s.weight) / seedTotal);
  }

  // Bobot keluar per node, dihitung sekali di luar loop iterasi.
  const outWeight = new Map<string, number>();
  for (const [from, row] of graph) {
    let total = 0;
    for (const w of row.values()) total += w;
    outWeight.set(from, total);
  }

  let current = new Map(teleport);
  for (const n of nodes) if (!current.has(n)) current.set(n, 0);

  for (let iter = 0; iter < maxIterations; iter++) {
    const next = new Map<string, number>();
    for (const n of nodes) next.set(n, 0);

    // Massa dari node buntu (tidak punya edge keluar, mis. akun ter-slash)
    // dikembalikan ke seed, bukan disebar rata — menyebarnya rata akan
    // memberi hadiah gratis ke gumpalan sybil.
    let dangling = 0;
    for (const n of nodes) {
      const mass = current.get(n) ?? 0;
      const out = outWeight.get(n) ?? 0;
      if (out <= 0) {
        dangling += mass;
        continue;
      }
      for (const [to, w] of graph.get(n)!) {
        next.set(to, (next.get(to) ?? 0) + (mass * w) / out);
      }
    }

    let delta = 0;
    for (const n of nodes) {
      const t = teleport.get(n) ?? 0;
      const value = damping * ((next.get(n) ?? 0) + dangling * t) + (1 - damping) * t;
      delta += Math.abs(value - (current.get(n) ?? 0));
      next.set(n, value);
    }

    current = next;
    if (delta < tolerance) break;
  }

  return current;
}
