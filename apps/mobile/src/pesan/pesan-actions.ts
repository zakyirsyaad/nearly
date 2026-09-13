import type { Address, Hex } from "viem";
import {
  bukaPesan, buatIdPesan, enkripsiPesan, MAKS_ISI_PESAN, reasonHashOf, reportTypedData,
} from "@nearly/shared";
import { CONFIG } from "../config";
import { postJson } from "../http";
import type { PenandaSigner } from "../meet-api";
import type { SesiPesan } from "./sesi";
import { getKunciLawan, postPesan, type BarisPesanApi, type KunciLawan } from "./pesan-api";

const cacheKunciLawan = new Map<string, KunciLawan>();

export async function kunciLawan(sesi: SesiPesan, lawan: string): Promise<KunciLawan> {
  const k = `${sesi.address.toLowerCase()}|${lawan.toLowerCase()}`;
  const ada = cacheKunciLawan.get(k);
  if (ada) return ada;
  const kunci = await getKunciLawan(sesi, lawan);
  cacheKunciLawan.set(k, kunci);
  return kunci;
}

/** Hanya untuk tes. */
export function _resetKunciLawanUntukTes(): void {
  cacheKunciLawan.clear();
}

/**
 * SATU-SATUNYA tempat pesan dienkripsi dan dikirim di aplikasi mobile — aturan
 * yang sama yang membuat blokir-actions.ts ada. Dua tempat mengenkripsi satu
 * operasi adalah cara termudah salah satunya kelak lupa menandatangani amplop.
 */
export async function kirimPesan(sesi: SesiPesan, penerima: Address, isi: string): Promise<void> {
  const teks = isi.trim();
  if (teks.length === 0 || teks.length > MAKS_ISI_PESAN) {
    throw new Error(`isi pesan harus 1–${MAKS_ISI_PESAN} karakter`);
  }
  const k = await kunciLawan(sesi, penerima);
  const { ciphertext, nonce } = enkripsiPesan({
    kunci: sesi.kunci, pubEnkripsiLawan: k.kunciEnkripsi,
    pengirim: sesi.address, penerima, isi: teks, dikirimMs: Date.now(),
  });
  await postPesan(sesi, { id: buatIdPesan(), penerima, ciphertext, nonce });
}

export type PesanTerbuka =
  | { id: string; dariAku: boolean; createdAtMs: number; status: "sah"; isi: string; dikirimMs: number; tanda: Hex }
  | { id: string; dariAku: boolean; createdAtMs: number; status: "tidak_terverifikasi" };

/**
 * Murni. Pesan yang gagal dibuka ditampilkan sebagai "tidak bisa diverifikasi",
 * BUKAN disembunyikan diam-diam (spec 4c §5.2) — pesan yang hilang tanpa jejak
 * membuat pengguna tidak tahu ada yang salah.
 */
export function bukaBaris(sesi: SesiPesan, lawan: KunciLawan, baris: BarisPesanApi): PesanTerbuka {
  const dariAku = baris.pengirim.toLowerCase() === sesi.address.toLowerCase();
  const hasil = bukaPesan({
    kunci: sesi.kunci,
    pubEnkripsiLawan: lawan.kunciEnkripsi,
    pubTandaPengirim: dariAku ? sesi.kunci.pubTanda : lawan.kunciTanda,
    pengirim: baris.pengirim, penerima: baris.penerima,
    ciphertext: baris.ciphertext, nonce: baris.nonce,
  });
  const dasar = { id: baris.id, dariAku, createdAtMs: baris.createdAtMs };
  return hasil.ok
    ? { ...dasar, status: "sah", isi: hasil.amplop.isi, dikirimMs: hasil.amplop.dikirimMs, tanda: hasil.amplop.tanda }
    : { ...dasar, status: "tidak_terverifikasi" };
}

export const MAKS_BUKTI_LAPORAN = 5;
/** Sama dengan `reason.min(10)` di ReportRequestSchema. */
export const MIN_ALASAN_LAPORAN = 10;

export function laporanSiapDikirim(jumlahDipilih: number, alasan: string): boolean {
  return jumlahDipilih >= 1 && jumlahDipilih <= MAKS_BUKTI_LAPORAN
    && alasan.trim().length >= MIN_ALASAN_LAPORAN;
}

/**
 * Lapor dari percakapan (spec 4c §8.2). `Report` terikat VouchRegistry sejak
 * Fase 2 — sama dengan `sendReport` di trust-api.ts.
 */
export async function laporkanPercakapan(
  signer: PenandaSigner, terlapor: Address, alasan: string,
  bukti: { pesanId: string; isi: string; dikirimMs: number; tanda: Hex }[],
): Promise<void> {
  const reason = alasan.trim();
  const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const msg = { reporter: signer.address, subject: terlapor, reasonHash: reasonHashOf(reason), expiresAt };
  const sig = await signer.signTypedData(reportTypedData(msg, CONFIG.vouchRegistry) as never);
  await postJson<{ ok: true }>("/pesan/laporan", {
    laporan: { reporter: signer.address, subject: terlapor, reason, expiresAt: expiresAt.toString(), sig },
    bukti,
  });
}
