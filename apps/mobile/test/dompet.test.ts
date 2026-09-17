import { describe, expect, it } from "vitest";
import { english, generateMnemonic, mnemonicToAccount, privateKeyToAccount } from "viem/accounts";
import { hexToBytes, type Hex } from "viem";
import {
  alamatDariKunci, buatMnemonik, JUMLAH_KATA, kunciDariMnemonik, kunciPrivatSah,
  mnemonikDariEntropi, mnemonikSah, normalisasiKunciPrivat, normalisasiMnemonik,
} from "../src/dompet/dompet";

// Vektor uji standar (Hardhat/Anvil): dompet pertama dari 12 kata ini.
const MNEMONIK_UJI = "test test test test test test test test test test test junk";
const ALAMAT_UJI = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const KUNCI_UJI = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

describe("mnemonikDariEntropi — vektor resmi BIP-39 (Trezor)", () => {
  const vektor: [string, string][] = [
    ["00".repeat(16), "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"],
    ["7f".repeat(16), "legal winner thank year wave sausage worth useful legal winner thank yellow"],
    ["80".repeat(16), "letter advice cage absurd amount doctor acoustic avoid letter advice cage above"],
    ["ff".repeat(16), "zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong"],
  ];
  for (const [entropi, kata] of vektor) {
    it(`entropi ${entropi.slice(0, 4)}… → ${kata.split(" ")[0]}…`, () => {
      expect(mnemonikDariEntropi(hexToBytes(`0x${entropi}` as Hex))).toBe(kata);
    });
  }

  it("menolak entropi yang bukan 16 bait", () => {
    expect(() => mnemonikDariEntropi(new Uint8Array(32))).toThrow();
  });
});

describe("mnemonikSah", () => {
  it("menerima vektor uji", () => {
    expect(mnemonikSah(MNEMONIK_UJI)).toBe(true);
  });

  it("menolak checksum salah — kata sah, urutan sah, bit terakhir salah", () => {
    // mnemonicToAccount milik viem MENERIMA ini; itu sebabnya pemeriksaan sendiri ada.
    expect(mnemonikSah("test test test test test test test test test test test test")).toBe(false);
  });

  it("menolak kata di luar daftar English", () => {
    expect(mnemonikSah("test test test test test test test test test test test jank")).toBe(false);
  });

  it("menolak jumlah kata yang salah", () => {
    expect(mnemonikSah("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art")).toBe(false);
    expect(mnemonikSah("")).toBe(false);
  });

  it("menerima huruf besar, spasi ganda, dan baris baru", () => {
    expect(mnemonikSah("  Test test\ttest  test\ntest test test test test test test JUNK \n")).toBe(true);
  });

  it("sepakat dengan generateMnemonic viem", () => {
    for (let i = 0; i < 25; i++) expect(mnemonikSah(generateMnemonic(english))).toBe(true);
  });
});

describe("normalisasiMnemonik", () => {
  it("huruf kecil dan satu spasi di antara kata", () => {
    expect(normalisasiMnemonik("  Test\n\nTEST test ")).toBe("test test test");
  });
});

describe("buatMnemonik", () => {
  it("menghasilkan kata yang sah, berbeda setiap kali", () => {
    const a = buatMnemonik();
    const b = buatMnemonik();
    expect(a.split(" ")).toHaveLength(JUMLAH_KATA);
    expect(mnemonikSah(a)).toBe(true);
    expect(mnemonikSah(b)).toBe(true);
    expect(a).not.toBe(b);
  });
});

describe("kunciDariMnemonik", () => {
  it("vektor uji → kunci dan alamat yang dikenal (jalur m/44'/60'/0'/0/0)", () => {
    const kunci = kunciDariMnemonik(MNEMONIK_UJI);
    expect(kunci).toBe(KUNCI_UJI);
    expect(alamatDariKunci(kunci)).toBe(ALAMAT_UJI);
  });

  it("sama dengan mnemonicToAccount viem untuk mnemonik acak", () => {
    const m = buatMnemonik();
    expect(alamatDariKunci(kunciDariMnemonik(m))).toBe(mnemonicToAccount(m).address);
  });

  it("menormalkan dulu — huruf besar dan spasi tidak mengubah alamat", () => {
    expect(alamatDariKunci(kunciDariMnemonik(`  ${MNEMONIK_UJI.toUpperCase()}  `))).toBe(ALAMAT_UJI);
  });

  it("melempar untuk mnemonik tidak sah", () => {
    expect(() => kunciDariMnemonik("test test test test test test test test test test test test"))
      .toThrow("mnemonik_tidak_sah");
  });
});

describe("normalisasiKunciPrivat / kunciPrivatSah", () => {
  it("menerima dengan atau tanpa 0x, huruf besar menjadi kecil", () => {
    expect(normalisasiKunciPrivat(KUNCI_UJI)).toBe(KUNCI_UJI);
    expect(normalisasiKunciPrivat(`  ${KUNCI_UJI.slice(2).toUpperCase()} `)).toBe(KUNCI_UJI);
    expect(kunciPrivatSah(KUNCI_UJI)).toBe(true);
  });

  it("menolak panjang salah, bukan hex, nol, dan di atas orde kurva", () => {
    expect(normalisasiKunciPrivat(KUNCI_UJI.slice(0, 64))).toBeNull();
    expect(normalisasiKunciPrivat(`0x${"zz".repeat(32)}`)).toBeNull();
    expect(normalisasiKunciPrivat(`0x${"00".repeat(32)}`)).toBeNull();
    expect(normalisasiKunciPrivat(`0x${"ff".repeat(32)}`)).toBeNull();
    expect(kunciPrivatSah(MNEMONIK_UJI)).toBe(false);
  });

  it("alamatDariKunci sama dengan privateKeyToAccount", () => {
    expect(alamatDariKunci(KUNCI_UJI as Hex)).toBe(privateKeyToAccount(KUNCI_UJI as Hex).address);
  });
});
