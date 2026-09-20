import { describe, expect, it } from "vitest";
import { LAYAR_TERMIGRASI } from "../src/judul-layar";
import { baca, tanpaKomentar } from "./support/berkas";

const layar = () => tanpaKomentar(baca("app/(tabs)/(profil)/profil-saya.tsx"));

describe("Profil (tab) baru (spec desain UI §7.1)", () => {
  it("terdaftar termigrasi dan memakai judul besar iOS", async () => {
    expect(LAYAR_TERMIGRASI.has("(tabs)/(profil)/profil-saya")).toBe(true);
    const { opsiTampilan } = await import("../theme/navigasi");
    expect(opsiTampilan("(tabs)/(profil)/profil-saya").headerLargeTitle).toBe(true);
  });

  it("isi berada di dalam ScrollView dengan penyesuaian inset otomatis (§4.7)", () => {
    expect(layar()).toContain('contentInsetAdjustmentBehavior="automatic"');
  });

  it("kepala menampilkan alamat UTUH, jumlah koneksi sebagai pasangan, dan batang trust", () => {
    const isi = layar();
    expect(isi).toContain("{signer.address}");
    expect(isi).toContain("pasanganKoneksi(");
    expect(isi).toContain("<BatangTrust");
  });

  it("daftar tautan lengkap, dengan lencana kecocokan di barisnya", () => {
    const isi = layar();
    for (const t of ["TAUTAN_KONEKSI", "TAUTAN_KECOCOKAN", "TAUTAN_DOMPET", "TAUTAN_BLOKIR"]) {
      expect(isi, t).toContain(t);
    }
    expect(isi).toContain("teksLencana(kecocokanBaru)");
  });

  it("isian nama memakai Input BNA, dan WARNA lama hilang", () => {
    const isi = layar();
    expect(isi).toContain('from "@/components/ui/input"');
    expect(isi).not.toContain("WARNA");
  });

  it("logika simpan tidak berubah: periksaNamaTampilan sebelum mengirim", () => {
    const isi = layar();
    expect(isi).toContain("const cek = periksaNamaTampilan(nama);");
    expect(isi).toContain("if (!cek.ok) {");
    expect(isi).toContain("kabar.berhasil(TEKS_TERSIMPAN)");
  });
});
