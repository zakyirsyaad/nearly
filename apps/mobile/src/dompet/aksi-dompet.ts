import type { Address, Hex } from "viem";
import {
  alamatDariKunci, buatMnemonik, kunciDariMnemonik, mnemonikSah, normalisasiKunciPrivat,
  normalisasiMnemonik,
} from "./dompet";
import { bacaMnemonik, hapusDompet, muatDompet, simpanDompet, type DompetBaru } from "./penyimpan-dompet";
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

/**
 * Antrian tingkat modul: buat, impor, dan lupakan berjalan SATU per SATU.
 * `simpanDompet` memeriksa "sudah ada?" lalu menulis — dua pemanggilan yang
 * bertumpang tindih (ketukan ganda dalam satu frame) sama-sama lolos
 * pemeriksaan, dan tulisan mereka bersilang: 12 kata tersimpan bisa milik
 * dompet lain daripada kunci tersimpan. Dengan antrian, pemanggilan kedua
 * menunggu, lalu melihat dompet pertama dan ditolak `dompet_sudah_ada`.
 */
let antrian: Promise<unknown> = Promise.resolve();

function berurutan<T>(aksi: () => Promise<T>): Promise<T> {
  const hasil = antrian.then(aksi);
  antrian = hasil.catch(() => undefined);
  return hasil;
}

/**
 * Simpan, lalu baca ulang dari penyimpan: kunci tersimpan harus kunci ini dan
 * 12 kata tersimpan harus 12 kata ini. Karena `d.kunci` diturunkan dari
 * `d.mnemonik`, dua kesamaan itu berarti kunci tersimpan = kunci turunan 12
 * kata tersimpan — tanpa PBKDF2 kedua. Bila tidak cocok, dompet yang baru
 * ditulis dihapus (belum pernah dipakai menandatangani) dan galat dilempar:
 * lebih baik gagal sekarang daripada pengguna mencatat 12 kata dompet lain.
 */
async function simpanLaluPeriksa(d: DompetBaru): Promise<void> {
  await simpanDompet(d);
  const tersimpan = await muatDompet().catch(() => null);
  const mnemonik = await bacaMnemonik();
  if (tersimpan?.kunci !== d.kunci || mnemonik !== d.mnemonik) {
    await hapusDompet();
    throw new Error("dompet_tidak_konsisten");
  }
}

export function buatDompetBaru(): Promise<InfoDompet> {
  return berurutan(async () => {
    const mnemonik = buatMnemonik();
    const kunci = kunciDariMnemonik(mnemonik);
    await simpanLaluPeriksa({ kunci, mnemonik, sudahDicadangkan: false });
    return { kunci, address: alamatDariKunci(kunci), punyaMnemonik: true, sudahDicadangkan: false };
  });
}

export function imporDompetMnemonik(teks: string): Promise<InfoDompet> {
  return berurutan(async () => {
    const mnemonik = normalisasiMnemonik(teks);
    if (!mnemonikSah(mnemonik)) throw new Error("mnemonik_tidak_sah");
    const kunci = kunciDariMnemonik(mnemonik);
    // Yang mengetik 12 kata sudah memegang cadangannya — tanpa spanduk pengingat.
    await simpanLaluPeriksa({ kunci, mnemonik, sudahDicadangkan: true });
    return { kunci, address: alamatDariKunci(kunci), punyaMnemonik: true, sudahDicadangkan: true };
  });
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
  return berurutan(async () => {
    await simpanLaluPeriksa({ kunci, mnemonik: null, sudahDicadangkan: true });
    return { kunci, address: alamatDariKunci(kunci), punyaMnemonik: false, sudahDicadangkan: true };
  });
}

/**
 * Menghapus dompet dari HP, lalu semua yang di memori terikat ke dompet itu:
 * sesi pesan (kunci privat pesan), kunci lawan, dan isi pesan yang sudah dibuka.
 */
export function lupakanDompet(): Promise<void> {
  return berurutan(async () => {
    try {
      lupakanSemuaSesiPesan();
      lupakanCacheKunciLawan();
      lupakanCacheBuka();
    } finally {
      await hapusDompet();
    }
  });
}
