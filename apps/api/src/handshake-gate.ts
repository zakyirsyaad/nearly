import type { Address, Hex } from "viem";
import { recoverAcceptSigner, recoverOfferSigner, verifyColocation } from "@nearly/shared";
import type { GateDeps } from "./ports";
import { pulihkanTandaTangan } from "./pulihkan-tanda-tangan";

/** Spec §11.1 butir 8 diterapkan sama untuk koneksi: kuota harian global. */
export const DAILY_CONNECTION_QUOTA = 30;
const DAY_MS = 86_400_000;

export type GateFailure =
  | { code: "expired"; httpStatus: 410 }
  | { code: "bad_offer_signature"; httpStatus: 401 }
  | { code: "bad_accept_signature"; httpStatus: 401 }
  | { code: "nonce_used"; httpStatus: 409 }
  | { code: "offer_not_found"; httpStatus: 404 }
  | { code: "offer_consumed"; httpStatus: 409 }
  | { code: "not_colocated"; reason: "cell_too_far" | "time_too_far"; httpStatus: 422 }
  | { code: "already_connected"; httpStatus: 409 }
  | { code: "quota_exceeded"; httpStatus: 429 }
  | { code: "chain_error"; httpStatus: 502 };

export type GateResult<T> = { ok: true; value: T } | { ok: false; failure: GateFailure };

const fail = (failure: GateFailure): { ok: false; failure: GateFailure } => ({ ok: false, failure });

export type OfferInput = {
  initiator: Address; nonce: Hex; expiresAt: bigint; sigOffer: Hex;
  cell: string; atMs: number;
};

export async function submitOffer(input: OfferInput, deps: GateDeps): Promise<GateResult<void>> {
  if (deps.nowMs() > Number(input.expiresAt) * 1000) return fail({ code: "expired", httpStatus: 410 });

  if (await deps.store.getOffer(input.nonce)) return fail({ code: "nonce_used", httpStatus: 409 });

  const signer = await pulihkanTandaTangan(() => recoverOfferSigner(
      { initiator: input.initiator, nonce: input.nonce, expiresAt: input.expiresAt },
      input.sigOffer,
      deps.verifyingContract,
  ));
  if (signer === null || signer.toLowerCase() !== input.initiator.toLowerCase()) {
    return fail({ code: "bad_offer_signature", httpStatus: 401 });
  }

  await deps.store.putOffer({
    nonce: input.nonce, initiator: input.initiator, expiresAt: input.expiresAt,
    sigOffer: input.sigOffer, cell: input.cell, atMs: input.atMs,
  });
  return { ok: true, value: undefined };
}

export type AcceptInput = {
  initiator: Address; counterparty: Address; nonce: Hex; expiresAt: bigint;
  sigAccept: Hex; cell: string; atMs: number;
};

export async function acceptHandshake(
  input: AcceptInput, deps: GateDeps,
): Promise<GateResult<{ txHash: Hex }>> {
  const offer = await deps.store.getOffer(input.nonce);
  if (!offer) return fail({ code: "offer_not_found", httpStatus: 404 });
  if (offer.consumed) return fail({ code: "offer_consumed", httpStatus: 409 });

  if (deps.nowMs() > Number(offer.expiresAt) * 1000) return fail({ code: "expired", httpStatus: 410 });

  // Premis produk (spec §2). Lokasi A berasal dari A, lokasi B berasal dari B —
  // tidak ada pihak yang bisa mengarang lokasi pihak lain.
  const colo = verifyColocation(
    { cell: offer.cell, at: offer.atMs },
    { cell: input.cell, at: input.atMs },
  );
  if (!colo.ok) return fail({ code: "not_colocated", reason: colo.reason, httpStatus: 422 });

  const acceptSigner = await pulihkanTandaTangan(() => recoverAcceptSigner(
      {
        initiator: offer.initiator, counterparty: input.counterparty,
        nonce: input.nonce, expiresAt: offer.expiresAt,
      },
      input.sigAccept,
      deps.verifyingContract,
  ));
  if (acceptSigner === null || acceptSigner.toLowerCase() !== input.counterparty.toLowerCase()) {
    return fail({ code: "bad_accept_signature", httpStatus: 401 });
  }

  if (await deps.store.areConnected(offer.initiator, input.counterparty)) {
    return fail({ code: "already_connected", httpStatus: 409 });
  }

  const since = deps.nowMs() - DAY_MS;
  const [nA, nB] = await Promise.all([
    deps.store.countConnectionsSince(offer.initiator, since),
    deps.store.countConnectionsSince(input.counterparty, since),
  ]);
  if (nA >= DAILY_CONNECTION_QUOTA || nB >= DAILY_CONNECTION_QUOTA) {
    return fail({ code: "quota_exceeded", httpStatus: 429 });
  }

  let txHash: Hex;
  try {
    txHash = await deps.chain.submitConnect({
      initiator: offer.initiator, counterparty: input.counterparty,
      nonce: input.nonce, expiresAt: offer.expiresAt,
      sigOffer: offer.sigOffer, sigAccept: input.sigAccept,
    });
  } catch {
    // Offer TIDAK ditandai terpakai, supaya pengguna bisa mencoba lagi.
    return fail({ code: "chain_error", httpStatus: 502 });
  }

  await deps.store.consumeOffer(input.nonce);
  await deps.store.recordConnection({
    a: offer.initiator, b: input.counterparty,
    nonce: input.nonce, txHash, atMs: deps.nowMs(), cell: offer.cell,
  });
  return { ok: true, value: { txHash } };
}
