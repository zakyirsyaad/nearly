import {
  bytesToHex, hexToString, pad, recoverTypedDataAddress, stringToHex,
  type Address, type Hex,
} from "viem";
import { NEARLY_CHAIN_ID } from "./handshake";

export type CreateEventMessage = {
  eventId: Hex;
  host: Address;
  startsAt: bigint;
  endsAt: bigint;
  centerCell: Hex;
  expiresAt: bigint;
};

export type CheckInOfferMessage = { eventId: Hex; nonce: Hex; expiresAt: bigint };

export type CheckInAcceptMessage = {
  eventId: Hex; nonce: Hex; attendee: Address; expiresAt: bigint;
};

/**
 * RSVP TIDAK PERNAH naik on-chain — karena itu `Rsvp` tidak punya pasangan
 * typehash di Solidity, dan test kunci di Task 3 sengaja tidak memeriksanya.
 * Tanda tangannya tetap ada supaya `who` tidak datang telanjang dari body
 * request; tanpa itu siapa pun bisa mengarang RSVP atas nama orang lain, dan
 * karena RSVP adalah syarat check-in, itu berarti mengarang syarat orang lain.
 */
export type RsvpMessage = { eventId: Hex; who: Address; expiresAt: bigint };

/**
 * Bukti baca yang MENGAKU sebagai `who`, dipakai HANYA untuk membuka
 * bendera sudahRsvp/sudahCheckIn di GET /events/:id. Bentuk fieldnya sama
 * persis dengan `Rsvp` ({eventId, who, expiresAt}), tapi nama tipe EIP-712
 * berbeda membuat digest-nya berbeda — tanda tangan `LihatEvent` TIDAK sah
 * sebagai `Rsvp` dan sebaliknya. Itu penting karena `Rsvp` juga diterima
 * POST /events/:id/rsvp sebagai perintah tulis: kalau proof baca ini memakai
 * tipe yang sama, tanda tangan yang bocor lewat query string (log akses,
 * proxy, siapa pun yang membaca URL dalam masa berlakunya) bisa diputar
 * ulang sebagai RSVP sungguhan atas nama orang itu. Seperti `Rsvp`, tipe ini
 * TIDAK PERNAH naik on-chain dan tidak boleh punya pasangan typehash di
 * Solidity — ia murni bukti baca.
 */
export type LihatEventMessage = { eventId: Hex; who: Address; expiresAt: bigint };

// TIGA yang pertama WAJIB identik kata-per-kata dengan typehash di
// packages/contracts/src/AttendanceRegistry.sol. Dijaga test kunci di Task 3.
const TYPES = {
  CreateEvent: [
    { name: "eventId", type: "bytes32" },
    { name: "host", type: "address" },
    { name: "startsAt", type: "uint64" },
    { name: "endsAt", type: "uint64" },
    { name: "centerCell", type: "bytes32" },
    { name: "expiresAt", type: "uint64" },
  ],
  CheckInOffer: [
    { name: "eventId", type: "bytes32" },
    { name: "nonce", type: "bytes32" },
    { name: "expiresAt", type: "uint64" },
  ],
  CheckInAccept: [
    { name: "eventId", type: "bytes32" },
    { name: "nonce", type: "bytes32" },
    { name: "attendee", type: "address" },
    { name: "expiresAt", type: "uint64" },
  ],
  Rsvp: [
    { name: "eventId", type: "bytes32" },
    { name: "who", type: "address" },
    { name: "expiresAt", type: "uint64" },
  ],
  LihatEvent: [
    { name: "eventId", type: "bytes32" },
    { name: "who", type: "address" },
    { name: "expiresAt", type: "uint64" },
  ],
} as const;

export const EVENT_TYPES = TYPES;

function domain(verifyingContract: Address) {
  return { name: "Nearly", version: "1", chainId: NEARLY_CHAIN_ID, verifyingContract } as const;
}

/**
 * Sel geohash7 dijejalkan ke satu bytes32 sebagai ASCII rata kiri.
 *
 * Disimpan apa adanya, bukan hash-nya: venue event memang informasi publik
 * (spec §7.1), jadi meng-hash tidak melindungi apa pun sementara kemampuan
 * orang luar mengaudit geofence hilang percuma.
 */
export function cellToBytes32(cell: string): Hex {
  return pad(stringToHex(cell), { size: 32, dir: "right" });
}

export function bytes32ToCell(b: Hex): string {
  return hexToString(b).replace(/\0+$/, "");
}

