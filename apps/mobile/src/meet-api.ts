import type { Address } from "viem";
import {
  lihatKecocokanTypedData, lihatProfilTypedData, tandaiDilihatTypedData,
} from "@nearly/shared";
import { CONFIG } from "./config";
import { postJson, req } from "./http";

/** Bentuk minimal yang dibutuhkan; createDevSigner memenuhinya. */
export type PenandaSigner = {
  address: Address;
  signTypedData: (td: never) => Promise<`0x${string}`>;
};

export type BarisKecocokan = {
  address: string;
  displayName: string;
  tier: number;
  sejakMs: number;
};

/** Lima menit. Sama seperti setiap tanda tangan lain di aplikasi ini. */
const UMUR_DETIK = 300;

const kedaluwarsa = () => BigInt(Math.floor(Date.now() / 1000) + UMUR_DETIK);

/**
 * Bukti baca untuk GET /profile/:address. Mengikat `target`, karena ia
 * membuka bendera tentang HUBUNGAN antara dua orang.
 */
export async function kueriBuktiProfil(
  signer: PenandaSigner, target: Address,
): Promise<string> {
  const expiresAt = kedaluwarsa();
  const sig = await signer.signTypedData(lihatProfilTypedData(
    { target, who: signer.address, expiresAt }, CONFIG.verifyingContract,
  ) as never);
  return new URLSearchParams({
    who: signer.address, expiresAt: expiresAt.toString(), sig,
  }).toString();
}

/**
 * Bukti baca untuk GET /kecocokan. TIDAK mengikat target — membaca
 * kecocokanmu sendiri tidak berbicara tentang satu orang tertentu.
 *
 * Tipe LihatKecocokan, BUKAN TandaiDilihat: bentuk fieldnya identik, tapi
 * yang kedua perintah TULIS.
 */
export async function kueriBuktiKecocokan(signer: PenandaSigner): Promise<string> {
  const expiresAt = kedaluwarsa();
  const sig = await signer.signTypedData(lihatKecocokanTypedData(
    { who: signer.address, expiresAt }, CONFIG.verifyingContract,
  ) as never);
  return new URLSearchParams({
    who: signer.address, expiresAt: expiresAt.toString(), sig,
  }).toString();
}

export function getKecocokan(kueri: string) {
  return req<{ kecocokan: BarisKecocokan[]; baru: number }>(`/kecocokan?${kueri}`);
}

export async function tandaiKecocokanDilihat(signer: PenandaSigner): Promise<void> {
  const expiresAt = kedaluwarsa();
  const sig = await signer.signTypedData(tandaiDilihatTypedData(
    { who: signer.address, expiresAt }, CONFIG.verifyingContract,
  ) as never);
  await postJson<{ ok: true }>("/kecocokan/dilihat", {
    who: signer.address, expiresAt: expiresAt.toString(), sig,
  });
}
