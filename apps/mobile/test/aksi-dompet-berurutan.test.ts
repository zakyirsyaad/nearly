import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Keychain tiruan BERLATENSI: setiap panggilan menunggu 0–8 ms acak, sehingga
 * dua operasi dompet yang berjalan bersamaan saling bersilang seperti di HP
 * (ketukan ganda dalam satu frame). Mock tanpa latensi di aksi-dompet.test.ts
 * tidak pernah memperlihatkan ras ini.
 */
const keychain = vi.hoisted(() => new Map<string, string>());
const kait = vi.hoisted(() => ({ setelahTulis: null as null | ((k: string) => void) }));

vi.mock("expo-secure-store", () => {
  const tunda = () => new Promise<void>((r) => { setTimeout(r, Math.floor(Math.random() * 8)); });
  return {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 4,
    getItemAsync: vi.fn(async (k: string) => { await tunda(); return keychain.get(k) ?? null; }),
    setItemAsync: vi.fn(async (k: string, v: string) => {
      await tunda();
      keychain.set(k, v);
      kait.setelahTulis?.(k);
    }),
    deleteItemAsync: vi.fn(async (k: string) => { await tunda(); keychain.delete(k); }),
  };
});

import {
  buatDompetBaru, imporDompetKunciDev, imporDompetMnemonik, lupakanDompet, muatInfoDompet,
} from "../src/dompet/aksi-dompet";
import { kunciDariMnemonik } from "../src/dompet/dompet";
import { bacaMnemonik, KUNCI_PENYIMPAN } from "../src/dompet/penyimpan-dompet";

const MNEMONIK_UJI = "test test test test test test test test test test test junk";
const KUNCI_UJI = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
// Vektor resmi BIP-39 (entropi nol) — sah, tetapi dompet yang berbeda.
const MNEMONIK_LAIN = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const PERCOBAAN = 8;

beforeEach(() => {
  keychain.clear();
  kait.setelahTulis = null;
});

/** Kunci tersimpan harus kunci turunan 12 kata tersimpan — itu yang dicatat pengguna. */
async function periksaKonsisten(): Promise<string> {
  const info = await muatInfoDompet();
  const m = await bacaMnemonik();
  expect(info).not.toBeNull();
  expect(m).not.toBeNull();
  expect(kunciDariMnemonik(m!)).toBe(info!.kunci);
  return info!.kunci;
}

describe("operasi dompet berurutan (ketukan ganda)", () => {
  it("dua buatDompetBaru bersamaan: tepat satu berhasil, yang lain dompet_sudah_ada, penyimpan konsisten", async () => {
    for (let n = 0; n < PERCOBAAN; n++) {
      keychain.clear();
      const hasil = await Promise.allSettled([buatDompetBaru(), buatDompetBaru()]);
      const berhasil = hasil.filter((h) => h.status === "fulfilled");
      const gagal = hasil.filter((h): h is PromiseRejectedResult => h.status === "rejected");
      expect(berhasil).toHaveLength(1);
      expect(gagal).toHaveLength(1);
      expect((gagal[0]!.reason as Error).message).toBe("dompet_sudah_ada");
      const kunciTersimpan = await periksaKonsisten();
      // Kunci di memori (yang menandatangani) = kunci di Keychain.
      expect((berhasil[0] as PromiseFulfilledResult<{ kunci: string }>).value.kunci).toBe(kunciTersimpan);
    }
  }, 60_000);

  it("buat dan impor 12 kata bersamaan: tepat satu berhasil, penyimpan konsisten", async () => {
    for (let n = 0; n < PERCOBAAN; n++) {
      keychain.clear();
      const hasil = await Promise.allSettled([buatDompetBaru(), imporDompetMnemonik(MNEMONIK_UJI)]);
      expect(hasil.filter((h) => h.status === "fulfilled")).toHaveLength(1);
      await periksaKonsisten();
    }
  }, 60_000);

  it("impor kunci-dev bersamaan dengan buat: tidak pernah kunci-dev bersama 12 kata dompet lain", async () => {
    for (let n = 0; n < PERCOBAAN; n++) {
      keychain.clear();
      const hasil = await Promise.allSettled([buatDompetBaru(), imporDompetKunciDev(KUNCI_UJI, true)]);
      expect(hasil.filter((h) => h.status === "fulfilled")).toHaveLength(1);
      const info = await muatInfoDompet();
      const m = await bacaMnemonik();
      if (info!.kunci === KUNCI_UJI) expect(m).toBeNull();
      else expect(kunciDariMnemonik(m!)).toBe(info!.kunci);
    }
  }, 60_000);

  it("Ganti dompet lalu buat baru, dipanggil bersamaan: hapus selesai dulu, dompet baru utuh", async () => {
    for (let n = 0; n < PERCOBAAN; n++) {
      keychain.clear();
      await imporDompetMnemonik(MNEMONIK_UJI);
      const [hapus, buat] = await Promise.allSettled([lupakanDompet(), buatDompetBaru()]);
      expect(hapus.status).toBe("fulfilled");
      expect(buat.status).toBe("fulfilled");
      const kunci = await periksaKonsisten();
      expect(kunci).not.toBe(KUNCI_UJI);
    }
  }, 60_000);
});

describe("pemeriksaan setelah menyimpan", () => {
  it("12 kata tersimpan bukan milik kunci tersimpan → gagal keras dan dompet setengah jadi dihapus", async () => {
    // Penulis lain menimpa 12 kata tepat setelah kunci ditulis.
    kait.setelahTulis = (k) => { if (k === KUNCI_PENYIMPAN.kunci) keychain.set(KUNCI_PENYIMPAN.mnemonik, MNEMONIK_LAIN); };
    await expect(buatDompetBaru()).rejects.toThrow("dompet_tidak_konsisten");
    expect(keychain.has(KUNCI_PENYIMPAN.kunci)).toBe(false);
  });

  it("impor 12 kata juga diperiksa", async () => {
    kait.setelahTulis = (k) => { if (k === KUNCI_PENYIMPAN.kunci) keychain.set(KUNCI_PENYIMPAN.mnemonik, MNEMONIK_LAIN); };
    await expect(imporDompetMnemonik(MNEMONIK_UJI)).rejects.toThrow("dompet_tidak_konsisten");
    expect(keychain.has(KUNCI_PENYIMPAN.kunci)).toBe(false);
  });

  it("kunci tersimpan berbeda dengan kunci di memori → gagal keras", async () => {
    kait.setelahTulis = (k) => { if (k === KUNCI_PENYIMPAN.kunci) keychain.set(KUNCI_PENYIMPAN.kunci, KUNCI_UJI); };
    await expect(buatDompetBaru()).rejects.toThrow("dompet_tidak_konsisten");
    expect(keychain.has(KUNCI_PENYIMPAN.kunci)).toBe(false);
  });
});
