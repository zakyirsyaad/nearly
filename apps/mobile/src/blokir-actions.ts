import type { Address } from "viem";
import { blokirTypedData } from "@nearly/shared";
import { CONFIG } from "./config";
import { postJson } from "./http";
import type { PenandaSigner } from "./meet-api";
import { tandaiDataBerubah } from "./muat-fokus";

const UMUR_DETIK = 300;

/**
 * SATU-SATUNYA tempat `Blokir` ditandatangani di seluruh aplikasi mobile.
 *
 * Dua tempat menandatangani satu operasi adalah cara termudah salah satunya
 * diperbaiki nanti dan yang lain tertinggal diam-diam — dan di sini yang
 * tertinggal akan berupa blokir yang tidak benar-benar memblokir.
 *
 * `sedangDiblokir` adalah keadaan SEKARANG; yang dikirim kebalikannya.
 */
export async function aksiBlokir(
  signer: PenandaSigner, target: Address, sedangDiblokir: boolean,
): Promise<void> {
  const expiresAt = BigInt(Math.floor(Date.now() / 1000) + UMUR_DETIK);
  const pesan = {
    target, who: signer.address, blokir: !sedangDiblokir, expiresAt,
  };
  const sig = await signer.signTypedData(
    blokirTypedData(pesan, CONFIG.verifyingContract) as never);
  await postJson<{ ok: true }>("/blokir", {
    ...pesan, expiresAt: expiresAt.toString(), sig,
  });
  // Satu tempat untuk semua pemanggil (profil, daftar diblokir, percakapan,
  // lapor): tanpa ini pratinjau Feed di Beranda bisa menampilkan unggahan
  // orang yang baru diblokir sampai 30 detik (review minor m2, Ruling B2-3).
  tandaiDataBerubah();
}
