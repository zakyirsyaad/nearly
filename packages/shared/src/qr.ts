import { bytesToHex, type Address, type Hex } from "viem";
import { QR_TTL_MS } from "./handshake.js";

export type QrPayload = {
  v: 1;
  initiator: Address;
  nonce: Hex;
  expiresAt: bigint;
  sigOffer: Hex;
};

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const BYTES32_RE = /^0x[0-9a-fA-F]{64}$/;
const SIG_RE = /^0x[0-9a-fA-F]{130}$/;

export function makeNonce(): Hex {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return bytesToHex(b);
}

/** Unix DETIK, 30 detik ke depan (spec §7.1). */
export function qrExpiresAt(nowMs: number): bigint {
  return BigInt(Math.floor(nowMs / 1000) + QR_TTL_MS / 1000);
}

export function encodeQr(p: QrPayload): string {
  return JSON.stringify({
    v: p.v,
    i: p.initiator,
    n: p.nonce,
    e: p.expiresAt.toString(),
    s: p.sigOffer,
  });
}

/** Mengembalikan null untuk apa pun yang tidak sah. QR bisa berisi apa saja. */
export function decodeQr(s: string): QrPayload | null {
  let raw: unknown;
  try {
    raw = JSON.parse(s);
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;

  const o = raw as Record<string, unknown>;
  if (o.v !== 1) return null;
  if (typeof o.i !== "string" || !ADDRESS_RE.test(o.i)) return null;
  if (typeof o.n !== "string" || !BYTES32_RE.test(o.n)) return null;
  if (typeof o.s !== "string" || !SIG_RE.test(o.s)) return null;
  if (typeof o.e !== "string" || !/^\d+$/.test(o.e)) return null;

  return {
    v: 1,
    initiator: o.i as Address,
    nonce: o.n as Hex,
    expiresAt: BigInt(o.e),
    sigOffer: o.s as Hex,
  };
}

export function isQrExpired(p: QrPayload, nowMs: number): boolean {
  return nowMs > Number(p.expiresAt) * 1000;
}
