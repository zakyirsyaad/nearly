import { describe, expect, it } from "vitest";
import { perluIsiNama } from "../src/nama-gerbang";
import { baca, tanpaKomentar } from "./support/berkas";

const layar = () => tanpaKomentar(baca("app/nama.tsx"));

describe("gerbang nama wajib (2026-09-24)", () => {
  it("dompet siap tanpa nama → gerbang menutup", () => {
    expect(perluIsiNama(true, "")).toBe(true);
    expect(perluIsiNama(true, "   ")).toBe(true);
    expect(perluIsiNama(true, null)).toBe(true);
  });

  it("nama terisi → aplikasi terbuka", () => {
    expect(perluIsiNama(true, "Zaky")).toBe(false);
    expect(perluIsiNama(true, "  Zaky  ")).toBe(false);
  });

  it("GAGAL-TERBUKA: selama nama belum diketahui, gerbang tidak pernah menutup", () => {
    // undefined = permintaan profil sedang jalan ATAU gagal (offline).
    // Mengunci orang di luar aplikasinya sendiri karena sinyal jelek jauh
    // lebih buruk daripada satu sesi tanpa nama.
    expect(perluIsiNama(true, undefined)).toBe(false);
  });

  it("tanpa dompet tidak ada gerbang nama — layar Mulai duluan", () => {
    for (const nama of ["", null, undefined, "Zaky"] as const) {
      expect(perluIsiNama(false, nama), String(nama)).toBe(false);
    }
  });
});

describe("layar nama (app/nama.tsx)", () => {
  it("tidak bisa dilewati: tidak ada tombol lewati maupun navigasi keluar selain simpan", () => {
    const isi = layar();
    for (const jalanKeluar of ["Skip", "skip", "router.back()", "Later"]) {
      expect(isi, jalanKeluar).not.toContain(jalanKeluar);
    }
  });

  it("tombol mati selama nama kosong", () => {
    const isi = layar();
    expect(isi).toContain("cek.nama.length > 0");
    expect(isi).toContain("disabled={!bolehLanjut}");
  });

  it("menyimpan lewat jalur profil yang sudah ada, dengan visibilitas bawaan", () => {
    const isi = layar();
    expect(isi).toContain("simpanProfil(signer,");
    expect(isi).toContain('visibilitas: "terlihat"');
  });

  it("setelah tersimpan, gerbang dibuka lalu masuk aplikasi", () => {
    const isi = layar();
    expect(isi).toContain("tandaiNama(cek.nama)");
    expect(isi).toContain('router.replace("/")');
  });

  it("galat simpan tidak merender Error.message (review B1 #I1)", () => {
    const isi = layar();
    const tangkap = isi.slice(isi.indexOf("} catch"), isi.indexOf("} finally"));
    expect(tangkap).toContain("TEKS_GAGAL_SIMPAN");
    expect(tangkap).not.toContain("message");
  });
});
