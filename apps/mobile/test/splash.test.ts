import { describe, expect, it } from "vitest";
import { bolehSembunyikanSplash } from "../src/splash";

// Spec desain UI §3.5: splash disembunyikan setelah font termuat (atau gagal
// dimuat) DAN keadaan dompet bukan "memuat".
describe("bolehSembunyikanSplash", () => {
  it("tetap tampil selama font belum selesai", () => {
    for (const k of ["memuat", "galat", "belum-ada", "siap"] as const) {
      expect(bolehSembunyikanSplash(false, k), k).toBe(false);
    }
  });

  it("tetap tampil selama dompet memuat", () => {
    expect(bolehSembunyikanSplash(true, "memuat")).toBe(false);
  });

  it("disembunyikan saat font selesai dan dompet sudah punya keadaan", () => {
    for (const k of ["galat", "belum-ada", "siap"] as const) {
      expect(bolehSembunyikanSplash(true, k), k).toBe(true);
    }
  });
});
