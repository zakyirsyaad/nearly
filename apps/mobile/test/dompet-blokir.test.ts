import { describe, expect, it } from "vitest";
import { LAYAR_TERMIGRASI } from "../src/judul-layar";
import { baca, tanpaKomentar } from "./support/berkas";

const dompet = () => tanpaKomentar(baca("app/(tabs)/(profil)/dompet.tsx"));
const blokir = () => tanpaKomentar(baca("app/(tabs)/(profil)/blokir.tsx"));

describe("layar Dompet (spec §7.1 pola detail)", () => {
  it("terdaftar termigrasi", () => {
    expect(LAYAR_TERMIGRASI.has("(tabs)/(profil)/dompet")).toBe(true);
  });

  it("alamat tampil UTUH (R4) dan 12 kata hanya setelah konfirmasi", () => {
    const isi = dompet();
    expect(isi).toContain("{address}");
    expect(isi).toContain("Alert.alert(JUDUL_DIALOG_12_KATA");
    expect(isi).toContain("tampilkanMnemonik()");
  });

  it("aksi destruktif memakai varian destructive, bukan warna literal", () => {
    const isi = dompet();
    expect(isi).toContain('variant="destructive"');
    expect(isi).not.toContain("#b00");
  });

  it("12 kata tidak pernah masuk log", () => {
    expect(dompet()).not.toMatch(/console\.(log|warn|error|info|debug)/);
  });
});

describe("layar Diblokir (spec §7.1, §7.2)", () => {
  it("terdaftar termigrasi", () => {
    expect(LAYAR_TERMIGRASI.has("(tabs)/(profil)/blokir")).toBe(true);
  });

  it("daftar kosong DI SAMPING galat tetap bukan keadaan kosong", () => {
    expect(blokir()).toContain("galatMuat ? null : (");
  });

  it("kegagalan MUAT ULANG setelah cabut tidak mengaku aksinya gagal", () => {
    const isi = blokir();
    expect(isi).toContain("TEKS_BLOKIR_DICABUT_GAGAL_MUAT");
    expect(isi).toContain("teksGagalBlokir(true)");
  });

  it("tanpa warna literal lagi", () => {
    const isi = blokir();
    for (const warna of ["#b00", "#666", "#eee"]) expect(isi, warna).not.toContain(warna);
  });
});
