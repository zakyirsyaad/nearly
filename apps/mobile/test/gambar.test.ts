import { describe, expect, it } from "vitest";
import {
  MIME_DIDUKUNG, mimeGambarDiterima, PESAN_FORMAT_TIDAK_DIDUKUNG,
} from "../src/gambar";

describe("mimeGambarDiterima", () => {
  it("menerima jpeg dan png apa adanya", () => {
    expect(mimeGambarDiterima("image/jpeg")).toBe("image/jpeg");
    expect(mimeGambarDiterima("image/png")).toBe("image/png");
  });

  /**
   * INTI perbaikan ini. Bentuk lamanya
   * `aset.mimeType === "image/png" ? "image/png" : "image/jpeg"` mengirim
   * byte HEIC atau WebP berlabel image/jpeg — naik ke Greenfield, lalu tidak
   * pernah tampil. `mime` diikat tanda tangan LampirGambar justru supaya
   * tidak bisa diselewengkan.
   */
  it("menolak format lain alih-alih melabelinya ulang jadi jpeg", () => {
    for (const asing of ["image/heic", "image/heif", "image/webp", "image/gif", "application/pdf"]) {
      expect(mimeGambarDiterima(asing)).toBeNull();
    }
  });

  // Galeri bisa tidak melaporkan mimeType sama sekali.
  it("menolak mime yang tidak diketahui", () => {
    expect(mimeGambarDiterima(undefined)).toBeNull();
    expect(mimeGambarDiterima(null)).toBeNull();
    expect(mimeGambarDiterima("")).toBeNull();
  });

  it("mentoleransi huruf besar dan spasi di sekitarnya", () => {
    expect(mimeGambarDiterima(" IMAGE/JPEG ")).toBe("image/jpeg");
  });

  // Daftar putihnya harus sama persis dengan skema server; kalau salah satu
  // bergeser, klien mengirim sesuatu yang pasti ditolak invalid_body.
  it("daftar putihnya persis dua format", () => {
    expect([...MIME_DIDUKUNG]).toEqual(["image/jpeg", "image/png"]);
  });

  it("pesan penolakannya berbahasa Indonesia dan menyebut format yang didukung", () => {
    expect(PESAN_FORMAT_TIDAK_DIDUKUNG).toMatch(/JPEG/);
    expect(PESAN_FORMAT_TIDAK_DIDUKUNG).toMatch(/PNG/);
    expect(PESAN_FORMAT_TIDAK_DIDUKUNG).not.toContain("_");
  });
});
