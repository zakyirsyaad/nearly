import type { Address, Hex } from "viem";

export type SignerChoice = { kind: "wallet" | "dev" | "none" };

/**
 * Aturan pemilihan signer, sengaja dipisah sebagai fungsi murni TANPA impor
 * wagmi, supaya bisa diuji tanpa memasang seluruh tumpukan wallet — terutama
 * aturan terakhir, yang mencegah private key pengembangan ikut aktif di build
 * produksi. Perakitannya dengan wagmi ada di use-nearly-signer.ts.
 */
export function pickSigner(opts: {
  walletAddress: Address | undefined;
  devPrivateKey: Hex | undefined;
  isDev: boolean;
}): SignerChoice {
  if (opts.walletAddress) return { kind: "wallet" };
  if (opts.isDev && opts.devPrivateKey) return { kind: "dev" };
  return { kind: "none" };
}
