import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { kunciPesanTypedData, turunkanKunciPesan, VERSI_KUNCI_PESAN } from "@nearly/shared";

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
import { CONFIG } from "../src/config";
import {
  buatDompetBaru, imporDompetKunciDev, imporDompetMnemonik, keadaanPenyimpan, lupakanDompet, muatInfoDompet,
} from "../src/dompet/aksi-dompet";
import { mnemonikSah } from "../src/dompet/dompet";
import { bacaMnemonik, KUNCI_PENYIMPAN } from "../src/dompet/penyimpan-dompet";
import { sesiPesan, type SesiPesan } from "../src/pesan/sesi";
import { bukaBaris, kunciLawan } from "../src/pesan/pesan-actions";

const MNEMONIK_UJI = "test test test test test test test test test test test junk";
const ALAMAT_UJI = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const KUNCI_UJI = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const aslinya = globalThis.fetch;
beforeEach(() => keychain.clear());
afterEach(() => { globalThis.fetch = aslinya; });

describe("buatDompetBaru", () => {
  it("menyimpan kata pemulihan yang sah, belum dicadangkan, dan termuat ulang dengan alamat yang sama", async () => {
    const info = await buatDompetBaru();
    const mnemonik = await bacaMnemonik();
    expect(mnemonik !== null && mnemonikSah(mnemonik)).toBe(true);
    expect(info.punyaMnemonik).toBe(true);
    expect(info.sudahDicadangkan).toBe(false);
    expect(info.address).toBe(privateKeyToAccount(info.kunci).address);
    expect(await muatInfoDompet()).toEqual(info);
  });

  it("menolak saat dompet sudah ada", async () => {
    await buatDompetBaru();
    await expect(buatDompetBaru()).rejects.toThrow("dompet_sudah_ada");
  });
});

describe("imporDompetMnemonik", () => {
  it("vektor uji → alamat yang dikenal, dianggap sudah dicadangkan", async () => {
    const info = await imporDompetMnemonik(`  ${MNEMONIK_UJI.toUpperCase()} `);
    expect(info.address).toBe(ALAMAT_UJI);
    expect(info.sudahDicadangkan).toBe(true);
    expect(await bacaMnemonik()).toBe(MNEMONIK_UJI);
  });

  it("checksum salah → mnemonik_tidak_sah, tidak ada yang tersimpan", async () => {
    await expect(imporDompetMnemonik("test test test test test test test test test test test test"))
      .rejects.toThrow("mnemonik_tidak_sah");
    expect(keychain.size).toBe(0);
  });
});

describe("imporDompetKunciDev", () => {
  it("di luar mode pengembangan selalu ditolak, walau kuncinya sah", async () => {
    await expect(imporDompetKunciDev(KUNCI_UJI, false)).rejects.toThrow("hanya_pengembangan");
    expect(keychain.size).toBe(0);
  });

  it("mode pengembangan: kunci sah → alamatnya, tanpa mnemonik", async () => {
    const info = await imporDompetKunciDev(KUNCI_UJI.slice(2), true);
    expect(info).toEqual({ kunci: KUNCI_UJI, address: ALAMAT_UJI, punyaMnemonik: false, sudahDicadangkan: true });
    expect(await bacaMnemonik()).toBeNull();
  });

  it("kunci tidak sah → kunci_tidak_sah", async () => {
    await expect(imporDompetKunciDev("0x1234", true)).rejects.toThrow("kunci_tidak_sah");
    expect(keychain.size).toBe(0);
  });
});

describe("keadaanPenyimpan", () => {
  it("kosong → belum-ada; ada → siap; isi rusak → galat, bukan belum-ada", async () => {
    expect(await keadaanPenyimpan()).toEqual({ keadaan: "belum-ada" });
    const info = await imporDompetMnemonik(MNEMONIK_UJI);
    expect(await keadaanPenyimpan()).toEqual({ keadaan: "siap", info });
    keychain.set(KUNCI_PENYIMPAN.kunci, "bukan kunci");
    const k = await keadaanPenyimpan();
    expect(k.keadaan).toBe("galat");
    expect(k.keadaan === "galat" && (k.galat as Error).message).toBe("dompet_rusak");
  });
});

describe("lupakanDompet", () => {
  it("menghapus dompet dari penyimpan", async () => {
    await buatDompetBaru();
    await lupakanDompet();
    expect(await muatInfoDompet()).toBeNull();
    expect(keychain.size).toBe(0);
  });

  it("hapus gagal di tengah jalan → dompet_gagal_dihapus, dan keadaan penyimpan tidak lagi siap", async () => {
    await buatDompetBaru();
    // Kunci terhapus, lalu Keychain menolak menghapus 12 kata.
    vi.mocked(SecureStore.deleteItemAsync)
      .mockImplementationOnce(async (k: string) => { keychain.delete(k); })
      .mockImplementationOnce(async () => { throw new Error("User interaction is not allowed"); });
    await expect(lupakanDompet()).rejects.toThrow("dompet_gagal_dihapus");
    expect(keychain.has(KUNCI_PENYIMPAN.kunci)).toBe(false);
    expect(await keadaanPenyimpan()).toEqual({ keadaan: "belum-ada" });
  });

  it("hapus gagal sebelum kunci terhapus → dompet tetap siap dengan kunci yang sama", async () => {
    const info = await buatDompetBaru();
    vi.mocked(SecureStore.deleteItemAsync)
      .mockImplementationOnce(async () => { throw new Error("User interaction is not allowed"); });
    await expect(lupakanDompet()).rejects.toThrow("dompet_gagal_dihapus");
    expect(await keadaanPenyimpan()).toEqual({ keadaan: "siap", info });
  });

  it("membuang sesi pesan, kunci lawan, dan pesan terbuka di memori", async () => {
    const akun = privateKeyToAccount(KUNCI_UJI as Hex);
    const tanda = vi.fn((td: never) => akun.signTypedData(td as Parameters<typeof akun.signTypedData>[0]));
    const signer = { address: akun.address as Address, signTypedData: tanda };
    const kunciSesi = turunkanKunciPesan(await akun.signTypedData(
      kunciPesanTypedData({ who: akun.address, versi: VERSI_KUNCI_PESAN }, CONFIG.verifyingContract)));
    const lawan = { kunciEnkripsi: kunciSesi.pubEnkripsi, kunciTanda: kunciSesi.pubTanda };
    const ambil = vi.fn(async (url: string) =>
      new Response(JSON.stringify(url.includes("/pesan/kunci/") ? lawan : { ok: true }), { status: 200 }));
    globalThis.fetch = ambil as never;

    const sesi: SesiPesan = await sesiPesan(signer);
    await kunciLawan(sesi, ALAMAT_UJI);
    const baris = {
      id: "00000000-0000-4000-8000-000000000001", pengirim: ALAMAT_UJI, penerima: ALAMAT_UJI,
      ciphertext: "QQ==", nonce: `0x${"cd".repeat(24)}` as Hex, createdAtMs: 1, dibacaAtMs: null,
    };
    const terbuka = bukaBaris(sesi, lawan, baris);
    const tandaSebelum = tanda.mock.calls.length;

    await lupakanDompet();

    await sesiPesan(signer);
    expect(tanda.mock.calls.length).toBeGreaterThan(tandaSebelum);
    await kunciLawan(sesi, ALAMAT_UJI);
    expect(ambil.mock.calls.filter((c) => String(c[0]).includes("/pesan/kunci/0x")).length).toBe(2);
    expect(bukaBaris(sesi, lawan, baris)).not.toBe(terbuka);
  });
});
