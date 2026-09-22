import { describe, expect, it } from "vitest";
import {
  kataBernomor, perluPengingatCadangan, peringatanGantiDompet, pesanGalatDompet,
} from "../src/dompet/teks-dompet";

describe("perluPengingatCadangan", () => {
  it("hanya dompet dari 12 kata yang belum ditandai sudah dicatat", () => {
    expect(perluPengingatCadangan({ punyaMnemonik: true, sudahDicadangkan: false })).toBe(true);
    expect(perluPengingatCadangan({ punyaMnemonik: true, sudahDicadangkan: true })).toBe(false);
    // Impor kunci privat (khusus pengembangan): tidak ada kata untuk dicatat.
    expect(perluPengingatCadangan({ punyaMnemonik: false, sudahDicadangkan: false })).toBe(false);
  });
});

describe("peringatanGantiDompet", () => {
  it("belum dicatat → peringatan paling keras, menyebut hilang selamanya", () => {
    const t = peringatanGantiDompet({ punyaMnemonik: true, sudahDicadangkan: false });
    expect(t).toContain("NOT");
    expect(t).toContain("gone forever");
  });

  it("sudah dicatat → hanya lewat 12 kata pemulihan", () => {
    expect(peringatanGantiDompet({ punyaMnemonik: true, sudahDicadangkan: true })).toContain("12-word recovery phrase");
  });

  it("tanpa mnemonik → menyebut kunci privat", () => {
    expect(peringatanGantiDompet({ punyaMnemonik: false, sudahDicadangkan: true })).toContain("private key");
  });
});

describe("kataBernomor", () => {
  it("bernomor mulai dari satu, urutan dipertahankan", () => {
    expect(kataBernomor("abandon ability able")).toEqual(["1. abandon", "2. ability", "3. able"]);
  });
});

describe("pesanGalatDompet", () => {
  it("setiap kode galat dompet punya kalimat sendiri", () => {
    const kode = ["mnemonik_tidak_sah", "kunci_tidak_sah", "hanya_pengembangan", "dompet_sudah_ada", "dompet_rusak",
      "dompet_tidak_konsisten", "entropi_lemah",
      "dompet_gagal_dihapus"];
    const kalimat = kode.map((k) => pesanGalatDompet(new Error(k)));
    expect(new Set(kalimat).size).toBe(kode.length);
    for (const t of kalimat) expect(t).not.toBe(pesanGalatDompet(new Error("lain")));
  });

  it("galat lain (mis. Keychain) → kalimat umum, tanpa pesan mentah", () => {
    expect(pesanGalatDompet(new Error("User interaction is not allowed"))).toBe("Couldn't set up the wallet. Try again.");
    expect(pesanGalatDompet("bukan Error")).toBe("Couldn't set up the wallet. Try again.");
  });
});
