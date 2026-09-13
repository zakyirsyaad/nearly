import { bytesToHex, recoverTypedDataAddress, type Address, type Hex } from "viem";
import { NEARLY_CHAIN_ID } from "./handshake";

/**
 * Unggahan feed. TIDAK PERNAH naik on-chain (spec §2.3) — karena itu tipe ini
 * tidak boleh punya pasangan typehash di Solidity mana pun, sama seperti
 * `Rsvp` dan `LihatEvent` di Fase 3a.
 *
 * Tetap ditandatangani karena tanpa itu `author` datang telanjang dari body
 * request, dan siapa pun bisa memposting atas nama orang lain.
 */
export type PostMessage = {
  postId: Hex;
  author: Address;
  body: string;
  expiresAt: bigint;
};

/**
 * `suka` sengaja bool, bukan dua tipe terpisah: dengan begini PEMBATALAN ikut
 * ditandatangani. Kalau pembatalan tidak bertanda tangan, siapa pun bisa
 * menghapus suka orang lain lewat body request.
 */
export type LikeMessage = {
  postId: Hex;
  who: Address;
  suka: boolean;
  expiresAt: bigint;
};

/**
 * Tipe TERPISAH dari `Post`, dan itu wajib (spec §5). Menghapus juga sekadar
 * membuktikan "aku penulis unggahan ini", jadi menggoda memakai ulang tanda
 * tangan `Post`. Kalau begitu, tanda tangan yang dibuat untuk MEMPOSTING sah
 * pula sebagai perintah MENGHAPUS, dan siapa pun yang menangkapnya bisa
 * menghapus unggahan orang itu. Kelas kesalahan Ruling 23.
 */
export type HapusPostMessage = {
  postId: Hex;
  author: Address;
  expiresAt: bigint;
};

/** `mime` ikut ditandatangani supaya tanda tangan untuk JPEG tidak bisa
 * dipakai melampirkan tipe berkas lain. */
export type LampirGambarMessage = {
  postId: Hex;
  author: Address;
  mime: string;
  expiresAt: bigint;
};

/**
 * Laporan WAJIB bertanda tangan, dan itu bukan simetri kosmetik dengan suka.
 * `post_reports.reporter` hanya di-check FORMAT-nya di migrasi 0004 — ia
 * bukan foreign key ke `profiles`, jadi alamat pelapor bahkan tidak perlu
 * pernah ada. Tanpa tanda tangan, penyerang mengirim tiga permintaan dengan
 * tiga alamat karangan, ambang 3 pelapor terlampaui, dan unggahan siapa pun
 * hilang dari feed semua orang. Penulisnya tidak akan pernah tahu, karena
 * `terlihat()` mengecualikan unggahan sendiri dari penyaring laporan.
 *
 * `reason` ikut ditandatangani supaya alasan tidak bisa ditukar setelah
 * ditandatangani — persis alasan `reasonHash` ikut ditandatangani di
 * `Report` Fase 2.
 */
export type LaporPostMessage = {
  postId: Hex;
  reporter: Address;
  reason: string;
  expiresAt: bigint;
};

/**
 * Bukti BACA untuk `GET /feed?who=` (review akhir Fase 4a, C1).
 *
 * Sejak blokir, feed untuk `who` bergantung pada tabel `blocks`: unggahan
 * orang yang punya hubungan blokir dengan `who` hilang, dan `hop` bergeser.
 * Tanpa bukti, siapa pun bisa membandingkan `GET /feed` dengan
 * `GET /feed?who=A` dan membaca daftar hubungan blokir A — padahal blokir
 * privat (spec 4a §2). Efek blokir karena itu hanya diterapkan untuk
 * penonton yang MEMBUKTIKAN dirinya `who` dengan tanda tangan ini.
 *
 * Anggota KEEMPAT keluarga berbentuk field `{ who, expiresAt }` — bersama
 * `LihatKecocokan`, `TandaiDilihat` (meet.ts), dan `LihatBlokir` (blokir.ts).
 * Hanya nama tipenya yang membedakan digest-nya. JANGAN menggabungkannya
 * dengan salah satu dari mereka: bukti ini dikirim di query string setiap
 * kali feed dibuka, dan kalau ia sah sebagai perintah lain, siapa pun yang
 * melihat URL-nya bisa bertindak atas nama pemiliknya.
 */
export type LihatFeedMessage = {
  who: Address;
  expiresAt: bigint;
};

