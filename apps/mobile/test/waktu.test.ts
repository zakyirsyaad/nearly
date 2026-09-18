import { describe, expect, it } from "vitest";
import { formatJam, formatTanggal, formatTanggalJam, sapaan, waktuRelatif } from "../src/waktu";
import { baca, tanpaKomentar } from "./support/berkas";

/** Waktu LOKAL — sama dengan cara HP menampilkannya. */
const t = (tahun: number, bulan: number, hari: number, jam = 12, menit = 0) =>
  new Date(tahun, bulan - 1, hari, jam, menit);

describe("formatTanggal (spec desain UI §7.4)", () => {
  it("tahun berjalan: bulan tiga huruf + hari tanpa nol di depan", () => {
    expect(formatTanggal(t(2026, 8, 12), t(2026, 9, 18))).toBe("Aug 12");
    expect(formatTanggal(t(2026, 1, 5), t(2026, 9, 18))).toBe("Jan 5");
  });

  it("tahun lain ditambah tahun", () => {
    expect(formatTanggal(t(2025, 8, 12), t(2026, 9, 18))).toBe("Aug 12, 2025");
  });
});

describe("formatJam dan formatTanggalJam", () => {
  it("24 jam, dua digit", () => {
    expect(formatJam(t(2026, 8, 12, 19, 42))).toBe("19:42");
    expect(formatJam(t(2026, 8, 12, 8, 5))).toBe("08:05");
    expect(formatJam(t(2026, 8, 12, 0, 0))).toBe("00:00");
  });

  it("tanggal + jam acara", () => {
    expect(formatTanggalJam(t(2026, 8, 12, 19, 42), t(2026, 9, 18))).toBe("Aug 12, 19:42");
  });
});

describe("waktuRelatif — setiap batas spec §7.4", () => {
  const kini = t(2026, 9, 18, 15, 0);
  const mundur = (ms: number) => new Date(kini.getTime() - ms);
  const MENIT = 60_000;
  const JAM = 60 * MENIT;

  it("kurang dari 1 menit → just now (juga waktu di masa depan)", () => {
    expect(waktuRelatif(mundur(0), kini)).toBe("just now");
    expect(waktuRelatif(mundur(MENIT - 1), kini)).toBe("just now");
    expect(waktuRelatif(mundur(-5 * MENIT), kini)).toBe("just now");
  });

  it("kurang dari 60 menit → N minutes ago, tunggal untuk 1", () => {
    expect(waktuRelatif(mundur(MENIT), kini)).toBe("1 minute ago");
    expect(waktuRelatif(mundur(59 * MENIT), kini)).toBe("59 minutes ago");
  });

  it("kurang dari 24 jam → N hours ago, tunggal untuk 1", () => {
    expect(waktuRelatif(mundur(JAM), kini)).toBe("1 hour ago");
    expect(waktuRelatif(mundur(23 * JAM), kini)).toBe("23 hours ago");
  });

  it("hari kalender sebelumnya → yesterday", () => {
    expect(waktuRelatif(t(2026, 9, 17, 9, 0), kini)).toBe("yesterday");
  });

  it("sampai 6 hari → N days ago", () => {
    expect(waktuRelatif(t(2026, 9, 16, 15, 0), kini)).toBe("2 days ago");
    expect(waktuRelatif(t(2026, 9, 12, 15, 0), kini)).toBe("6 days ago");
  });

  it("selebihnya tanggal", () => {
    expect(waktuRelatif(t(2026, 9, 11, 15, 0), kini)).toBe("Sep 11");
    expect(waktuRelatif(t(2025, 9, 11, 15, 0), kini)).toBe("Sep 11, 2025");
  });
});

describe("sapaan Beranda — batas 04:00, 12:00, 18:00 (spec §6.1)", () => {
  it("pagi, siang, malam menurut jam lokal", () => {
    expect(sapaan(t(2026, 9, 18, 3, 59))).toBe("Good evening");
    expect(sapaan(t(2026, 9, 18, 4, 0))).toBe("Good morning");
    expect(sapaan(t(2026, 9, 18, 11, 59))).toBe("Good morning");
    expect(sapaan(t(2026, 9, 18, 12, 0))).toBe("Good afternoon");
    expect(sapaan(t(2026, 9, 18, 17, 59))).toBe("Good afternoon");
    expect(sapaan(t(2026, 9, 18, 18, 0))).toBe("Good evening");
  });
});

describe("waktu.ts murni", () => {
  it("tidak memakai Intl atau toLocale*", () => {
    expect(tanpaKomentar(baca("src/waktu.ts"))).not.toMatch(/toLocale|Intl\./);
  });
});
