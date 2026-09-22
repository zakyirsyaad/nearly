import { describe, expect, it } from "vitest";
import { baca, tanpaKomentar } from "./support/berkas";

const beranda = () => tanpaKomentar(baca("app/(tabs)/(beranda)/index.tsx"));

// Tes baca-kode (tidak ada harness render RN), pola yang sama dengan
// test/salaman.test.ts.
describe("Beranda baru (spec desain UI §6.1)", () => {
  it("tanpa header dan berlatar gelap", async () => {
    const { opsiTampilan } = await import("../theme/navigasi");
    expect(opsiTampilan("(tabs)/(beranda)/index").headerShown).toBe(false);
  });

  it("isi berada di dalam SafeAreaView + ScrollView dengan penyesuaian inset otomatis", () => {
    const isi = beranda();
    expect(isi).toContain("<SafeAreaView");
    expect(isi).toContain('contentInsetAdjustmentBehavior="automatic"');
  });

  it("sapaan per jam dan alamat SINGKAT mono di kepala (#16C)", () => {
    const isi = beranda();
    expect(isi).toContain("sapaan(new Date())");
    expect(isi).toContain("alamatSingkat(signer.address)");
  });

  it("Copy menyalin alamat UTUH, bukan yang disingkat, lalu toast + getar ringan", () => {
    const isi = beranda();
    expect(isi).toContain("Clipboard.setStringAsync(signer.address)");
    expect(isi).toContain("kabar.disalin(TEKS_ALAMAT_DISALIN)");
    expect(isi).toContain("accessibilityLabel={LABEL_SALIN_ALAMAT}");
  });

  it("gagal menyalin tidak memunculkan kalimat galat baru (#16C)", () => {
    const isi = beranda();
    const salin = isi.slice(isi.indexOf("async function salinAlamat"), isi.indexOf("const muatNama"));
    expect(salin).toContain("catch {");
    expect(salin).not.toContain("setPesan");
  });

  it("setiap bagian memuat dan gagal sendiri", () => {
    const isi = beranda();
    for (const nama of ["muatNama", "muatLive", "muatKoneksi", "muatFeed"]) {
      expect(isi, nama).toContain(`const ${nama} = useCallback(`);
    }
    // Empat pemuat, empat penangkap galat: satu bagian yang gagal tidak
    // menutup bagian lain (spec §6.1).
    expect([...isi.matchAll(/\bcatch\b/g)].length).toBeGreaterThanOrEqual(4);
  });

  it("memuat saat fokus, paling sering sekali per 30 detik (§4.6)", () => {
    const isi = beranda();
    expect(isi).toContain("useMuatSaatFokus(muatSemua);");
  });

  it('"Recently met" memakai KartuOrang dan waktu relatif', () => {
    const isi = beranda();
    expect(isi).toContain("<KartuOrang");
    expect(isi).toContain("waktuRelatif(");
    expect(isi).toContain("KOSONG_KONEKSI");
  });

  it("daftar sepuluh tautan lama hilang", () => {
    const isi = beranda();
    for (const lama of ["Koneksiku", "Daftar blokir", "Profil saya", "Tampilkan QR-ku", "Pindai QR orang lain"]) {
      expect(isi, lama).not.toContain(lama);
    }
  });
});
