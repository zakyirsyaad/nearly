import type { Address } from "viem";
import {
  daftarKunciPesanTypedData, kunciPesanTypedData, turunkanKunciPesan, VERSI_KUNCI_PESAN,
  type KunciPesanTurunan,
} from "@nearly/shared";
import { CONFIG } from "../config";
import { postJson } from "../http";
import type { PenandaSigner } from "../meet-api";

export type SesiPesan = { address: Address; kunci: KunciPesanTurunan };

const UMUR_DETIK = 300;

/**
 * Satu sesi per dompet per kali buka aplikasi. Promise-nya yang disimpan,
 * bukan hasilnya, supaya dua layar yang meminta sesi bersamaan tidak memicu
 * dua tanda tangan dan dua pendaftaran.
 *
 * Kunci privat hanya di memori (spec 4c §5.1). Menutup aplikasi membuangnya;
 * membuka lagi menurunkannya ulang dari tanda tangan yang sama.
 */
const sesiPerAlamat = new Map<string, Promise<SesiPesan>>();

export function sesiPesan(signer: PenandaSigner): Promise<SesiPesan> {
  const kunciMap = signer.address.toLowerCase();
  let sesi = sesiPerAlamat.get(kunciMap);
  if (!sesi) {
    sesi = bukaSesi(signer);
    sesiPerAlamat.set(kunciMap, sesi);
    // Sesi yang gagal tidak boleh tersimpan: tanpa ini, satu gangguan jaringan
    // saat pendaftaran mematikan pesan sampai aplikasi ditutup.
    sesi.catch(() => sesiPerAlamat.delete(kunciMap));
  }
  return sesi;
}

async function bukaSesi(signer: PenandaSigner): Promise<SesiPesan> {
  // Tanda tangan ini BAHAN KUNCI. Ia hidup hanya di baris-baris ini — tidak
  // disimpan, tidak dikirim, tidak dicatat (spec 4c §6).
  const bahan = await signer.signTypedData(
    kunciPesanTypedData({ who: signer.address, versi: VERSI_KUNCI_PESAN }, CONFIG.verifyingContract) as never);
  const kunci = turunkanKunciPesan(bahan);

  const expiresAt = BigInt(Math.floor(Date.now() / 1000) + UMUR_DETIK);
  const pesan = {
    who: signer.address, kunciEnkripsi: kunci.pubEnkripsi, kunciTanda: kunci.pubTanda, expiresAt,
  };
  const sig = await signer.signTypedData(
    daftarKunciPesanTypedData(pesan, CONFIG.verifyingContract) as never);
  await postJson<{ ok: true }>("/pesan/kunci", { ...pesan, expiresAt: expiresAt.toString(), sig });

  return { address: signer.address, kunci };
}

/**
 * Membuang semua sesi di memori. Dipanggil saat dompet dihapus dari HP (Ganti
 * dompet): kunci privat pesan dompet lama tidak boleh tinggal di memori
 * setelah dompetnya pergi.
 */
export function lupakanSemuaSesiPesan(): void {
  sesiPerAlamat.clear();
}
