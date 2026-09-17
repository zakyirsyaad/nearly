import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Hex } from "viem";

/**
 * expo-secure-store adalah modul native: memuat aslinya di Node menarik
 * react-native dan gagal. Pabrik vi.mock menggantinya SEBELUM impor apa pun
 * (vi.mock diangkat ke atas berkas), dengan Map di memori sebagai Keychain.
 */
const keychain = vi.hoisted(() => new Map<string, string>());

vi.mock("expo-secure-store", () => ({
  WHEN_UNLOCKED: 0,
  AFTER_FIRST_UNLOCK: 1,
  ALWAYS: 2,
  WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: 3,
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 4,
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 5,
  ALWAYS_THIS_DEVICE_ONLY: 6,
  getItemAsync: vi.fn(async (k: string) => keychain.get(k) ?? null),
  setItemAsync: vi.fn(async (k: string, v: string) => { keychain.set(k, v); }),
  deleteItemAsync: vi.fn(async (k: string) => { keychain.delete(k); }),
}));

import * as SecureStore from "expo-secure-store";
import {
  bacaMnemonik, hapusDompet, KUNCI_PENYIMPAN, muatDompet, OPSI_PENYIMPAN, simpanDompet,
  tandaiSudahDicadangkan,
} from "../src/dompet/penyimpan-dompet";

const KUNCI = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as Hex;
const MNEMONIK = "test test test test test test test test test test test junk";

beforeEach(() => {
  keychain.clear();
  vi.clearAllMocks();
});

describe("penyimpan dompet", () => {
  it("kosong → muatDompet null", async () => {
    expect(await muatDompet()).toBeNull();
  });

  it("simpan lalu muat — dompet dari 12 kata, belum dicadangkan", async () => {
    await simpanDompet({ kunci: KUNCI, mnemonik: MNEMONIK, sudahDicadangkan: false });
    expect(await muatDompet()).toEqual({ kunci: KUNCI, punyaMnemonik: true, sudahDicadangkan: false });
    expect(await bacaMnemonik()).toBe(MNEMONIK);
  });

  it("dompet dari kunci privat tidak punya mnemonik", async () => {
    keychain.set(KUNCI_PENYIMPAN.mnemonik, "sisa dompet lama");
    await simpanDompet({ kunci: KUNCI, mnemonik: null, sudahDicadangkan: true });
    expect(await muatDompet()).toEqual({ kunci: KUNCI, punyaMnemonik: false, sudahDicadangkan: true });
    expect(await bacaMnemonik()).toBeNull();
  });

  it("tandaiSudahDicadangkan tersimpan", async () => {
    await simpanDompet({ kunci: KUNCI, mnemonik: MNEMONIK, sudahDicadangkan: false });
    await tandaiSudahDicadangkan();
    expect((await muatDompet())?.sudahDicadangkan).toBe(true);
  });

  it("menolak menimpa dompet yang sudah ada", async () => {
    await simpanDompet({ kunci: KUNCI, mnemonik: MNEMONIK, sudahDicadangkan: false });
    const lain = `0x${"11".repeat(32)}` as Hex;
    await expect(simpanDompet({ kunci: lain, mnemonik: null, sudahDicadangkan: true }))
      .rejects.toThrow("dompet_sudah_ada");
    expect((await muatDompet())?.kunci).toBe(KUNCI);
  });

  it("kunci ditulis terakhir", async () => {
    await simpanDompet({ kunci: KUNCI, mnemonik: MNEMONIK, sudahDicadangkan: false });
    const tulisan = vi.mocked(SecureStore.setItemAsync).mock.calls.map((c) => c[0]);
    expect(tulisan.at(-1)).toBe(KUNCI_PENYIMPAN.kunci);
  });

  it("hapusDompet menghapus ketiganya, kunci lebih dulu", async () => {
    await simpanDompet({ kunci: KUNCI, mnemonik: MNEMONIK, sudahDicadangkan: true });
    vi.clearAllMocks();
    await hapusDompet();
    expect(keychain.size).toBe(0);
    expect(vi.mocked(SecureStore.deleteItemAsync).mock.calls[0]?.[0]).toBe(KUNCI_PENYIMPAN.kunci);
    expect(await muatDompet()).toBeNull();
  });

  it("isi kunci yang rusak melempar, bukan dianggap belum ada", async () => {
    keychain.set(KUNCI_PENYIMPAN.kunci, "bukan kunci");
    await expect(muatDompet()).rejects.toThrow("dompet_rusak");
  });

  it("setiap panggilan memakai WHEN_UNLOCKED_THIS_DEVICE_ONLY", async () => {
    expect(OPSI_PENYIMPAN).toEqual({ keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    await simpanDompet({ kunci: KUNCI, mnemonik: MNEMONIK, sudahDicadangkan: false });
    await muatDompet();
    await bacaMnemonik();
    await tandaiSudahDicadangkan();
    await hapusDompet();
    const semua = [
      ...vi.mocked(SecureStore.getItemAsync).mock.calls.map((c) => c[1]),
      ...vi.mocked(SecureStore.setItemAsync).mock.calls.map((c) => c[2]),
      ...vi.mocked(SecureStore.deleteItemAsync).mock.calls.map((c) => c[1]),
    ];
    expect(semua.length).toBeGreaterThan(0);
    for (const opsi of semua) {
      expect(opsi).toEqual({ keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    }
  });
});
