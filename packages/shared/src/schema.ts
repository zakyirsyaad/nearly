import { z } from "zod";
import { GEOHASH_PRECISION } from "./geohash";

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const bytes32 = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const signature = z.string().regex(/^0x[0-9a-fA-F]{130}$/);
const cell = z.string().length(GEOHASH_PRECISION).regex(/^[0-9b-hjkmnp-z]+$/);

/**
 * Satuan waktu — sumber bug klasik:
 * - `expiresAt` = unix DETIK, string karena JSON tidak punya bigint
 * - `atMs`      = MILIDETIK dari Date.now()
 *
 * Setiap pihak mengirim `cell` dan `atMs` MILIKNYA SENDIRI. Tidak ada endpoint
 * yang menerima klaim lokasi atas nama orang lain.
 */
export const OfferRequestSchema = z.object({
  initiator: address,
  nonce: bytes32,
  expiresAt: z.string().regex(/^\d+$/),
  sigOffer: signature,
  cell,
  atMs: z.number().int().positive(),
});

export const AcceptRequestSchema = z
  .object({
    initiator: address,
    counterparty: address,
    nonce: bytes32,
    expiresAt: z.string().regex(/^\d+$/),
    sigAccept: signature,
    cell,
    atMs: z.number().int().positive(),
  })
  .refine((v) => v.initiator.toLowerCase() !== v.counterparty.toLowerCase(), {
    message: "tidak bisa handshake dengan diri sendiri",
    path: ["counterparty"],
  });

export type OfferRequest = z.infer<typeof OfferRequestSchema>;
export type AcceptRequest = z.infer<typeof AcceptRequestSchema>;
