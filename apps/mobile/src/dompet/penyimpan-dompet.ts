import * as SecureStore from "expo-secure-store";
import type { Hex } from "viem";
import { normalisasiKunciPrivat } from "./dompet";

/**
 * Satu-satunya berkas yang menyentuh expo-secure-store (Keychain iOS /
 * Keystore Android). Dijaga test/dompet-tanpa-kunci-dev.test.ts.
 */
export const KUNCI_PENYIMPAN = {
  mnemonik: "nearly.dompet.mnemonik",
  kunci: "nearly.dompet.kunci",
  sudahDicadangkan: "nearly.dompet.sudahDicadangkan",
} as const;

/**
 * WHEN_UNLOCKED_THIS_DEVICE_ONLY: terbaca hanya saat HP tidak terkunci, dan
 * TIDAK ikut cadangan iCloud maupun pindah ke HP baru. Satu-satunya cadangan
 * dompet adalah 12 kata (spec dompet §8 batas #1). Opsi yang sama dipakai di
 * setiap panggilan — baca, tulis, hapus.
 */
export const OPSI_PENYIMPAN: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export type DompetTersimpan = {
  kunci: Hex;
  punyaMnemonik: boolean;
  sudahDicadangkan: boolean;
};

export type DompetBaru = {
  kunci: Hex;
  /** null untuk dompet dari impor kunci privat (khusus pengembangan). */
  mnemonik: string | null;
  sudahDicadangkan: boolean;
};

const baca = (k: string) => SecureStore.getItemAsync(k, OPSI_PENYIMPAN);
const tulis = (k: string, v: string) => SecureStore.setItemAsync(k, v, OPSI_PENYIMPAN);
const hapus = (k: string) => SecureStore.deleteItemAsync(k, OPSI_PENYIMPAN);

/**
 * null = belum ada dompet. Isi kunci yang rusak MELEMPAR, bukan null: null
 * membawa pengguna ke layar Mulai, dan "Buat dompet baru" di sana menimpa
 * identitas yang mungkin masih bisa diselamatkan.
 */
export async function muatDompet(): Promise<DompetTersimpan | null> {
  const kunci = await baca(KUNCI_PENYIMPAN.kunci);
  if (kunci === null) return null;
  const sah = normalisasiKunciPrivat(kunci);
  if (sah === null || sah !== kunci) throw new Error("dompet_rusak");
  const mnemonik = await baca(KUNCI_PENYIMPAN.mnemonik);
  const cadangan = await baca(KUNCI_PENYIMPAN.sudahDicadangkan);
  return { kunci: sah, punyaMnemonik: mnemonik !== null, sudahDicadangkan: cadangan === "1" };
}

/**
 * Menolak menimpa dompet yang sudah ada — dompet lama wajib dihapus lewat
 * `hapusDompet` lebih dulu. Kunci ditulis TERAKHIR: keberadaannya yang
 * menandai dompet ada, jadi penulisan yang terputus di tengah jalan tidak
 * pernah meninggalkan dompet setengah jadi yang terbaca sebagai "siap".
 */
export async function simpanDompet(d: DompetBaru): Promise<void> {
  if ((await baca(KUNCI_PENYIMPAN.kunci)) !== null) throw new Error("dompet_sudah_ada");
  if (d.mnemonik === null) await hapus(KUNCI_PENYIMPAN.mnemonik);
  else await tulis(KUNCI_PENYIMPAN.mnemonik, d.mnemonik);
  if (d.sudahDicadangkan) await tulis(KUNCI_PENYIMPAN.sudahDicadangkan, "1");
  else await hapus(KUNCI_PENYIMPAN.sudahDicadangkan);
  await tulis(KUNCI_PENYIMPAN.kunci, d.kunci);
}

/** 12 kata, dibaca dari penyimpan hanya saat diminta — tidak pernah ditahan di memori. */
export function bacaMnemonik(): Promise<string | null> {
  return baca(KUNCI_PENYIMPAN.mnemonik);
}

export function tandaiSudahDicadangkan(): Promise<void> {
  return tulis(KUNCI_PENYIMPAN.sudahDicadangkan, "1");
}

/** Kunci dihapus PERTAMA, dengan alasan yang sama dengan urutan di `simpanDompet`. */
export async function hapusDompet(): Promise<void> {
  await hapus(KUNCI_PENYIMPAN.kunci);
  await hapus(KUNCI_PENYIMPAN.mnemonik);
  await hapus(KUNCI_PENYIMPAN.sudahDicadangkan);
}
