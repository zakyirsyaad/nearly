import { describe, expect, it } from "vitest";
import { GEOFENCE_SPAN_M } from "@nearly/shared";
import { acaraLive, liveDulu } from "../src/events/daftar-acara";
import {
  catatanPusatAcara, kalimatGagalAcara, labelBuatAcara, labelRsvp, metaAcara, pasanganBelumHadir,
  pasanganRsvp, TEKS_GAGAL_BUAT_ACARA, TEKS_IZIN_LOKASI_DITOLAK, teksPetunjukQrHost, teksRsvp,
} from "../src/teks-acara";

describe("teks Acara (spec §7.4)", () => {
  it("jumlah RSVP tunggal dan jamak", () => {
    expect(teksRsvp(0)).toBe("0 RSVPs");
    expect(teksRsvp(1)).toBe("1 RSVP");
    expect(teksRsvp(12)).toBe("12 RSVPs");
    expect(pasanganRsvp(1)).toEqual({ angka: "1", kata: "RSVP" });
    expect(pasanganBelumHadir(3)).toEqual({ angka: "3", kata: "not checked in yet" });
  });

  it("baris waktu kartu memakai formatTanggalJam, tempat bila ada", () => {
    const sekarang = new Date(2026, 8, 21, 10, 0);
    const detik = String(Math.floor(new Date(2026, 7, 12, 19, 42).getTime() / 1000));
    expect(metaAcara({ startsAt: detik, venueLabel: "" }, sekarang)).toBe("Aug 12, 19:42");
    expect(metaAcara({ startsAt: detik, venueLabel: "Aula" }, sekarang)).toBe("Aug 12, 19:42 · Aula");
  });

  it("label tombol sibuk", () => {
    expect(labelRsvp(false)).toBe("RSVP");
    expect(labelRsvp(true)).toBe("Sending…");
    expect(labelBuatAcara(false)).toBe("Create event");
    expect(labelBuatAcara(true)).toBe("Creating…");
  });

  it("catatan pusat acara menyebut rentang geofence dari @nearly/shared", () => {
    expect(catatanPusatAcara()).toContain(`about ${GEOFENCE_SPAN_M} meters`);
  });

  it("petunjuk QR host menghitung mundur dengan bentuk tunggal", () => {
    expect(teksPetunjukQrHost(1)).toBe("Ask guests to scan this to check in. Changes in 1 second.");
    expect(teksPetunjukQrHost(30)).toBe("Ask guests to scan this to check in. Changes in 30 seconds.");
  });

  // Ruling B2-14: Error.message tidak pernah dirender; lokasi ditolak dikenali
  // lewat nama galatnya.
  it("lokasi ditolak punya kalimatnya sendiri; galat lain jatuh ke cadangan", () => {
    const ditolak = Object.assign(new Error("x"), { name: "LocationDeniedError" });
    expect(kalimatGagalAcara(ditolak, TEKS_GAGAL_BUAT_ACARA)).toBe(TEKS_IZIN_LOKASI_DITOLAK);
    expect(kalimatGagalAcara(new Error("bocor"), TEKS_GAGAL_BUAT_ACARA)).toBe(TEKS_GAGAL_BUAT_ACARA);
    expect(kalimatGagalAcara("bukan Error", TEKS_GAGAL_BUAT_ACARA)).toBe(TEKS_GAGAL_BUAT_ACARA);
  });
});

describe("acara LIVE di atas daftar (spec §7.1)", () => {
  const sekarangMs = 1_000_000;
  const detik = (ms: number) => String(Math.floor(ms / 1000));
  const lalu = { id: "lalu", startsAt: detik(sekarangMs - 7_200_000), endsAt: detik(sekarangMs - 3_600_000) };
  const liveA = { id: "liveA", startsAt: detik(sekarangMs - 1_000), endsAt: detik(sekarangMs + 3_600_000) };
  const nanti = { id: "nanti", startsAt: detik(sekarangMs + 3_600_000), endsAt: detik(sekarangMs + 7_200_000) };
  const liveB = { id: "liveB", startsAt: detik(sekarangMs - 2_000), endsAt: detik(sekarangMs + 60_000) };

  it("acaraLive mengikuti isEventLive", () => {
    expect(acaraLive(liveA, sekarangMs)).toBe(true);
    expect(acaraLive(nanti, sekarangMs)).toBe(false);
  });

  it("LIVE dipindah ke depan; urutan server dipertahankan di kedua kelompok", () => {
    expect(liveDulu([nanti, liveA, lalu, liveB], sekarangMs).map((a) => a.id)).toEqual(["liveA", "liveB", "nanti", "lalu"]);
  });
});
