import { describe, expect, it } from "vitest";
import { UKURAN } from "../theme/globals";
import { LAYAR_TERMIGRASI } from "../src/judul-layar";
import { baca, tanpaKomentar } from "./support/berkas";

const daftar = () => tanpaKomentar(baca("app/(tabs)/(pesan)/pesan/index.tsx"));
const obrolan = () => tanpaKomentar(baca("app/(tabs)/(pesan)/pesan/[address].tsx"));

describe("daftar Pesan (spec §7.1 pola daftar, §4.7)", () => {
  it("dimigrasi; FlatList judul besar", () => {
    expect(LAYAR_TERMIGRASI.has("(tabs)/(pesan)/pesan/index")).toBe(true);
    expect(daftar()).toContain('contentInsetAdjustmentBehavior="automatic"');
  });

  it("kartu orang dengan alamat singkat (R4), lencana belum dibaca, pratinjau satu baris", () => {
    const x = daftar();
    expect(x).toContain("<KartuOrang");
    expect(x).toContain("teksLencana(item.belumDibaca)");
    expect(x).toContain("barisKeterangan={1}");
    expect(x).not.toContain("{item.lawan}</Text>");
  });

  it("muat pertama gagal → galat + Try again; muat ulang gagal mempertahankan baris; kosong di samping galat bukan keadaan kosong", () => {
    const x = daftar();
    expect(x).not.toContain("setBaris((b) => b ?? [])");
    expect(x).toContain("<KeadaanGalat kalimat={galat} onCobaLagi={cobaLagi} />");
    expect(x).toContain("}, [muat, percobaan]));");
    expect(x).toMatch(/\) : galat \? null : \(/);
  });

  it("polling 15 detik hanya selama fokus tetap", () => {
    expect(daftar()).toContain("setInterval(() => { void jalankan(); }, 15_000);");
  });
});

describe("Percakapan (spec §6.5, R6)", () => {
  it("dimigrasi", () => {
    expect(LAYAR_TERMIGRASI.has("(tabs)/(pesan)/pesan/[address]")).toBe(true);
  });

  it("kepala: avatar, nama dari satu GET /profile publik, alamat singkat, terenkripsi, menu ⋯ berlabel", () => {
    const x = obrolan();
    expect(x).toContain("req<{ displayName?: string }>(`/profile/${lawan}`)");
    expect(x).toContain("<Text variant=\"mono\">{alamatSingkat(lawan)}</Text>");
    expect(x).toContain("{TEKS_TERENKRIPSI}");
    expect(x).toContain("accessibilityLabel={LABEL_OPSI_LAIN}");
  });

  it("menu ⋯ berisi Report dan Block yang sudah ada — dialog bawaan (Ruling B2-10)", () => {
    const x = obrolan();
    const menu = x.slice(x.indexOf("function bukaMenu()"), x.indexOf("function bukaMenu()") + 600);
    expect(menu).toContain("Alert.alert(");
    expect(menu).toContain("router.push(`/pesan/lapor/${lawan}`)");
    expect(menu).toContain("onPress: blokir");
  });

  it("gelembung keluar primary di kanan, masuk card bergaris di kiri, sudut pengirim 4", () => {
    const x = obrolan();
    expect(x).toContain('const kuning = useColor("primary");');
    expect(x).toContain("borderBottomRightRadius: RADIUS.gelembungSudut");
    expect(x).toContain("borderBottomLeftRadius: RADIUS.gelembungSudut");
    expect(x).toContain("borderRadius: RADIUS.gelembung");
  });

  it("tombol kirim 40×40 dengan hitSlop ke 48 dan label dari labelKirimPesan (§3.7)", () => {
    const x = obrolan();
    expect(UKURAN.tombolKirim).toBe(40);
    expect(x).toContain("hitSlop={hitSlopSampai(UKURAN.tombolKirim)}");
    expect(x).toContain("accessibilityLabel={labelKirimPesan(sibuk)}");
  });

  it("tanpa tanda sudah dibaca (R6); pemisah hari lewat perluPemisahHari", () => {
    const x = obrolan();
    expect(x).not.toContain("dibacaAtMs");
    expect(x).toContain("perluPemisahHari(daftar, index)");
  });

  it("perilaku lama tetap: polling 4 dtk, buka bertahap, tandai dibaca lalu lencana dimuat ulang", () => {
    const x = obrolan();
    expect(x).toContain("setInterval(() => { void jalankan(); }, 4_000);");
    expect(x).toContain("bukaBertahap(pesan, buka,");
    expect(x).toMatch(/await postDibaca\([\s\S]*?muatUlangLencana\(\);/);
    expect(x).toContain("<Input");
    expect(x).not.toContain("WARNA");
  });
});

const lapor = () => tanpaKomentar(baca("app/(tabs)/(pesan)/pesan/lapor/[address].tsx"));

describe("Lapor pesan (spec §7.1 pola formulir)", () => {
  it("dimigrasi; Input BNA, tanpa WARNA", () => {
    expect(LAYAR_TERMIGRASI.has("(tabs)/(pesan)/pesan/lapor/[address]")).toBe(true);
    const x = lapor();
    expect(x).toContain("<Input");
    expect(x).not.toContain("WARNA");
  });

  it("hanya pesan MASUK yang terverifikasi yang bisa jadi bukti (spec 4c §8.2)", () => {
    expect(lapor()).toContain('.filter((p): p is PesanSah => !p.dariAku && p.status === "sah")');
  });

  it("baris bukti adalah checkbox aksesibel setinggi target sentuh", () => {
    const x = lapor();
    expect(x).toContain('accessibilityRole="checkbox"');
    expect(x).toContain("accessibilityState={{ checked: dipilihIni }}");
    expect(x).toMatch(/baris: \{[^}]*minHeight: UKURAN\.sentuh/);
  });

  it("peringatan memakai gaya spanduk token; muat pertama gagal → galat + Try again", () => {
    const x = lapor();
    expect(x).toContain('useColor("spandukLatar")');
    expect(x).toContain("{PERINGATAN_LAPOR_PESAN}");
    expect(x).toContain("<KeadaanGalat kalimat={galat} onCobaLagi={() => setPercobaan((n) => n + 1)} />");
    expect(x).not.toContain("setMasuk([])");
  });

  it("laporan terkirim tetap dialog (Ruling B2-7), dan kegagalan blokir tidak menyangkal laporannya", () => {
    const x = lapor();
    expect(x).toContain("Alert.alert(JUDUL_LAPORAN_TERKIRIM, ISI_LAPORAN_TERKIRIM,");
    expect(x).toContain("teksLaporanTerkirimGagalBlokir(");
  });
});