export function makeEventId(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export function createEventTypedData(msg: CreateEventMessage, verifyingContract: Address) {
  return {
    domain: domain(verifyingContract),
    types: { CreateEvent: TYPES.CreateEvent },
    primaryType: "CreateEvent",
    message: msg,
  } as const;
}

export function checkInOfferTypedData(msg: CheckInOfferMessage, verifyingContract: Address) {
  return {
    domain: domain(verifyingContract),
    types: { CheckInOffer: TYPES.CheckInOffer },
    primaryType: "CheckInOffer",
    message: msg,
  } as const;
}

export function checkInAcceptTypedData(msg: CheckInAcceptMessage, verifyingContract: Address) {
  return {
    domain: domain(verifyingContract),
    types: { CheckInAccept: TYPES.CheckInAccept },
    primaryType: "CheckInAccept",
    message: msg,
  } as const;
}

export function rsvpTypedData(msg: RsvpMessage, verifyingContract: Address) {
  return {
    domain: domain(verifyingContract),
    types: { Rsvp: TYPES.Rsvp },
    primaryType: "Rsvp",
    message: msg,
  } as const;
}

export function lihatEventTypedData(msg: LihatEventMessage, verifyingContract: Address) {
  return {
    domain: domain(verifyingContract),
    types: { LihatEvent: TYPES.LihatEvent },
    primaryType: "LihatEvent",
    message: msg,
  } as const;
}

export function recoverCreateEventSigner(
  msg: CreateEventMessage, signature: Hex, verifyingContract: Address,
): Promise<Address> {
  return recoverTypedDataAddress({ ...createEventTypedData(msg, verifyingContract), signature });
}

export function recoverCheckInOfferSigner(
  msg: CheckInOfferMessage, signature: Hex, verifyingContract: Address,
): Promise<Address> {
  return recoverTypedDataAddress({ ...checkInOfferTypedData(msg, verifyingContract), signature });
}

export function recoverCheckInAcceptSigner(
  msg: CheckInAcceptMessage, signature: Hex, verifyingContract: Address,
): Promise<Address> {
  return recoverTypedDataAddress({ ...checkInAcceptTypedData(msg, verifyingContract), signature });
}

export function recoverRsvpSigner(
  msg: RsvpMessage, signature: Hex, verifyingContract: Address,
): Promise<Address> {
  return recoverTypedDataAddress({ ...rsvpTypedData(msg, verifyingContract), signature });
}

export function recoverLihatEventSigner(
  msg: LihatEventMessage, signature: Hex, verifyingContract: Address,
): Promise<Address> {
  return recoverTypedDataAddress({ ...lihatEventTypedData(msg, verifyingContract), signature });
}

/**
 * Payload QR yang ditampilkan HOST di layar check-in.
 *
 * `k: "checkin"` adalah penandanya. Dua jenis QR hidup berdampingan di satu
 * pemindai, dan kalau salah satunya bisa dibaca sebagai yang lain, pemindai
 * akan menjalankan alur yang salah — koneksi baru, misalnya, alih-alih
 * kehadiran. Dikunci sebuah test.
 */
export type CheckInQrPayload = {
  v: 1;
  k: "checkin";
  eventId: Hex;
  nonce: Hex;
  expiresAt: bigint;
  sigHost: Hex;
};

const BYTES32_RE = /^0x[0-9a-fA-F]{64}$/;
const SIG_RE = /^0x[0-9a-fA-F]{130}$/;

export function encodeCheckInQr(p: CheckInQrPayload): string {
  return JSON.stringify({
    v: p.v, k: p.k, ev: p.eventId, n: p.nonce, e: p.expiresAt.toString(), s: p.sigHost,
  });
}

/** Mengembalikan null untuk apa pun yang tidak sah. QR bisa berisi apa saja. */
export function decodeCheckInQr(s: string): CheckInQrPayload | null {
  let raw: unknown;
  try {
    raw = JSON.parse(s);
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;

  const o = raw as Record<string, unknown>;
  if (o.v !== 1 || o.k !== "checkin") return null;
  if (typeof o.ev !== "string" || !BYTES32_RE.test(o.ev)) return null;
  if (typeof o.n !== "string" || !BYTES32_RE.test(o.n)) return null;
  if (typeof o.s !== "string" || !SIG_RE.test(o.s)) return null;
  if (typeof o.e !== "string" || !/^\d+$/.test(o.e)) return null;

  return {
    v: 1,
    k: "checkin",
    eventId: o.ev as Hex,
    nonce: o.n as Hex,
    expiresAt: BigInt(o.e),
    sigHost: o.s as Hex,
  };
}
