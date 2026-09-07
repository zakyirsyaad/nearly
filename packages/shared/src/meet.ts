import { recoverTypedDataAddress, type Address, type Hex } from "viem";
import { NEARLY_CHAIN_ID } from "./handshake";

/**
 * Perintah TULIS: menandai seseorang, atau mencabut tanda itu.
 *
 * `ingin` sengaja bool, bukan dua tipe terpisah: dengan begini PENCABUTAN
 * ikut ditandatangani. Tanpa itu, siapa pun bisa mencabut tanda orang lain
 * lewat badan permintaan.
 *
 * TIDAK PERNAH naik on-chain (spec §2.3) — apa pun yang naik ke chain publik
 * selamanya, dan penanda ini WAJIB anonim.
 */
export type InginBertemuMessage = {
  target: Address;
  who: Address;
  ingin: boolean;
  expiresAt: bigint;
};

/**
 * Bukti BACA yang mengaku sebagai `who`, dipakai HANYA untuk membuka bendera
 * `sudahKutandai` dan `salingMenandai` di GET /profile/:address.
 *
 * Tipe terpisah dari `InginBertemu`, dan itu wajib. Bukti baca berkeliaran di
 * query string — log akses, proxy, siapa pun yang membaca URL dalam masa
 * berlakunya. Kalau ia sah sebagai perintah tulis, tanda tangan yang bocor
 * bisa dipakai MENANDAI ORANG ATAS NAMA KORBAN, dan menandai bisa memicu
 * pengungkapan identitas. Kelas kesalahan Ruling 23 dari Fase 3a.
 */
export type LihatProfilMessage = {
  target: Address;
  who: Address;
  expiresAt: bigint;
};

/**
 * Bukti BACA untuk daftar kecocokan sendiri. TIDAK mengikat `target` karena
 * membaca kecocokanmu sendiri tidak berbicara tentang satu orang tertentu —
 * yang dibuktikan cuma "aku adalah `who`".
 *
 * Bentuk fieldnya IDENTIK dengan `TandaiDilihat` di bawah, dan itu disengaja.
 * Hanya nama tipenya yang memisahkan bukti BACA dari perintah TULIS, dan
 * itulah satu-satunya hal yang mencegah tanda tangan baca yang bocor lewat
 * query string dipakai menghapus lencana kecocokan orang lain.
 */
export type LihatKecocokanMessage = {
  who: Address;
  expiresAt: bigint;
};

/**
 * Perintah TULIS ke baris sendiri: menandai kecocokan sudah dilihat.
 *
 * Tidak memuat `target` sama sekali karena ia tidak berbicara tentang orang
 * lain. Tipe tersendiri, bukan `LihatProfil` yang dipakai ulang — alasan yang
 * sama seperti di atas: kalau bukti baca sah di sini, siapa pun yang
 * menangkapnya bisa menghapus lencana kecocokan orang lain, menyembunyikan
 * dari mereka bahwa seseorang baru saja saling menandai.
 */
export type TandaiDilihatMessage = {
  who: Address;
  expiresAt: bigint;
};

const TYPES = {
  InginBertemu: [
    { name: "target", type: "address" },
    { name: "who", type: "address" },
    { name: "ingin", type: "bool" },
    { name: "expiresAt", type: "uint64" },
  ],
  LihatProfil: [
    { name: "target", type: "address" },
    { name: "who", type: "address" },
    { name: "expiresAt", type: "uint64" },
  ],
  LihatKecocokan: [
    { name: "who", type: "address" },
    { name: "expiresAt", type: "uint64" },
  ],
  TandaiDilihat: [
    { name: "who", type: "address" },
    { name: "expiresAt", type: "uint64" },
  ],
} as const;

export const MEET_TYPES = TYPES;

function domain(verifyingContract: Address) {
  return { name: "Nearly", version: "1", chainId: NEARLY_CHAIN_ID, verifyingContract } as const;
}

export function inginBertemuTypedData(msg: InginBertemuMessage, verifyingContract: Address) {
  return {
    domain: domain(verifyingContract),
    types: { InginBertemu: TYPES.InginBertemu },
    primaryType: "InginBertemu",
    message: msg,
  } as const;
}

export function lihatProfilTypedData(msg: LihatProfilMessage, verifyingContract: Address) {
  return {
    domain: domain(verifyingContract),
    types: { LihatProfil: TYPES.LihatProfil },
    primaryType: "LihatProfil",
    message: msg,
  } as const;
}

export function lihatKecocokanTypedData(msg: LihatKecocokanMessage, verifyingContract: Address) {
  return {
    domain: domain(verifyingContract),
    types: { LihatKecocokan: TYPES.LihatKecocokan },
    primaryType: "LihatKecocokan",
    message: msg,
  } as const;
}

export function tandaiDilihatTypedData(msg: TandaiDilihatMessage, verifyingContract: Address) {
  return {
    domain: domain(verifyingContract),
    types: { TandaiDilihat: TYPES.TandaiDilihat },
    primaryType: "TandaiDilihat",
    message: msg,
  } as const;
}

export function recoverInginBertemuSigner(
  msg: InginBertemuMessage, signature: Hex, verifyingContract: Address,
): Promise<Address> {
  return recoverTypedDataAddress({ ...inginBertemuTypedData(msg, verifyingContract), signature });
}

export function recoverLihatProfilSigner(
  msg: LihatProfilMessage, signature: Hex, verifyingContract: Address,
): Promise<Address> {
  return recoverTypedDataAddress({ ...lihatProfilTypedData(msg, verifyingContract), signature });
}

export function recoverLihatKecocokanSigner(
  msg: LihatKecocokanMessage, signature: Hex, verifyingContract: Address,
): Promise<Address> {
  return recoverTypedDataAddress({ ...lihatKecocokanTypedData(msg, verifyingContract), signature });
}

export function recoverTandaiDilihatSigner(
  msg: TandaiDilihatMessage, signature: Hex, verifyingContract: Address,
): Promise<Address> {
  return recoverTypedDataAddress({ ...tandaiDilihatTypedData(msg, verifyingContract), signature });
}
