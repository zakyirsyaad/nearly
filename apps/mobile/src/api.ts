import type { Hex } from "viem";
import { CONFIG } from "./config";

export class ApiError extends Error {
  constructor(public code: string, public status: number, public reason?: string) {
    super(`${code}${reason ? ` (${reason})` : ""}`);
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${CONFIG.apiUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError(
      typeof json.code === "string" ? json.code : "unknown",
      res.status,
      typeof json.reason === "string" ? json.reason : undefined,
    );
  }
  return json as T;
}

export type OfferBody = {
  initiator: string; nonce: string; expiresAt: string;
  sigOffer: string; cell: string; atMs: number;
};

export type AcceptBody = {
  initiator: string; counterparty: string; nonce: string; expiresAt: string;
  sigAccept: string; cell: string; atMs: number;
};

export const postOffer = (b: OfferBody) => post<{ ok: true }>("/handshake/offer", b);
export const postAccept = (b: AcceptBody) => post<{ txHash: Hex }>("/handshake/accept", b);
