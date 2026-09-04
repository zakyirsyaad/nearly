import type { Address } from "viem";
import type { TrustEdge, TrustGraph, Vouch } from "@nearly/trust";

/**
 * Jendela 3 jam. Ini penerapan keputusan spec fase §2.1: di Fase 2 "occasion"
 * ditebak dari (sel, jendela waktu), karena entitas event baru lahir di Fase 3.
 *
 * FUNGSI INI SATU-SATUNYA YANG BERUBAH DI FASE 3 — saat itu occasionId diisi
 * dari event_id check-in terverifikasi, dan packages/trust tidak ikut berubah.
 */
export const OCCASION_WINDOW_MS = 10_800_000;

export function occasionIdOf(cell: string, atMs: number): string {
  return `${cell}:${Math.floor(atMs / OCCASION_WINDOW_MS)}`;
}

export type ConnRow = {
  addr_a: string;
  addr_b: string;
  cell: string | null;
  created_at: string;
};
export type VouchRow = {
  from_addr: string;
  to_addr: string;
  created_at: string;
  revoked_at: string | null;
};
export type SeedRow = { address: string; weight: number };
export type SlashRow = { subject: string };

export type GraphRows = {
  connections: ConnRow[];
  vouches: VouchRow[];
  seeds: SeedRow[];
  slashes: SlashRow[];
};

/**
 * Murni, jadi bisa diuji tanpa Supabase. Seluruh penerjemahan baris SQL ke tipe
 * domain terjadi di sini dan tidak di tempat lain.
 */
export function rowsToGraph(rows: GraphRows, nowMs: number): TrustGraph {
  const edges: TrustEdge[] = rows.connections.map((r, i) => {
    const atMs = new Date(r.created_at).getTime();
    return {
      a: r.addr_a.toLowerCase() as Address,
      b: r.addr_b.toLowerCase() as Address,
      // Koneksi Fase 1 tercatat sebelum kolom cell ada. Jangan buang — tapi juga
      // jangan satukan jadi satu occasion raksasa, karena itu akan menjatuhkan
      // diversitas semua orang yang punya koneksi lama.
      occasionId: r.cell ? occasionIdOf(r.cell, atMs) : `tanpa-sel-${i}:0`,
      atMs,
      blocked: false,
    };
  });

  const vouches: Vouch[] = rows.vouches
    .filter((v) => v.revoked_at === null)
    .map((v) => ({
      from: v.from_addr.toLowerCase() as Address,
      to: v.to_addr.toLowerCase() as Address,
      atMs: new Date(v.created_at).getTime(),
    }));

  return {
    edges,
    vouches,
    seeds: rows.seeds.map((s) => ({
      address: s.address.toLowerCase() as Address,
      weight: Number(s.weight),
    })),
    slashed: rows.slashes.map((s) => s.subject.toLowerCase() as Address),
    nowMs,
  };
}
