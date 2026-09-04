import {
  encodeAbiParameters, keccak256, recoverTypedDataAddress, type Address, type Hex,
} from "viem";
import { NEARLY_CHAIN_ID } from "./handshake";

export const MAX_TAGS = 5;
export const MAX_TAG_LENGTH = 24;

export type VouchMessage = {
  from: Address;
  to: Address;
  tagsHash: Hex;
  expiresAt: bigint;
};

export type RevokeMessage = { from: Address; to: Address; expiresAt: bigint };

// WAJIB identik dengan typehash di packages/contracts/src/VouchRegistry.sol.
// Dijaga oleh test kunci di Task 9.
const TYPES = {
  Vouch: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "tagsHash", type: "bytes32" },
    { name: "expiresAt", type: "uint64" },
  ],
  RevokeVouch: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "expiresAt", type: "uint64" },
  ],
} as const;

export const VOUCH_TYPES = TYPES;

function domain(verifyingContract: Address) {
  return { name: "Nearly", version: "1", chainId: NEARLY_CHAIN_ID, verifyingContract } as const;
}

/**
 * Menyeragamkan tag supaya "Solid Dev" dan "solid dev" adalah tag yang sama,
 * dan supaya hash-nya tidak bergantung pada urutan pengguna mengetik.
 */
export function normalizeTags(tags: string[]): string[] {
  const cleaned = tags
    .map((t) => t.trim().toLowerCase().slice(0, MAX_TAG_LENGTH))
    .filter((t) => t.length > 0);
  return [...new Set(cleaned)].sort().slice(0, MAX_TAGS);
}

/**
 * Teks tag hidup di Postgres; hanya hash-nya yang naik on-chain (spec fase §5).
 * Menyimpan array string di BSC mahal tanpa guna, sementara hash sudah cukup
 * membuktikan tag tidak diubah belakangan.
 *
 * Array-nya di-ABI-encode, TIDAK digabung dengan spasi. Menggabung dengan
 * pemisah yang bisa muncul di dalam tag menciptakan tabrakan sungguhan:
 * ["a b", "c"] dan ["a", "b c"] sama-sama menjadi "a b c" dan menghasilkan hash
 * identik — yang persis membatalkan jaminan bahwa hash membuktikan tag tidak
 * diubah. ABI encoding membawa panjang tiap elemen, jadi batas antar tag tidak
 * bisa dikaburkan.
 */
export function tagsHashOf(tags: string[]): Hex {
  return keccak256(encodeAbiParameters([{ type: "string[]" }], [normalizeTags(tags)]));
}

export function vouchTypedData(msg: VouchMessage, verifyingContract: Address) {
  return {
    domain: domain(verifyingContract),
    types: { Vouch: TYPES.Vouch },
    primaryType: "Vouch",
    message: msg,
  } as const;
}

export function revokeTypedData(msg: RevokeMessage, verifyingContract: Address) {
  return {
    domain: domain(verifyingContract),
    types: { RevokeVouch: TYPES.RevokeVouch },
    primaryType: "RevokeVouch",
    message: msg,
  } as const;
}

export function recoverVouchSigner(
  msg: VouchMessage, signature: Hex, verifyingContract: Address,
): Promise<Address> {
  return recoverTypedDataAddress({ ...vouchTypedData(msg, verifyingContract), signature });
}

export function recoverRevokeSigner(
  msg: RevokeMessage, signature: Hex, verifyingContract: Address,
): Promise<Address> {
  return recoverTypedDataAddress({ ...revokeTypedData(msg, verifyingContract), signature });
}
