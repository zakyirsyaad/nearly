import { computeTrust, type TrustResult } from "@nearly/trust";
import type { Address, Hex } from "viem";
import type { AttestorPort, TrustStore } from "../ports";

/** WAJIB sama dengan SCORE_SCALE di TrustAttestor.sol. */
export const SCORE_SCALE = 1_000_000;

export function toChainScore(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0) return 0;
  return Math.min(SCORE_SCALE, Math.round(ratio * SCORE_SCALE));
}

/**
 * Penyaring yang membuat demo ini mampu dibiayai.
 *
 * PageRank bersifat global: satu salaman menggeser skor hampir semua orang
 * sedikit-sedikit. Kalau setiap pergeseran ditulis on-chain, satu ruangan berisi
 * 100 orang menghasilkan ~10.000 transaksi, sementara saldo relayer cukup untuk
 * puluhan. Yang benar-benar berarti bagi siapa pun yang membaca chain adalah
 * PERPINDAHAN TIER, bukan pergeseran 0.0001 di belakang koma.
 *
 * Murni dengan sengaja: ini satu-satunya hal yang berdiri antara demo yang
 * berjalan dan relayer kehabisan gas di tengah acara.
 */
export function changedTiers(
  results: TrustResult[],
  published: Map<string, number>,
): TrustResult[] {
  return results.filter((r) => published.get(r.address.toLowerCase()) !== r.tier);
}

export type RecomputeDeps = {
  trust: TrustStore;
  attestor: AttestorPort;
  nowMs: () => number;
};

export async function recomputeTrust(
  deps: RecomputeDeps,
  opts: { override?: TrustResult[] } = {},
): Promise<{ computed: number; published: number; failed: number }> {
  const now = deps.nowMs();
  const graph = await deps.trust.loadGraph(now);
  const results = opts.override ?? computeTrust(graph);

  // Snapshot disimpan untuk SEMUA alamat, tiap kali. Inilah yang dibaca
  // aplikasi, jadi skor di layar tetap bergerak hidup walau chain jarang ditulis.
  await deps.trust.saveSnapshots(results, now);

  const published = await deps.trust.listPublishedTiers();
  const perlu = changedTiers(results, published);

  const berhasil: { address: Address; tier: number; score: number; txHash: Hex }[] = [];
  let failed = 0;

  for (const r of perlu) {
    const score = toChainScore(r.ratio);
    try {
      const txHash = await deps.attestor.setScore(r.address, score, r.tier);
      berhasil.push({ address: r.address, tier: r.tier, score, txHash });
    } catch {
      // Satu tx gagal (gas habis, nonce bentrok, RPC tersendat) tidak boleh
      // menjatuhkan sisanya. Yang gagal tidak ditandai published, jadi ia akan
      // dicoba lagi pada recompute berikutnya dengan sendirinya.
      failed++;
    }
  }

  await deps.trust.markPublished(berhasil);
  return { computed: results.length, published: berhasil.length, failed };
}
