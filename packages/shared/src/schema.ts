import { z } from "zod";
import { GEOHASH_PRECISION } from "./geohash";

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const bytes32 = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const signature = z.string().regex(/^0x[0-9a-fA-F]{130}$/);
const cell = z.string().length(GEOHASH_PRECISION).regex(/^[0-9b-hjkmnp-z]+$/);

// Satu definisi per konsep. Nama lama tetap dipakai skema Fase 1.
export const AddressSchema = address;
export const SignatureSchema = signature;

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

export const VouchRequestSchema = z.object({
  from: AddressSchema,
  to: AddressSchema,
  tags: z.array(z.string()).max(16),
  expiresAt: z.string().regex(/^\d+$/),
  sig: SignatureSchema,
});

export const RevokeRequestSchema = z.object({
  from: AddressSchema,
  to: AddressSchema,
  expiresAt: z.string().regex(/^\d+$/),
  sig: SignatureSchema,
});

export const ReportRequestSchema = z.object({
  reporter: AddressSchema,
  subject: AddressSchema,
  reason: z.string().min(10).max(1000),
  evidence: z.string().max(2000).optional(),
  expiresAt: z.string().regex(/^\d+$/),
  sig: SignatureSchema,
});

const unixSeconds = z.string().regex(/^\d+$/);

export const CreateEventRequestSchema = z
  .object({
    eventId: bytes32,
    host: address,
    title: z.string().min(1).max(120),
    venueLabel: z.string().max(160).default(""),
    cell,
    startsAt: unixSeconds,
    endsAt: unixSeconds,
    expiresAt: unixSeconds,
    sigHost: signature,
  })
  .refine((v) => {
    try {
      return BigInt(v.endsAt) > BigInt(v.startsAt);
    } catch {
      return true; // Biarkan error BigInt ini ditangani level validasi field
    }
  }, {
    message: "waktu selesai harus setelah waktu mulai",
    path: ["endsAt"],
  });

export const RsvpRequestSchema = z.object({
  eventId: bytes32,
  who: address,
  expiresAt: unixSeconds,
  sig: signature,
});

export const CheckInOfferRequestSchema = z.object({
  eventId: bytes32,
  nonce: bytes32,
  host: address,
  expiresAt: unixSeconds,
  sigHost: signature,
  cell,
  atMs: z.number().int().positive(),
});

export const CheckInRequestSchema = z.object({
  eventId: bytes32,
  nonce: bytes32,
  attendee: address,
  expiresAt: unixSeconds,
  sigAttendee: signature,
  cell,
  atMs: z.number().int().positive(),
});

export type CreateEventRequest = z.infer<typeof CreateEventRequestSchema>;
export type RsvpRequest = z.infer<typeof RsvpRequestSchema>;
export type CheckInOfferRequest = z.infer<typeof CheckInOfferRequestSchema>;
export type CheckInRequest = z.infer<typeof CheckInRequestSchema>;
