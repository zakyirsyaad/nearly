import { describe, expect, it } from "vitest";
import { baca, tanpaKomentar } from "./support/berkas";

// Tes baca-kode (tidak ada harness render RN): memastikan komponen bersama
// memakai fungsi murni yang teruji dan aturan spec desain UI §6, §3.7.
describe("komponen bersama", () => {
  it("BatangTrust membangun ruas dari ruasTerisiTrust dan menampilkan label Inggris", () => {
    const isi = baca("components/batang-trust.tsx");
    expect(isi).toContain("ruasTerisiTrust(tier)");
    expect(isi).toContain("labelTier(tier)");
    expect(tanpaKomentar(isi)).not.toContain("%"); // tier tidak pernah persentase (#10f)
  });

  it("Avatar dekoratif untuk pembaca layar dan hurufnya dari hurufAvatar", () => {
    const isi = baca("components/avatar.tsx");
    expect(isi).toContain("accessible={false}");
    expect(isi).toContain("hurufAvatar(nama, alamat)");
  });

  it("KartuOrang selalu menampilkan alamat singkat di sebelah nama (R4)", () => {
    const isi = baca("components/kartu-orang.tsx");
    expect(isi).toContain("namaKartuRadar(nama)");
    expect(isi).toContain("alamatSingkat(alamat)");
  });

  it("Lencana memakai teks bersama", () => {
    const isi = baca("components/lencana.tsx");
    expect(isi).toContain("LENCANA_BERTEMU");
    expect(isi).toContain("LENCANA_RINGKAS");
  });

  it("Segmen dan TautanKecil mencapai target sentuh 48", () => {
    expect(baca("components/segmen.tsx")).toContain("minHeight: UKURAN.sentuh");
    expect(baca("components/tautan-kecil.tsx")).toContain("minHeight: UKURAN.sentuh");
  });

  it("KeadaanGalat memakai tombol Try again bersama", () => {
    expect(baca("components/keadaan.tsx")).toContain("{TEKS_COBA_LAGI}");
  });
});
