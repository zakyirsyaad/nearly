import type { Address } from "viem";
import type { DecayFn, TrustGraph } from "./types";

/** Bobot edge ke arah orang yang dijamin (spec fase §5). */
export const VOUCH_EDGE_WEIGHT = 3;

/** from -> to -> bobot. Kunci selalu alamat huruf kecil. */
export type DirectedGraph = Map<string, Map<string, number>>;

const lower = (a: Address): string => a.toLowerCase();

export function vouchKey(from: Address, to: Address): string {
  return `${lower(from)}->${lower(to)}`;
}

export const noDecay: DecayFn = () => 1;

/** Peluruhan eksponensial. Dibangun & diuji, tapi tidak dipakai di Fase 2. */
export function halfLifeDecay(halfLifeMs: number): DecayFn {
  return (ageMs) => Math.pow(2, -Math.max(0, ageMs) / halfLifeMs);
}

/** Terurut supaya seluruh perhitungan deterministik (Global Constraints). */
export function allAddresses(g: TrustGraph): string[] {
  const set = new Set<string>();
  for (const e of g.edges) {
    set.add(lower(e.a));
    set.add(lower(e.b));
  }
  for (const s of g.seeds) set.add(lower(s.address));
  return [...set].sort();
}

function put(graph: DirectedGraph, from: string, to: string, weight: number): void {
  let row = graph.get(from);
  if (!row) {
    row = new Map();
    graph.set(from, row);
  }
  row.set(to, weight);
}

/**
 * Merakit graf berarah dari pertemuan fisik (dua arah) + vouch (satu arah).
 *
 * Dua pencabutan penting terjadi di sini, bukan di pagerank:
 * - edge `blocked` dibuang sepenuhnya (Fase 4)
 * - alamat ter-slash kehilangan seluruh aliran KELUAR, sehingga tidak lagi
 *   menghantar kepercayaan ke siapa pun. Aliran MASUK dibiarkan karena
 *   pertemuannya memang terjadi — itu fakta, dan fakta tidak dihapus.
 */
export function buildDirectedGraph(
  g: TrustGraph,
  opts: { decay?: DecayFn } = {},
): DirectedGraph {
  const decay = opts.decay ?? noDecay;
  const slashed = new Set(g.slashed.map(lower));

  const vouched = new Set<string>();
  const connected = new Set<string>();
  for (const e of g.edges) {
    if (e.blocked) continue;
    connected.add(`${lower(e.a)}->${lower(e.b)}`);
    connected.add(`${lower(e.b)}->${lower(e.a)}`);
  }
  // Vouch tanpa koneksi fisik tidak berarti apa-apa. Kontrak menolaknya juga,
  // tapi data lama atau bug relayer tidak boleh bisa menyelundupkannya.
  for (const v of g.vouches) {
    const k = vouchKey(v.from, v.to);
    if (connected.has(k)) vouched.add(k);
  }

  const graph: DirectedGraph = new Map();
  for (const e of g.edges) {
    if (e.blocked) continue;
    const a = lower(e.a);
    const b = lower(e.b);
    const base = decay(Math.max(0, g.nowMs - e.atMs));

    if (!slashed.has(a)) {
      put(graph, a, b, base * (vouched.has(`${a}->${b}`) ? VOUCH_EDGE_WEIGHT : 1));
    }
    if (!slashed.has(b)) {
      put(graph, b, a, base * (vouched.has(`${b}->${a}`) ? VOUCH_EDGE_WEIGHT : 1));
    }
  }
  return graph;
}
