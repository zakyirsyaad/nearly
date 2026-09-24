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

  /**
   * Bug 2026-09-24: bagian Feed dibungkus `feed === null || feed.length > 0`,
   * sehingga judul DAN satu-satunya tautan ke /feed hilang persis saat feed
   * kosong — yaitu keadaan setiap pengguna baru. Tanpa tautan itu unggahan
   * pertama tidak bisa dibuat, jadi feed tidak akan pernah terisi.
   */
  describe("bagian Feed selalu terjangkau", () => {
    it("tidak pernah disembunyikan saat kosong", () => {
      expect(beranda()).not.toContain("feed.length > 0");
    });

    it("keadaan kosong menawarkan menulis unggahan pertama", () => {
      const isi = beranda();
      expect(isi).toContain("KOSONG_FEED");
      expect(isi).toContain("TEKS_TULIS_SESUATU");
      expect(isi).toContain('router.push("/feed/new")');
    });

    it("tautan lama ke layar Feed tetap ada", () => {
      expect(beranda()).toContain('router.push("/feed")');
    });

    it("gagal muat feed memakai keadaan galat + Coba lagi, bukan keadaan kosong (§7.2)", () => {
      const isi = beranda();
      expect(isi).toContain("galatFeed");
      expect(isi).toContain("TEKS_GAGAL_MUAT_FEED");
      expect(isi).toContain("onCobaLagi={() => void muatFeed()}");
    });

    it("muat ulang yang gagal tidak mengosongkan daftar yang sudah tampil", () => {
      const isi = beranda();
      const muat = isi.slice(isi.indexOf("const muatFeed"), isi.indexOf("const muatSemua"));
      expect(muat).not.toContain("setFeed([])");
    });

    it("cuplikan feed maksimal 4 unggahan (amandemen §6.1, 2026-09-24)", () => {
      expect(beranda()).toContain("const MAKS_FEED = 4");
    });
  });

  it("daftar sepuluh tautan lama hilang", () => {
    const isi = beranda();
    for (const lama of ["Koneksiku", "Daftar blokir", "Profil saya", "Tampilkan QR-ku", "Pindai QR orang lain"]) {
      expect(isi, lama).not.toContain(lama);
    }
  });
});