const TYPES = {
  Post: [
    { name: "postId", type: "bytes32" },
    { name: "author", type: "address" },
    { name: "body", type: "string" },
    { name: "expiresAt", type: "uint64" },
  ],
  Like: [
    { name: "postId", type: "bytes32" },
    { name: "who", type: "address" },
    { name: "suka", type: "bool" },
    { name: "expiresAt", type: "uint64" },
  ],
  HapusPost: [
    { name: "postId", type: "bytes32" },
    { name: "author", type: "address" },
    { name: "expiresAt", type: "uint64" },
  ],
  LampirGambar: [
    { name: "postId", type: "bytes32" },
    { name: "author", type: "address" },
    { name: "mime", type: "string" },
    { name: "expiresAt", type: "uint64" },
  ],
  LaporPost: [
    { name: "postId", type: "bytes32" },
    { name: "reporter", type: "address" },
    { name: "reason", type: "string" },
    { name: "expiresAt", type: "uint64" },
  ],
  LihatFeed: [
    { name: "who", type: "address" },
    { name: "expiresAt", type: "uint64" },
  ],
} as const;

export const FEED_TYPES = TYPES;

function domain(verifyingContract: Address) {
  return { name: "Nearly", version: "1", chainId: NEARLY_CHAIN_ID, verifyingContract } as const;
}

export function makePostId(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export function postTypedData(msg: PostMessage, verifyingContract: Address) {
  return {
    domain: domain(verifyingContract),
    types: { Post: TYPES.Post },
    primaryType: "Post",
    message: msg,
  } as const;
}

export function likeTypedData(msg: LikeMessage, verifyingContract: Address) {
  return {
    domain: domain(verifyingContract),
    types: { Like: TYPES.Like },
    primaryType: "Like",
    message: msg,
  } as const;
}

export function recoverPostSigner(
  msg: PostMessage, signature: Hex, verifyingContract: Address,
): Promise<Address> {
  return recoverTypedDataAddress({ ...postTypedData(msg, verifyingContract), signature });
}

export function hapusPostTypedData(msg: HapusPostMessage, verifyingContract: Address) {
  return {
    domain: domain(verifyingContract),
    types: { HapusPost: TYPES.HapusPost },
    primaryType: "HapusPost",
    message: msg,
  } as const;
}

export function lampirGambarTypedData(msg: LampirGambarMessage, verifyingContract: Address) {
  return {
    domain: domain(verifyingContract),
    types: { LampirGambar: TYPES.LampirGambar },
    primaryType: "LampirGambar",
    message: msg,
  } as const;
}

export function laporPostTypedData(msg: LaporPostMessage, verifyingContract: Address) {
  return {
    domain: domain(verifyingContract),
    types: { LaporPost: TYPES.LaporPost },
    primaryType: "LaporPost",
    message: msg,
  } as const;
}

export function recoverLikeSigner(
  msg: LikeMessage, signature: Hex, verifyingContract: Address,
): Promise<Address> {
  return recoverTypedDataAddress({ ...likeTypedData(msg, verifyingContract), signature });
}

export function recoverHapusPostSigner(
  msg: HapusPostMessage, signature: Hex, verifyingContract: Address,
): Promise<Address> {
  return recoverTypedDataAddress({ ...hapusPostTypedData(msg, verifyingContract), signature });
}

export function recoverLampirGambarSigner(
  msg: LampirGambarMessage, signature: Hex, verifyingContract: Address,
): Promise<Address> {
  return recoverTypedDataAddress({ ...lampirGambarTypedData(msg, verifyingContract), signature });
}

export function recoverLaporPostSigner(
  msg: LaporPostMessage, signature: Hex, verifyingContract: Address,
): Promise<Address> {
  return recoverTypedDataAddress({ ...laporPostTypedData(msg, verifyingContract), signature });
}

export function lihatFeedTypedData(msg: LihatFeedMessage, verifyingContract: Address) {
  return {
    domain: domain(verifyingContract),
    types: { LihatFeed: TYPES.LihatFeed },
    primaryType: "LihatFeed",
    message: msg,
  } as const;
}

export function recoverLihatFeedSigner(
  msg: LihatFeedMessage, signature: Hex, verifyingContract: Address,
): Promise<Address> {
  return recoverTypedDataAddress({ ...lihatFeedTypedData(msg, verifyingContract), signature });
}
