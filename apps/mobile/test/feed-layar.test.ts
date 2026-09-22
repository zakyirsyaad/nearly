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
    expect(x).toMatch(/kabar\.berhasil\(TEKS_UNGGAHAN_TERKIRIM\);\s*router\.replace\("\/feed"\);/);
    expect(x.indexOf("await postPost(")).toBeLessThan(x.indexOf("await postImage("));
  });

  it("gambar ditolak, bukan dilabeli ulang; Error.message tidak dirender", () => {
    const x = tulis();
    expect(x).toContain("mimeGambarDiterima(aset.mimeType)");
    expect(x).not.toContain("e.message");
  });
});
