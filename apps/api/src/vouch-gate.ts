import type { Address, Hex } from "viem";
import { recoverRevokeSigner, recoverVouchSigner, tagsHashOf } from "@nearly/shared";
import { reportGate, type Report } from "@nearly/trust";
import type {
  AttestorPort, HandshakeStore, ReportStore, TrustStore, VouchChainPort, VouchStore,
} from "./ports";

/** Spec induk §11.1 butir 8: kuota harian global, bukan per-event. */
export const DAILY_VOUCH_QUOTA = 3;
const DAY_MS = 86_400_000;

export type VouchFailure =
  | { code: "expired"; httpStatus: 410 }
  | { code: "self_vouch"; httpStatus: 400 }
  | { code: "not_connected"; httpStatus: 422 }
  | { code: "bad_signature"; httpStatus: 401 }
  | { code: "already_vouched"; httpStatus: 409 }
  | { code: "not_vouched"; httpStatus: 404 }
  | { code: "quota_exceeded"; httpStatus: 429 }
  | { code: "gate_not_passed"; httpStatus: 409 }
  | { code: "chain_error"; httpStatus: 502 };

export type VouchResult<T> = { ok: true; value: T } | { ok: false; failure: VouchFailure };

const fail = (failure: VouchFailure): { ok: false; failure: VouchFailure } =>
  ({ ok: false, failure });

export type VouchDeps = {
  store: Pick<HandshakeStore, "areConnected">;
  vouches: VouchStore;
  vouchChain: VouchChainPort;
  vouchContract: Address;
  nowMs: () => number;
};

export type VouchInput = {
  from: Address; to: Address; tags: string[]; expiresAt: bigint; sig: Hex;
};

export async function submitVouch(
  input: VouchInput, deps: VouchDeps,
): Promise<VouchResult<{ txHash: Hex }>> {
  if (input.from.toLowerCase() === input.to.toLowerCase()) {
    return fail({ code: "self_vouch", httpStatus: 400 });
  }
  if (deps.nowMs() > Number(input.expiresAt) * 1000) {
    return fail({ code: "expired", httpStatus: 410 });
  }

  // Vouch adalah pernyataan tentang seseorang yang BENAR-BENAR kamu temui.
  // Kontrak juga menolaknya, tapi menolak di sini menghemat satu tx gagal.
  if (!(await deps.store.areConnected(input.from, input.to))) {
    return fail({ code: "not_connected", httpStatus: 422 });
  }

  const tagsHash = tagsHashOf(input.tags);
  const signer = await recoverVouchSigner(
    { from: input.from, to: input.to, tagsHash, expiresAt: input.expiresAt },
    input.sig,
    deps.vouchContract,
  );
  if (signer.toLowerCase() !== input.from.toLowerCase()) {
    return fail({ code: "bad_signature", httpStatus: 401 });
  }

  if (await deps.vouches.hasVouch(input.from, input.to)) {
    return fail({ code: "already_vouched", httpStatus: 409 });
  }

  const sejak = deps.nowMs() - DAY_MS;
  if ((await deps.vouches.countVouchesSince(input.from, sejak)) >= DAILY_VOUCH_QUOTA) {
    return fail({ code: "quota_exceeded", httpStatus: 429 });
  }

  let txHash: Hex;
  try {
    txHash = await deps.vouchChain.submitVouch({
      from: input.from, to: input.to, tagsHash, expiresAt: input.expiresAt, sig: input.sig,
    });
  } catch {
    return fail({ code: "chain_error", httpStatus: 502 });
  }

  await deps.vouches.recordVouch({
    from: input.from, to: input.to, tags: input.tags, tagsHash, txHash,
  });
  return { ok: true, value: { txHash } };
}

export type RevokeInput = { from: Address; to: Address; expiresAt: bigint; sig: Hex };

export async function revokeVouch(
  input: RevokeInput, deps: VouchDeps,
): Promise<VouchResult<{ txHash: Hex }>> {
  if (deps.nowMs() > Number(input.expiresAt) * 1000) {
    return fail({ code: "expired", httpStatus: 410 });
  }

  const signer = await recoverRevokeSigner(
    { from: input.from, to: input.to, expiresAt: input.expiresAt },
    input.sig,
    deps.vouchContract,
  );
  if (signer.toLowerCase() !== input.from.toLowerCase()) {
    return fail({ code: "bad_signature", httpStatus: 401 });
  }

  if (!(await deps.vouches.hasVouch(input.from, input.to))) {
    return fail({ code: "not_vouched", httpStatus: 404 });
  }

  let txHash: Hex;
  try {
    txHash = await deps.vouchChain.submitRevoke({
      from: input.from, to: input.to, expiresAt: input.expiresAt, sig: input.sig,
    });
  } catch {
    return fail({ code: "chain_error", httpStatus: 502 });
  }

  await deps.vouches.markRevoked(input.from, input.to);
  return { ok: true, value: { txHash } };
}

export type SlashDeps = {
  trust: TrustStore;
  reports: ReportStore;
  vouchChain: VouchChainPort;
  nowMs: () => number;
};

/**
 * Konfirmasi manusia atas laporan yang lolos gerbang.
 *
 * Gerbangnya dijalankan ULANG di sini, bukan dipercaya dari status yang
 * tersimpan: antara laporan masuk dan admin menekan tombol, skor pelapor bisa
 * berubah, atau mereka bisa ternyata satu klaster operator. Yang berlaku adalah
 * keadaan pada saat keputusan diambil.
 */
export async function confirmSlash(
  subject: Address, deps: SlashDeps,
): Promise<VouchResult<{ txHash: Hex }>> {
  const reports: Report[] = await deps.reports.listReports(subject);
  const snapshots = new Map<string, { ratio: number; cluster: string | null }>();

  for (const r of reports) {
    const snap = await deps.trust.getSnapshot(r.reporter);
    snapshots.set(r.reporter.toLowerCase(), {
      ratio: snap?.ratio ?? 0,
      cluster: snap?.operatorCluster ?? null,
    });
  }

  const graph = await deps.trust.loadGraph(deps.nowMs());
  const connected = new Set<string>();
  for (const e of graph.edges) {
    connected.add(`${e.a.toLowerCase()}|${e.b.toLowerCase()}`);
    connected.add(`${e.b.toLowerCase()}|${e.a.toLowerCase()}`);
  }

  const verdict = reportGate(subject, reports, {
    ratioOf: (a) => snapshots.get(a)?.ratio ?? 0,
    areConnected: (x, y) => connected.has(`${x}|${y}`),
    clusterOf: (a) => snapshots.get(a)?.cluster ?? null,
  });

  if (!verdict.passes) {
    await deps.reports.setReportStatus(subject, "ditolak");
    return fail({ code: "gate_not_passed", httpStatus: 409 });
  }

  let txHash: Hex;
  try {
    txHash = await deps.vouchChain.submitSlash(subject);
  } catch {
    return fail({ code: "chain_error", httpStatus: 502 });
  }

  await deps.reports.recordSlash(subject, txHash);
  await deps.reports.setReportStatus(subject, "terkonfirmasi");
  return { ok: true, value: { txHash } };
}
