import { describe, expect, it } from "vitest";
import { baca, tanpaKomentar } from "./support/berkas";

const daftar = () => tanpaKomentar(baca("app/(tabs)/(acara)/events/index.tsx"));
const detail = () => tanpaKomentar(baca("app/(tabs)/(acara)/events/[id].tsx"));

describe("daftar Acara (spec §7.1 pola daftar, §4.7)", () => {
  it("dibangun di FlatList untuk judul besar", () => {
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

const buat = () => tanpaKomentar(baca("app/(tabs)/(acara)/events/new.tsx"));
const qrHost = () => tanpaKomentar(baca("app/(tabs)/(acara)/events/[id]/host-qr.tsx"));

describe("Buat acara (spec §7.1 pola formulir)", () => {
  it("label kecil di atas Input BNA", () => {
    const x = buat();
    expect(x).toContain('<Text variant="caption">{LABEL_NAMA_ACARA}</Text>');
    expect(x).toContain('<Text variant="caption">{LABEL_TEMPAT_ACARA}</Text>');
    expect(x).not.toContain("WARNA");
  });

  it("berhasil → toast + generasi data naik, lalu pindah ke detail", () => {
    const x = buat();
    const berhasil = x.slice(x.indexOf("await postCreateEvent("), x.indexOf("router.replace(`/events/${eventId}`)"));
    expect(berhasil).toContain("kabar.berhasil(TEKS_ACARA_DIBUAT);");
    expect(berhasil).toContain("tandaiDataBerubah();");
  });

  it("galat bukan ApiError tidak merender Error.message (Ruling B2-14)", () => {
    const x = buat();
    expect(x).toContain("kalimatGagalAcara(e, TEKS_GAGAL_BUAT_ACARA)");
    expect(x).not.toContain("e.message");
  });
});

describe("QR check-in host (spec §4.6, §7.1 pola detail)", () => {
  it("QR hanya dipasang saat layar fokus (review Rencana A #2)", () => {
    const x = qrHost();
    expect(x).toContain("const fokus = useIsFocused();");
    expect(x).toContain("return fokus ? <QrCheckInAktif signer={signer} /> : null;");
  });

  it("QR di atas pelat terang, ukuran token, petunjuk berbahasa Inggris", () => {
    const x = qrHost();
    expect(x).toContain('const pelat = useColor("text");');
    expect(x).toContain("<QRCode value={value} size={UKURAN.qr} />");
    expect(x).toContain("teksPetunjukQrHost(secondsLeft)");
  });
});

describe("Input BNA tanpa placeholder bawaan (Ruling B2-15)", () => {
  it("tidak ada 'Type your message...' di salinan Input", () => {
    expect(baca("components/ui/input.tsx")).not.toContain("Type your message");
  });
});
