import type { Address } from "viem";

/**
 * Satu pertemuan fisik. KANONIK: a < b (huruf kecil), sama seperti constraint
 * connections_ordered di database. Edge tidak menyimpan vouch, karena vouch
 * berarah sedangkan pertemuan tidak (spec fase §4.1).
 */
export type TrustEdge = {
  a: Address;
  b: Address;
  /** Fase 2: `${cell}:${jendela 3 jam}`. Fase 3: id event terverifikasi. */
  occasionId: string;
  atMs: number;
  /** Fase 4. Selalu false sekarang; sudah ada di tipe supaya tidak perlu migrasi tipe nanti. */
  blocked: boolean;
};

/** BERARAH. `from` menjamin `to`, bukan sebaliknya. */
export type Vouch = { from: Address; to: Address; atMs: number };

export type Seed = { address: Address; weight: number };

export type TrustGraph = {
  edges: TrustEdge[];
  vouches: Vouch[];
  seeds: Seed[];
  /** Pelaku penipuan yang sudah dikonfirmasi manusia. */
  slashed: Address[];
  nowMs: number;
};

export type Tier = 0 | 1 | 2 | 3;

export type TrustEvidence = {
  connections: number;
  occasions: number;
  regions: number;
  vouches: number;
};

export type TrustResult = {
  address: Address;
  /** Skor akhir setelah seluruh pipeline §4.6. */
  score: number;
  /** score / skor seed tertinggi, 0..1. */
  ratio: number;
  tier: Tier;
  evidence: TrustEvidence;
  operatorCluster: string | null;
};

/** Umur koneksi (ms) -> pengali bobot. */
export type DecayFn = (ageMs: number) => number;
