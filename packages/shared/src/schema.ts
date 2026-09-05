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

const DIGIT_RE = /^\d+$/;
const unixSeconds = z.string().regex(DIGIT_RE);

/**
 * Zod TETAP menjalankan .refine walau validasi field sudah gagal — statusnya
 * "dirty", bukan "aborted" — jadi nilai yang sampai ke sini bisa saja "besok"
 * dan BigInt() akan melempar. Yang benar bukan menelan galatnya diam-diam,
 * melainkan tidak ikut berpendapat: pesan untuk "bukan angka" sudah
 * dikeluarkan `unixSeconds` sendiri, dan refine tidak punya apa pun untuk
 * ditambahkan.
 */
function waktuTakTerbaca(...nilai: string[]): boolean {
  return nilai.some((s) => !DIGIT_RE.test(s));
}

/** Jendela acara paling lama satu hari. Lihat alasannya di bawah. */
const MAKS_DURASI_DETIK = 24n * 60n * 60n;

/** Seberapa jauh `startsAt` boleh berada di belakang `expiresAt`. */
const MAKS_MUNDUR_DETIK = 60n * 60n;

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
  .refine((v) => waktuTakTerbaca(v.startsAt, v.endsAt)
    || BigInt(v.endsAt) > BigInt(v.startsAt), {
    message: "waktu selesai harus setelah waktu mulai",
    path: ["endsAt"],
  })
  // Jendela yang tak terbatas panjangnya membuat sebuah acara bisa menempel di
  // puncak discovery selamanya, padahal spec §8 mensyaratkan perhatian itu
  // DIPEROLEH. Ia juga memperlebar rentang waktu yang bisa dicap ulang oleh
  // eventOccasionFor di load-graph.
  .refine((v) => waktuTakTerbaca(v.startsAt, v.endsAt)
    || BigInt(v.endsAt) - BigInt(v.startsAt) <= MAKS_DURASI_DETIK, {
    message: "acara tidak boleh lebih lama dari 24 jam",
    path: ["endsAt"],
  })
  // Modul ini murni dan tidak punya jam. "Sekarang" diambil dari `expiresAt`
  // yang memang baru dibuat klien — dan gerbang server menolak `expiresAt`
  // yang sudah lewat, jadi expiresAt >= sekarang. Artinya batas ini menahan
  // startsAt mundur lebih dari satu jam dari waktu nyata; mengarang expiresAt
  // yang jauh ke depan hanya membuatnya makin ketat, bukan makin longgar.
  //
  // Yang dijaga: host yang memundurkan startsAt bisa membuat jendela acaranya
  // memuat koneksi-koneksi lama, dan eventOccasionFor akan mencap ulang koneksi
  // itu — melanggar janji spec §9 bahwa koneksi yang sudah ada tidak berubah
  // nilainya.
  .refine((v) => waktuTakTerbaca(v.startsAt, v.expiresAt)
    || BigInt(v.startsAt) + MAKS_MUNDUR_DETIK >= BigInt(v.expiresAt), {
    message: "waktu mulai tidak boleh lebih dari 1 jam di masa lalu",
    path: ["startsAt"],
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
