import type { Address, Hex } from "viem";

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`env ${name} wajib diisi`);
  return value;
}

export const CONFIG = {
  apiUrl: required("EXPO_PUBLIC_API_URL", process.env.EXPO_PUBLIC_API_URL),
  verifyingContract: required(
    "EXPO_PUBLIC_CONNECTION_REGISTRY",
    process.env.EXPO_PUBLIC_CONNECTION_REGISTRY,
  ) as Address,
  vouchRegistry: required(
    "EXPO_PUBLIC_VOUCH_REGISTRY",
    process.env.EXPO_PUBLIC_VOUCH_REGISTRY,
  ) as Address,
  /** Hanya dipakai kalau __DEV__. Lihat peringatan di signer.ts. */
  devPrivateKey: process.env.EXPO_PUBLIC_DEV_PRIVATE_KEY as Hex | undefined,
};
