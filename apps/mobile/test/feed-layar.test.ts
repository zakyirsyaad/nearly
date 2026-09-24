import { describe, expect, it } from "vitest";
import { baca, tanpaKomentar } from "./support/berkas";

const feed = () => tanpaKomentar(baca("app/(tabs)/(beranda)/feed/index.tsx"));
const tulis = () => tanpaKomentar(baca("app/(tabs)/(beranda)/feed/new.tsx"));
const detail = () => tanpaKomentar(baca("app/(tabs)/(beranda)/feed/[postId].tsx"));

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
  /**
   * 2026-09-24: foto iPhone tersimpan sebagai HEIC, jadi pemilih mengembalikan
   * image/heic dan layar menolaknya dengan benar — tapi pengguna jadi tidak
   * bisa melampirkan foto sama sekali. Mode "compatible" membuat iOS
   * mentranskode ke JPEG sebelum menyerahkan berkasnya.
   */
  describe("foto iPhone (HEIC)", () => {
    for (const [nama, isi] of [["feed", feed], ["unggahan baru", tulis]] as const) {
      it(`pemilih ${nama} meminta representasi yang kompatibel`, () => {
        expect(isi()).toContain("preferredAssetRepresentationMode");
        expect(isi()).toContain("UIImagePickerPreferredAssetRepresentationMode.Compatible");
      });
    }

    it("penolakan format lain tetap ada — tidak dilabeli ulang", () => {
      expect(feed()).toContain("PESAN_FORMAT_TIDAK_DIDUKUNG");
      expect(tulis()).toContain("PESAN_FORMAT_TIDAK_DIDUKUNG");
    });
  });

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

/**
 * Layar detail (2026-09-24): kartu feed memotong teks dua baris dan memangkas
 * foto jadi jalur 200 px, jadi harus ada tempat melihat keduanya utuh.
 */
describe("Detail unggahan", () => {
  it("kartu feed membuka detail", () => {
    expect(feed()).toContain("router.push(`/feed/${p.postId}`)");
  });

  it("mengambil ulang dari server, bukan mengoper unggahan lewat parameter navigasi", () => {
    const isi = detail();
    expect(isi).toContain("getPost(");
    expect(isi).toContain("kueriBuktiFeed(signer)");
  });

  it("teks utuh: tidak ada pemotongan baris di layar ini", () => {
    expect(detail()).not.toContain("numberOfLines");
  });

  it("foto memakai rasio aslinya, bukan dipangkas", () => {
    const isi = detail();
    expect(isi).toContain('resizeMode="contain"');
    expect(isi).toContain("aspectRatio");
    expect(isi).toContain("onLoad=");
  });

  it("404 memakai kalimatnya sendiri, bukan kalimat gagal jaringan", () => {
    const isi = detail();
    expect(isi).toContain("TEKS_UNGGAHAN_HILANG");
    expect(isi).toContain("e.status === 404");
  });

  it("aksi memakai modul bersama, jadi tidak menyimpang dari kartu feed", () => {
    const isi = detail();
    for (const aksi of ["sukaUnggahan(", "laporUnggahan(", "hapusUnggahan("]) {
      expect(isi, aksi).toContain(aksi);
    }
    // Hapus hanya untuk unggahan sendiri (spec §10.2), dengan dua ketukan.
    expect(isi).toContain("bisaHapus(");
    expect(isi).toContain("labelHapus(");
  });

  it("kartu feed dan detail memakai satu jalur tanda tangan suka", () => {
    expect(feed()).toContain("sukaUnggahan(");
    expect(feed()).not.toContain("likeTypedData(");
  });
});
