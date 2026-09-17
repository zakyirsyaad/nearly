import type { Address, Hex } from "viem";
import {
  alamatDariKunci, buatMnemonik, kunciDariMnemonik, mnemonikSah, normalisasiKunciPrivat,
  normalisasiMnemonik,
} from "./dompet";
import { hapusDompet, muatDompet, simpanDompet } from "./penyimpan-dompet";
import { lupakanSemuaSesiPesan } from "../pesan/sesi";
import { lupakanCacheBuka, lupakanCacheKunciLawan } from "../pesan/pesan-actions";

/**
 * Alur dompet tanpa React — dipakai konteks-dompet.tsx, diuji di
 * test/aksi-dompet.test.ts dengan expo-secure-store di-mock. Setiap galat
 * dilempar sebagai `Error(kode)`; kalimatnya di teks-dompet.ts.
 */
export type InfoDompet = {
  kunci: Hex;
  address: Address;
  punyaMnemonik: boolean;
  sudahDicadangkan: boolean;
};

export async function muatInfoDompet(): Promise<InfoDompet | null> {
  const d = await muatDompet();
  return d === null ? null : { ...d, address: alamatDariKunci(d.kunci) };
}

export async function buatDompetBaru(): Promise<InfoDompet> {
  const mnemonik = buatMnemonik();
  const kunci = kunciDariMnemonik(mnemonik);
  await simpanDompet({ kunci, mnemonik, sudahDicadangkan: false });
  return { kunci, address: alamatDariKunci(kunci), punyaMnemonik: true, sudahDicadangkan: false };
}

export async function imporDompetMnemonik(teks: string): Promise<InfoDompet> {
  const mnemonik = normalisasiMnemonik(teks);
  if (!mnemonikSah(mnemonik)) throw new Error("mnemonik_tidak_sah");
  const kunci = kunciDariMnemonik(mnemonik);
  // Yang mengetik 12 kata sudah memegang cadangannya — tanpa spanduk pengingat.
  await simpanDompet({ kunci, mnemonik, sudahDicadangkan: true });
  return { kunci, address: alamatDariKunci(kunci), punyaMnemonik: true, sudahDicadangkan: true };
}

/**
 * Khusus pengembangan (spec dompet R5): memakai lagi identitas uji lama.
 * `modePengembangan` diisi `__DEV__` oleh pemanggil — penjaga kedua setelah
 * tombolnya yang hanya dirender saat `__DEV__`.
 */
export async function imporDompetKunciDev(teks: string, modePengembangan: boolean): Promise<InfoDompet> {
  if (!modePengembangan) throw new Error("hanya_pengembangan");
  const kunci = normalisasiKunciPrivat(teks);
  if (kunci === null) throw new Error("kunci_tidak_sah");
  await simpanDompet({ kunci, mnemonik: null, sudahDicadangkan: true });
  return { kunci, address: alamatDariKunci(kunci), punyaMnemonik: false, sudahDicadangkan: true };
}

/**
 * Menghapus dompet dari HP, lalu semua yang di memori terikat ke dompet itu:
 * sesi pesan (kunci privat pesan), kunci lawan, dan isi pesan yang sudah dibuka.
 */
export async function lupakanDompet(): Promise<void> {
  try {
    lupakanSemuaSesiPesan();
    lupakanCacheKunciLawan();
    lupakanCacheBuka();
  } finally {
    await hapusDompet();
  }
}
