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
