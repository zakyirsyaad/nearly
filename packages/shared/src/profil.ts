import { recoverTypedDataAddress, type Address, type Hex } from "viem";
import { NEARLY_CHAIN_ID } from "./handshake";

/** Satu saklar per akun, bukan per acara (spec 4b+5 §3). Default `terlihat`. */
export const VISIBILITAS = ["terlihat", "tersembunyi"] as const;
export type Visibilitas = (typeof VISIBILITAS)[number];

/**
 * Perintah TULIS: nama tampilan dan visibilitas sekaligus (spec 4b+5 §7.1, R2).
 *
 * Satu tipe untuk keduanya, dengan sengaja. Keduanya selalu dikirim bersama
 * dari layar Profil saya, dan dua tipe terpisah hanya menambah satu popup
 * dompet tanpa menambah keamanan.
 *
 * Tidak ada tipe BACA pasangannya: `GET /profil/saya` diautentikasi header sesi
 * Ed25519 Fase 4c, bukan bukti EIP-712 (R1). Karena itu tidak ada bukti baca
 * yang bisa bocor lewat query string lalu diputar ulang sebagai perintah ini
 * (Ruling 23).
 *
 * TIDAK PERNAH naik on-chain. Nama tampilan dan visibilitas adalah data
 * off-chain milik pengguna.
 */
export type AturProfilMessage = {
  who: Address;
  displayName: string;
  visibilitas: Visibilitas;
  expiresAt: bigint;
};

const TYPES = {
  AturProfil: [
    { name: "who", type: "address" },
    { name: "displayName", type: "string" },
    { name: "visibilitas", type: "string" },
    { name: "expiresAt", type: "uint64" },
  ],
} as const;

export const PROFIL_TYPES = TYPES;

function domain(verifyingContract: Address) {
  return { name: "Nearly", version: "1", chainId: NEARLY_CHAIN_ID, verifyingContract } as const;
}

export function aturProfilTypedData(msg: AturProfilMessage, verifyingContract: Address) {
  return {
    domain: domain(verifyingContract),
    types: { AturProfil: TYPES.AturProfil },
    primaryType: "AturProfil",
    message: msg,
  } as const;
}

export function recoverAturProfilSigner(
  msg: AturProfilMessage, signature: Hex, verifyingContract: Address,
): Promise<Address> {
  return recoverTypedDataAddress({ ...aturProfilTypedData(msg, verifyingContract), signature });
}
