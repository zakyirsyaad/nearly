import { describe, expect, it } from "vitest";
import { LAYAR_TERMIGRASI } from "../src/judul-layar";
import { baca, tanpaKomentar } from "./support/berkas";

const daftar = () => tanpaKomentar(baca("app/(tabs)/(acara)/events/index.tsx"));
const detail = () => tanpaKomentar(baca("app/(tabs)/(acara)/events/[id].tsx"));

describe("daftar Acara (spec §7.1 pola daftar, §4.7)", () => {
  it("dimigrasi dan dibangun di FlatList untuk judul besar", () => {
    expect(LAYAR_TERMIGRASI.has("(tabs)/(acara)/events/index")).toBe(true);
    expect(daftar()).toContain('contentInsetAdjustmentBehavior="automatic"');
  });

  it("acara LIVE di atas daftar; waktu lewat metaAcara, bukan toLocaleString", () => {
    const x = daftar();
    expect(x).toContain("liveDulu(events, kini)");
    expect(x).toContain("metaAcara(acara, new Date(kiniMs))");
    expect(x).not.toContain("toLocale");
  });

  it("empat keadaan: kerangka, galat + Try again, kosong + Create event", () => {
    const x = daftar();
    expect(x).toContain("<KerangkaDaftar />");
    expect(x).toContain("<KeadaanGalat kalimat={galat} onCobaLagi={() => void load()} />");
    expect(x).toMatch(/<KeadaanKosong\s+Ikon=\{CalendarDays\}\s+kalimat=\{KOSONG_ACARA\}\s+aksi=\{\{ label: TEKS_BUAT_ACARA, onPress: buat \}\}/);
  });

  it("memuat saat fokus lewat useMuatSaatFokus; gagal muat mempertahankan daftar dan tidak merender Error.message", () => {
    const x = daftar();
    expect(x).toContain("useMuatSaatFokus(load);");
    expect(x).not.toContain("setEvents([])");
    expect(x).not.toContain("e.message");
  });
});

describe("Detail acara (spec §7.1 pola detail)", () => {
  it("dimigrasi", () => {
    expect(LAYAR_TERMIGRASI.has("(tabs)/(acara)/events/[id]")).toBe(true);
  });

  it("gagal muat → galat + Try again, bukan kerangka selamanya", () => {
    expect(detail()).toMatch(/if \(!ev\) \{[\s\S]*?galatMuat \? \(\s*<KeadaanGalat kalimat=\{galatMuat\} onCobaLagi=\{\(\) => void load\(\)\} \/>/);
  });

  it("Handshake mode Scan dibuka lewat navigate lintas tab; radar dan QR host lewat push", () => {
    const x = detail();
    expect(x).toContain('router.navigate("/salaman?mode=pindai")');
    expect(x).toContain("router.push(`/radar/${ev.eventId}`)");
    expect(x).toContain("router.push(`/events/${ev.eventId}/host-qr`)");
  });

  it("angka penanda hadir tetap lewat fungsi gerbang — undefined bukan nol (spec 4a §4.3)", () => {
    const x = detail();
    expect(x).toContain("teksPenandaHadir(ev.penandaHadir)");
    expect(x).toContain("teksKutandaiHadir(ev.kutandaiHadir)");
    expect(x).toContain("barisPenandaHadir !== null ?");
    expect(x).toContain("barisKutandaiHadir !== null ?");
  });

  it("tanggal lewat formatTanggalJam; memuat saat fokus lewat useMuatSaatFokus (Ruling B2-3)", () => {
    const x = detail();
    expect(x).toContain("formatTanggalJam(new Date(Number(ev.startsAt) * 1000), new Date())");
    expect(x).not.toContain("toLocale");
    expect(x).toContain("useMuatSaatFokus(load);");
  });

  it("bukti baca LihatEvent, bukan Rsvp (tipe yang sama dengan POST bisa diputar ulang)", () => {
    const x = detail();
    const muat = x.slice(x.indexOf("const load = useCallback("), x.indexOf("useMuatSaatFokus(load);"));
    expect(muat).toContain("lihatEventTypedData(");
    expect(muat).not.toContain("rsvpTypedData(");
  });
});
