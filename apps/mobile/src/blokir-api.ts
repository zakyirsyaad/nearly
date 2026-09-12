import type { Address } from "viem";
import { lihatBlokirTypedData } from "@nearly/shared";
import { CONFIG } from "./config";
import { req } from "./http";
import type { PenandaSigner } from "./meet-api";

/** Satu baris di layar daftar blokir. */
export type BarisBlokir = { address: string; atMs: number };

const UMUR_DETIK = 300;
const kedaluwarsa = () => BigInt(Math.floor(Date.now() / 1000) + UMUR_DETIK);

/**
 * Bukti BACA untuk `GET /blokir`. Dibangun dengan `lihatBlokirTypedData` dan
 * TIDAK PERNAH yang lain — `LihatKecocokan` dan `TandaiDilihat` berbentuk
 * field identik `{ who, expiresAt }`, dan memakai salah satunya di sini
 * berarti satu tanda tangan bisa dipakai untuk dua hal berbeda.
 *
 * `signer.address` masuk kueri APA ADANYA. Server memvalidasinya dengan
 * `isAddress` yang strict EIP-55: alamat dari viem sudah checksummed dan
 * lolos, tapi alamat huruf campur yang dirakit tangan akan ditolak 403.
 */
export async function kueriBuktiBlokir(signer: PenandaSigner): Promise<string> {
  const expiresAt = kedaluwarsa();
  const sig = await signer.signTypedData(
    lihatBlokirTypedData({ who: signer.address, expiresAt }, CONFIG.verifyingContract) as never);
  return new URLSearchParams({
    who: signer.address, expiresAt: expiresAt.toString(), sig,
  }).toString();
}

export function getBlokir(kueri: string): Promise<{ blokir: BarisBlokir[] }> {
  return req<{ blokir: BarisBlokir[] }>(`/blokir?${kueri}`);
}
