import { recoverTypedDataAddress, type Address, type Hex } from "viem";
import { NEARLY_CHAIN_ID } from "./handshake";

/**
 * Perintah TULIS: memblokir seseorang, atau mencabut blokir itu.
 *
 * `blokir` sengaja bool, bukan dua tipe terpisah — polanya sama dengan
 * `InginBertemu`. Dengan begini PENCABUTAN ikut ditandatangani; tanpa itu
 * siapa pun bisa mencabut blokir orang lain lewat badan permintaan, dan
 * mencabut blokir orang lain adalah persis serangan yang blokir ada untuk
 * mencegah.
 *
 * TIDAK PERNAH naik on-chain (spec §2). Blokir itu privat; koneksinya yang
 * publik on-chain, dan itu memang fakta pertemuan yang tidak disembunyikan.
 */
export type BlokirMessage = {
  target: Address;
  who: Address;
  blokir: boolean;
  expiresAt: bigint;
};

/**
 * Bukti BACA untuk daftar blokir sendiri.
 *
 * Bentuk fieldnya IDENTIK dengan `LihatKecocokan` dan `TandaiDilihat` di
 * `meet.ts`, dan itu disengaja. Ketiganya `{ who, expiresAt }`; hanya nama
 * tipenya yang memisahkan bukti BACA dari perintah TULIS.
 *
 * JANGAN menggabungkan ketiganya karena terlihat mubazir. Kalau bukti baca
 * sah sebagai perintah tulis, tanda tangan yang bocor lewat query string bisa
 * dipakai mengubah keadaan orang lain — di sini: mencabut blokir mereka.
 */
export type LihatBlokirMessage = {
  who: Address;
  expiresAt: bigint;
};

const TYPES = {
  Blokir: [
    { name: "target", type: "address" },
    { name: "who", type: "address" },
    { name: "blokir", type: "bool" },
    { name: "expiresAt", type: "uint64" },
  ],
  LihatBlokir: [
    { name: "who", type: "address" },
    { name: "expiresAt", type: "uint64" },
  ],
} as const;

export const BLOKIR_TYPES = TYPES;

function domain(verifyingContract: Address) {
  return { name: "Nearly", version: "1", chainId: NEARLY_CHAIN_ID, verifyingContract } as const;
}

export function blokirTypedData(msg: BlokirMessage, verifyingContract: Address) {
  return {
    domain: domain(verifyingContract),
    types: { Blokir: TYPES.Blokir },
    primaryType: "Blokir",
    message: msg,
  } as const;
}

export function lihatBlokirTypedData(msg: LihatBlokirMessage, verifyingContract: Address) {
  return {
    domain: domain(verifyingContract),
    types: { LihatBlokir: TYPES.LihatBlokir },
    primaryType: "LihatBlokir",
    message: msg,
  } as const;
}

export function recoverBlokirSigner(
  msg: BlokirMessage, signature: Hex, verifyingContract: Address,
): Promise<Address> {
  return recoverTypedDataAddress({ ...blokirTypedData(msg, verifyingContract), signature });
}

export function recoverLihatBlokirSigner(
  msg: LihatBlokirMessage, signature: Hex, verifyingContract: Address,
): Promise<Address> {
  return recoverTypedDataAddress({ ...lihatBlokirTypedData(msg, verifyingContract), signature });
}
