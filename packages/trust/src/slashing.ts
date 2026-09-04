import type { Address } from "viem";
import type { Vouch } from "./types";

export const MIN_REPORTERS = 3;
/** Ambang tier Terpercaya (spec fase §4.5). */
export const MIN_REPORTER_RATIO = 0.15;
export const VOUCHER_PENALTY = 0.7;

export type Report = { reporter: Address; subject: Address; atMs: number };

export type GateContext = {
  ratioOf(address: string): number;
  areConnected(x: string, y: string): boolean;
  clusterOf(address: string): string | null;
};

export type GateVerdict = {
  passes: boolean;
  /** Wakil dari tiap kelompok pelapor yang saling terhubung. */
  independent: string[];
  reason: "cukup" | "pelapor_kurang" | "trust_pelapor_rendah" | "pelapor_tidak_independen";
};

/**
 * Gerbang laporan. Lolos gerbang BUKAN berarti di-slash — ia hanya membuat
 * kasusnya layak ditinjau manusia (spec fase §6).
 *
 * Yang mematikan brigading ada di langkah "independen": gerombolan yang saling
 * kenal secara definisi saling terkoneksi, jadi seluruh gerombolan hanya
 * terhitung SATU suara berapa pun jumlah orangnya. Untuk lolos dibutuhkan tiga
 * orang tepercaya yang saling asing — pola yang mahal dipalsukan, karena
 * penyerang harus memiliki tiga identitas tepercaya yang tidak saling mengenal.
 *
 * JANGAN melonggarkan syarat ini tanpa mengubah test brigading lebih dulu.
 */
export function reportGate(
  subject: Address,
  reports: Report[],
  ctx: GateContext,
): GateVerdict {
  const target = subject.toLowerCase();

  const unique = [
    ...new Set(
      reports
        .filter((r) => r.subject.toLowerCase() === target)
        .map((r) => r.reporter.toLowerCase()),
    ),
  ].sort();

  const trusted = unique.filter((r) => ctx.ratioOf(r) >= MIN_REPORTER_RATIO);

  // Satu wakil per kelompok yang saling terhubung atau satu klaster operator.
  const independent: string[] = [];
  for (const r of trusted) {
    const terkait = independent.some(
      (kept) =>
        ctx.areConnected(kept, r) ||
        (ctx.clusterOf(kept) !== null && ctx.clusterOf(kept) === ctx.clusterOf(r)),
    );
    if (!terkait) independent.push(r);
  }

  if (independent.length >= MIN_REPORTERS) return { passes: true, independent, reason: "cukup" };
  if (unique.length < MIN_REPORTERS) return { passes: false, independent, reason: "pelapor_kurang" };
  if (trusted.length < MIN_REPORTERS) {
    return { passes: false, independent, reason: "trust_pelapor_rendah" };
  }
  return { passes: false, independent, reason: "pelapor_tidak_independen" };
}

/**
 * Penalti untuk para penjamin pelaku terkonfirmasi: 0.7 pangkat jumlah pelaku
 * yang dia jamin.
 *
 * BERHENTI DI SATU LOMPATAN, dengan sengaja. Tanpa batas itu satu penipu bisa
 * menyeret separuh graf — dan penjamin-dari-penjamin tidak pernah menjamin
 * siapa pun secara langsung.
 */
export function voucherPenalties(slashed: Address[], vouches: Vouch[]): Map<string, number> {
  const guilty = new Set(slashed.map((a) => a.toLowerCase()));
  const counts = new Map<string, number>();

  for (const v of vouches) {
    if (!guilty.has(v.to.toLowerCase())) continue;
    const from = v.from.toLowerCase();
    counts.set(from, (counts.get(from) ?? 0) + 1);
  }

  const penalties = new Map<string, number>();
  for (const [addr, n] of counts) penalties.set(addr, Math.pow(VOUCHER_PENALTY, n));
  return penalties;
}
