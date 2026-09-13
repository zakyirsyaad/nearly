import { recoverTypedDataAddress, type Address, type Hex } from "viem";
import { NEARLY_CHAIN_ID } from "./handshake";

/**
 * BAHAN KUNCI — bukan perintah dan bukan bukti. Tanda tangan atas tipe ini
 * diturunkan menjadi kunci privat pesan (spec 4c §5.1) dan TIDAK PERNAH
 * dikirim ke jaringan. Tanda tangan yang bocor membuka seluruh riwayat pesan.
 *
 * Sengaja tanpa `expiresAt`: tanda tangannya harus selalu sama supaya kunci
 * yang sama bisa diturunkan ulang di perangkat mana pun. Karena itu pula tidak
 * ada `recoverKunciPesanSigner` — tidak ada pihak sah yang perlu memverifikasi
 * tanda tangan ini, dan fungsi recover yang tersedia adalah undangan untuk
 * mengirimnya ke server.
 */
export type KunciPesanMessage = { who: Address; versi: number };

/** Mengikat kunci publik pesan ke dompet. Dikirim satu kali per pendaftaran. */
export type DaftarKunciPesanMessage = {
  who: Address;
  kunciEnkripsi: Hex;
  kunciTanda: Hex;
  expiresAt: bigint;
};

/** Menaikkan angka ini mengganti SEMUA kunci pesan — riwayat lama tak terbaca. */
export const VERSI_KUNCI_PESAN = 1;

const TYPES = {
  KunciPesan: [
    { name: "who", type: "address" },
    { name: "versi", type: "uint32" },
  ],
  DaftarKunciPesan: [
    { name: "who", type: "address" },
    { name: "kunciEnkripsi", type: "bytes32" },
    { name: "kunciTanda", type: "bytes32" },
    { name: "expiresAt", type: "uint64" },
  ],
} as const;

export const PESAN_TYPES = TYPES;

function domain(verifyingContract: Address) {
  return { name: "Nearly", version: "1", chainId: NEARLY_CHAIN_ID, verifyingContract } as const;
}

export function kunciPesanTypedData(msg: KunciPesanMessage, verifyingContract: Address) {
  return {
    domain: domain(verifyingContract),
    types: { KunciPesan: TYPES.KunciPesan },
    primaryType: "KunciPesan",
    message: msg,
  } as const;
}

export function daftarKunciPesanTypedData(msg: DaftarKunciPesanMessage, verifyingContract: Address) {
  return {
    domain: domain(verifyingContract),
    types: { DaftarKunciPesan: TYPES.DaftarKunciPesan },
    primaryType: "DaftarKunciPesan",
    message: msg,
  } as const;
}

export function recoverDaftarKunciPesanSigner(
  msg: DaftarKunciPesanMessage, signature: Hex, verifyingContract: Address,
): Promise<Address> {
  return recoverTypedDataAddress({ ...daftarKunciPesanTypedData(msg, verifyingContract), signature });
}
