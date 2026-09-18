import { describe, expect, it } from "vitest";
import { hitSlopSampai, TARGET_SENTUH } from "../src/aksesibilitas";
import { judulSheetBertemu } from "../src/messages";
import { hurufAvatar, LENCANA_BERTEMU, LENCANA_RINGKAS, TEKS_COBA_LAGI } from "../src/teks-ui";
import { UKURAN } from "../theme/globals";

const ALAMAT = `0x9bE5${"0".repeat(32)}6ffA`;

describe("hurufAvatar (spec desain UI §6)", () => {
  it("huruf pertama nama yang di-trim, huruf besar", () => {
    expect(hurufAvatar("rina", ALAMAT)).toBe("R");
    expect(hurufAvatar("  budi ", ALAMAT)).toBe("B");
    expect(hurufAvatar("émile", ALAMAT)).toBe("É");
  });

  it("tanpa nama: karakter pertama setelah 0x, huruf besar", () => {
    expect(hurufAvatar(null, ALAMAT)).toBe("9");
    expect(hurufAvatar("", `0xab${"0".repeat(38)}`)).toBe("A");
    expect(hurufAvatar("   ", `0xcd${"0".repeat(38)}`)).toBe("C");
  });
});

describe("judulSheetBertemu (spec §6.2, R14)", () => {
  it("nama yang di-trim tidak kosong → You met ‹nama›", () => {
    expect(judulSheetBertemu("Rina", ALAMAT)).toBe("You met Rina");
    expect(judulSheetBertemu("  Rina ", ALAMAT)).toBe("You met Rina");
  });

  it("nama kosong, spasi, atau null → You met ‹alamat singkat›", () => {
    for (const nama of ["", "   ", null]) {
      expect(judulSheetBertemu(nama, ALAMAT)).toBe("You met 0x9bE5…6ffA");
    }
  });
});

describe("teks bersama baru (spec §7.3)", () => {
  it("lencana dan tombol galat berbahasa Inggris", () => {
    expect(LENCANA_BERTEMU).toBe("✓ met in person");
    expect(LENCANA_RINGKAS).toBe("✓");
    expect(TEKS_COBA_LAGI).toBe("Try again");
  });
});

describe("hitSlopSampai (spec §3.7)", () => {
  it("target sentuh 48 sama dengan token UKURAN.sentuh", () => {
    expect(TARGET_SENTUH).toBe(48);
    expect(UKURAN.sentuh).toBe(TARGET_SENTUH);
  });

  it("tombol kirim 40×40 mendapat 4 di tiap sisi", () => {
    expect(hitSlopSampai(40)).toEqual({ top: 4, bottom: 4, left: 4, right: 4 });
  });

  it("yang sudah ≥ 48 tidak mendapat tambahan", () => {
    expect(hitSlopSampai(52)).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
  });

  it("tautan teks lebar tapi pendek hanya ditambah tingginya", () => {
    expect(hitSlopSampai(100, 20)).toEqual({ top: 14, bottom: 14, left: 0, right: 0 });
  });
});
