import { describe, expect, it } from "vitest";
import { ruteDariNotifikasi } from "../src/pesan/rute-push";

describe("ruteDariNotifikasi", () => {
  it("jenis pesan membuka daftar percakapan", () => {
    expect(ruteDariNotifikasi({ jenis: "pesan" })).toBe("/pesan");
  });

  // Isi push tidak memuat alamat (spec 4c §7.2), jadi rute tidak pernah
  // membuka percakapan tertentu langsung — aplikasi mencarinya lewat API.
  it("data lain atau rusak diabaikan", () => {
    expect(ruteDariNotifikasi({ jenis: "lain" })).toBeNull();
    expect(ruteDariNotifikasi(null)).toBeNull();
    expect(ruteDariNotifikasi("pesan")).toBeNull();
    expect(ruteDariNotifikasi(undefined)).toBeNull();
  });
});
