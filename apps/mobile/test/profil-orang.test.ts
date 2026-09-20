import { describe, expect, it } from "vitest";
import { LAYAR_TERMIGRASI } from "../src/judul-layar";
import { baca, tanpaKomentar } from "./support/berkas";

const profil = () => tanpaKomentar(baca("app/profile/[address].tsx"));

describe("urutan Profil orang (keputusan #16A)", () => {
  it("terdaftar termigrasi", () => {
    expect(LAYAR_TERMIGRASI.has("profile/[address]")).toBe(true);
  });

  it("baris aksi berada di bawah kepala dan SEBELUM kartu Trust", () => {
    const isi = profil().slice(profil().indexOf("return ("));
    const kepala = isi.indexOf("UKURAN.avatarKepala");
    const aksi = isi.indexOf("TEKS_KIRIM_PESAN");
    const trust = isi.indexOf("JUDUL_TRUST");
    expect(kepala).toBeGreaterThan(-1);
    expect(kepala).toBeLessThan(aksi);
    expect(aksi).toBeLessThan(trust);
  });

  it("Vouch, Report, dan Block berada paling bawah, Block terakhir", () => {
    const isi = profil().slice(profil().indexOf("return ("));
    const onchain = isi.indexOf("JUDUL_ONCHAIN");
    expect(onchain).toBeLessThan(isi.indexOf("TEKS_VOUCH"));
    expect(isi.indexOf("TEKS_VOUCH")).toBeLessThan(isi.indexOf("TEKS_LAPOR"));
    expect(isi.indexOf("TEKS_LAPOR")).toBeLessThan(isi.indexOf("blokirTombolLabel("));
  });

  it("kartu Trust menaruh nilai tier di atas batang, dengan label kecil di atasnya", () => {
    const isi = profil();
    const label = isi.indexOf("{JUDUL_TRUST}");
    const nilai = isi.indexOf("tierView(trust.tier, trust.evidence).label");
    const batang = isi.indexOf("<BatangTrust");
    expect(label).toBeLessThan(nilai);
    expect(nilai).toBeLessThan(batang);
    // Batang dan label tier dikelompokkan jadi satu elemen aksesibel (§3.7).
    expect(isi).toContain("accessibilityLabel={labelAksesTrust(trust.tier)}");
  });
});

describe("dua medan baru API di layar Profil orang (spec §8.1, §8.2)", () => {
  it("lencana memakai ekor '· N events together' hanya bila pertemuan ada", () => {
    const isi = profil();
    expect(isi).toContain("ekorLencanaPertemuan(p.pertemuan)");
    expect(isi).toContain("{p.pertemuan ? <Lencana");
  });

  it("kartu Meetings hanya muncul bila pertemuan ada", () => {
    const isi = profil();
    const kartu = isi.indexOf("{JUDUL_PERTEMUAN}");
    expect(kartu).toBeGreaterThan(-1);
    expect(isi.slice(0, kartu)).toMatch(/p\.pertemuan \?[\s\S]*$/);
    expect(isi).toContain("barisSalaman(p.pertemuan, kini)");
    expect(isi).toContain("barisAcaraBersama(a, kini)");
  });

  it("'Vouched for by …' dibangun fungsi murni, dan 0 tidak merender apa pun", () => {
    const isi = profil();
    expect(isi).toContain("teksDijaminKenalan(p.dijaminKenalan)");
    expect(isi).toContain("{penjamin ? <Text");
  });

  it("kartu On-chain details memakai pasangan nilai/label (§7.1)", () => {
    const isi = profil();
    expect(isi).toContain("pasanganKoneksi(p.connectionCount)");
    expect(isi).toContain("pasanganTransaksi(p.txCount)");
  });
});

describe("perilaku layar Profil orang tidak berubah (keputusan #12)", () => {
  it("gerbang absen-lawan-nol tetap memeriksa !== undefined, bukan truthiness", () => {
    expect(profil()).toContain("p.sudahKublokir !== undefined");
  });

  it("percakapan tetap dibuka dengan navigate, bukan push (Ruling A9)", () => {
    const isi = profil();
    expect(isi).toContain("router.navigate(`/pesan/${address}`)");
    expect(isi).not.toContain("router.push(");
  });

  it("isian alasan laporan memakai Input BNA, bukan TextInput react-native", () => {
    const isi = profil();
    expect(isi).toContain('from "@/components/ui/input"');
    expect(isi).not.toContain("WARNA");
  });

  it("vouch dan laporan yang berhasil pindah ke toast (spec §7.2)", () => {
    const isi = profil();
    expect(isi).toContain("kabar.berhasil(TEKS_VOUCH_TERKIRIM)");
    expect(isi).toContain("kabar.berhasil(TEKS_LAPORAN_DITERIMA)");
  });
});
