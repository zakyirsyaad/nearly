import type { Hex } from "viem";
import { postJson, ApiError } from "./http";
// Di-re-export supaya impor `{ ApiError } from "./api"` yang sudah ada di
// app/scan.tsx dan layar lain tidak perlu disentuh.
export { ApiError };

export type OfferBody = {
  initiator: string; nonce: string; expiresAt: string;
  sigOffer: string; cell: string; atMs: number;
};

export type AcceptBody = {
  initiator: string; counterparty: string; nonce: string; expiresAt: string;
  sigAccept: string; cell: string; atMs: number;
};

export const postOffer = (b: OfferBody) => postJson<{ ok: true }>("/handshake/offer", b);
export const postAccept = (b: AcceptBody) => postJson<{ txHash: Hex }>("/handshake/accept", b);
