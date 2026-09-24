import { describe, expect, it } from "vitest";
import { baca, tanpaKomentar } from "./support/berkas";

const feed = () => tanpaKomentar(baca("app/(tabs)/(beranda)/feed/index.tsx"));
const tulis = () => tanpaKomentar(baca("app/(tabs)/(beranda)/feed/new.tsx"));

describe("Feed (spec §7.1 pola daftar)", () => {
  it("FlatList", () => {
    expect(feed()).toContain('contentInsetAdjustmentBehavior="automatic"');
  });

  it("kartu: nama penulis + alamat singkat (R4) dan alasan muncul (spec induk §10.3)", () => {
    const x = feed();
    expect(x).toContain("namaKartuRadar(p.displayName)");
    expect(x).toContain("alamatSingkat(p.author)");
    expect(x).toContain("alasanMuncul(p.hop, p.displayName)");
  });

  it("perilaku lama tetap: bukti LihatFeed setiap muat, tandai dijaga dari ketukan ganda, hapus dua ketukan", () => {
    const x = feed();
    expect(x).toContain("getFeed(await kueriBuktiFeed(signer))");
    expect(x).toContain("if (tandaiBusyId === p.postId) return;");
    expect(x).toContain("konfirmasiHapus === p.postId");
    expect(x).toContain("aksiTanda(signer, p.author as Address, false)");
  });

  it("muat pertama gagal → galat + Try again; muat ulang gagal mempertahankan unggahan", () => {
    const x = feed();
    expect(x).toContain("<KeadaanGalat kalimat={galatMuat} onCobaLagi={() => void muat()} />");
    expect(x).not.toContain("setPosts([])");
    expect(x).toContain('<KeadaanKosong');
  });

  /**
   * 2026-09-24: feed hanya memuat saat layar difokuskan, jadi unggahan orang
   * lain tidak pernah muncul selama layar dibiarkan terbuka.
   */
  describe("kesegaran feed", () => {
    it("bisa ditarik untuk menyegarkan", () => {
      const isi = feed();
      expect(isi).toContain("RefreshControl");
      expect(isi).toContain("refreshControl=");
    });

    it("menyegarkan sendiri tiap 20 detik SELAMA layar fokus, dan intervalnya dibersihkan", () => {
      const isi = feed();
      expect(isi).toContain("JEDA_SEGARKAN_FEED_MS");
      expect(isi).toContain("setInterval");
      expect(isi).toContain("clearInterval");
    });

    it("interval hidup di dalam useFocusEffect, bukan useEffect biasa", () => {
      const isi = feed();
      const blok = isi.slice(isi.indexOf("setInterval") - 600, isi.indexOf("setInterval"));
      expect(blok).toContain("useFocusEffect");
    });
  });

  it("m9b: tautan penulis mencapai target sentuh 48 lewat UKURAN (review minor m9)", () => {
    const x = feed();
    expect(x).toContain('import { RADIUS, UKURAN } from "@/theme/globals";');
    const blokPenulis = x.slice(x.indexOf("penulis: {"), x.indexOf("penulis: {") + 200);
    expect(blokPenulis).toContain("minHeight: UKURAN.sentuh");
  });
});

describe("Unggahan baru (spec §7.1 pola formulir)", () => {
  it("Input BNA, tanpa WARNA", () => {
    const x = tulis();
    expect(x).toContain("<Input");
    expect(x).not.toContain("WARNA");
    expect(x).toContain("teksSisaKarakter(sisa)");
  });

  it("berhasil → toast + haptic lalu kembali ke feed; gambar dikirim SETELAH teks terbit (spec §8.2)", () => {
    const x = tulis();
    // Gambar gagal → toast memakai kalimat gambar-gagal yang sudah ada, bukan
    // "Posted." (review akhir B2 m5, keputusan pemilik 2026-09-22).
    expect(x).toMatch(/kabar\.berhasil\(gambarGagal \? TEKS_TERBIT_GAMBAR_GAGAL : TEKS_UNGGAHAN_TERKIRIM\);\s*router\.replace\("\/feed"\);/);
    expect(x).not.toContain("setPesan(TEKS_TERBIT_GAMBAR_GAGAL)");
    expect(x.indexOf("await postPost(")).toBeLessThan(x.indexOf("await postImage("));
  });

  it("gambar ditolak, bukan dilabeli ulang; Error.message tidak dirender", () => {
    const x = tulis();
    expect(x).toContain("mimeGambarDiterima(aset.mimeType)");
    expect(x).not.toContain("e.message");
  });
});
