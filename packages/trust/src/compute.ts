import type { Address } from "viem";
import type { DecayFn, TrustEvidence, TrustGraph, TrustResult } from "./types";
import { allAddresses, buildDirectedGraph } from "./graph";
import { personalizedPageRank } from "./pagerank";
import { diversityMultiplier, neighborsOf, regionOf } from "./diversity";
import { detectOperators, FINGERPRINT_DEFAULTS } from "./fingerprint";
import { voucherPenalties } from "./slashing";
import { tierOf } from "./tier";

export type TrustOptions = {
  decay?: DecayFn;
  fingerprint?: Partial<typeof FINGERPRINT_DEFAULTS>;
  pagerank?: { damping?: number; tolerance?: number; maxIterations?: number };
};

function evidenceFor(address: string, g: TrustGraph): TrustEvidence {
  const mine = g.edges.filter(
    (e) => !e.blocked && (e.a.toLowerCase() === address || e.b.toLowerCase() === address),
  );
  return {
    connections: mine.length,
    occasions: new Set(mine.map((e) => e.occasionId)).size,
    regions: new Set(mine.map((e) => regionOf(e.occasionId))).size,
    // Vouch yang DITERIMA. Menjamin orang lain bukan bukti tentang dirimu.
    vouches: g.vouches.filter((v) => v.to.toLowerCase() === address).length,
  };
}

/**
 * Satu-satunya pintu keluar paket ini. Urutan langkah di bawah MENGIKAT —
 * mengubahnya mengubah hasil (spec fase §4.6).
 */
export function computeTrust(graph: TrustGraph, opts: TrustOptions = {}): TrustResult[] {
  const nodes = allAddresses(graph);

  // 1-3. Graf berarah (blocked & slashed sudah tercabut di sini) lalu PageRank.
  const directed = buildDirectedGraph(graph, { decay: opts.decay });
  const scores = personalizedPageRank(directed, graph.seeds, nodes, opts.pagerank);

  // 4. Diversitas — sifat satu orang, jadi diterapkan SETELAH PageRank.
  const neighbors = neighborsOf(graph.edges);
  const adjusted = new Map<string, number>();
  for (const n of nodes) {
    adjusted.set(n, (scores.get(n) ?? 0) * diversityMultiplier(n, graph.edges, neighbors));
  }

  // 5. Klaster operator berbagi satu skor, dibagi rata (spec induk §9.1).
  const clusters = detectOperators(graph.edges, opts.fingerprint);
  const clusterOf = new Map<string, string>();
  for (const c of clusters) {
    const total = c.members.reduce((s, m) => s + (adjusted.get(m) ?? 0), 0);
    const share = total / c.members.length;
    for (const m of c.members) {
      clusterOf.set(m, c.id);
      adjusted.set(m, share);
    }
  }

  // 6. Penalti penjamin, satu lompatan.
  for (const [addr, factor] of voucherPenalties(graph.slashed, graph.vouches)) {
    if (adjusted.has(addr)) adjusted.set(addr, adjusted.get(addr)! * factor);
  }
  // Pelaku terkonfirmasi kehilangan skornya sendiri, bukan cuma aliran keluarnya.
  for (const s of graph.slashed) adjusted.set(s.toLowerCase(), 0);

  // 7. Rasio terhadap skor TERTINGGI DI GRAF -> tier.
  //
  // Penyebutnya bukan skor seed. PageRank berpersonalisasi tidak menjamin seed
  // memegang skor tertinggi: kepercayaan mengalir keluar dari seed lalu menumpuk
  // di simpul yang paling banyak tetangganya. Kalau penyebutnya skor seed,
  // rasio bisa melebihi 1 dan janji rentang 0..1 di spec fase §4.5 jadi bohong.
  const topScore = Math.max(0, ...nodes.map((n) => adjusted.get(n) ?? 0));

  const rows: TrustResult[] = nodes.map((n) => {
    const score = adjusted.get(n) ?? 0;
    const ratio = topScore > 0 ? score / topScore : 0;
    return {
      address: n as Address,
      score,
      ratio,
      tier: tierOf(ratio),
      evidence: evidenceFor(n, graph),
      operatorCluster: clusterOf.get(n) ?? null,
    };
  });

  // Urutan alamat sebagai pemecah seri, supaya hasilnya deterministik.
  return rows.sort((x, y) => (y.score - x.score) || (x.address < y.address ? -1 : 1));
}
