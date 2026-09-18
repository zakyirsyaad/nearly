import { describe, expect, it } from "vitest";
import { ruteDariNotifikasi } from "../src/pesan/rute-push";

describe("ruteDariNotifikasi", () => {
  it("jenis pesan membuka daftar percakapan", () => {
    expect(ruteDariNotifikasi({ jenis: "pesan" })).toBe("/pesan");
  });

  // Isi push tidak memuat alamat (spec 4c §7.2), jadi rute tidak pernah
  // membuka percakapan tertentu langsung — aplikasi mencarinya lewat API.
  it("data lain atau rusak diabaikan", () => {
    expect(ruteDariNotifikasi({ jenis: "lain" })).toBeNull();
    expect(ruteDariNotifikasi(null)).toBeNull();
    expect(ruteDariNotifikasi("pesan")).toBeNull();
    expect(ruteDariNotifikasi(undefined)).toBeNull();
  });
});

describe("ruteDariNotifikasi — radar (spec 4b+5 §8.3)", () => {
  const EVENT = `0x${"e1".repeat(32)}`;

  it("jenis radar dengan eventId sah membuka radar acara itu", () => {
    expect(ruteDariNotifikasi({ jenis: "radar", eventId: EVENT })).toBe(`/radar/${EVENT}`);
  });

  it("eventId berhuruf besar dinormalkan ke huruf kecil", () => {
    expect(
      ruteDariNotifikasi({ jenis: "radar", eventId: EVENT.toUpperCase().replace("0X", "0x") }),
    ).toBe(`/radar/${EVENT}`);
  });

  it("radar tanpa eventId sah tidak membuka apa pun", () => {
    for (const eventId of [undefined, null, "", "0x123", `${EVENT}00`, "../pesan", 42]) {
      expect(ruteDariNotifikasi({ jenis: "radar", eventId })).toBeNull();
    }
    expect(ruteDariNotifikasi({ jenis: "radar" })).toBeNull();
  });
});

import { cocokRute, semuaPolaRute } from "./support/rute";

// Spec desain UI §4.5, §10.1: rute keluaran ruteDariNotifikasi harus tetap
// menunjuk berkas yang ada setelah layar dipindah ke grup tab.
describe("rute notifikasi ada di pohon app/", () => {
  it("/pesan dan /radar/<id> cocok dengan berkas di app/ setelah segmen grup dibuang", () => {
    const pola = semuaPolaRute();
    const pesan = ruteDariNotifikasi({ jenis: "pesan" });
    const radar = ruteDariNotifikasi({ jenis: "radar", eventId: `0x${"e1".repeat(32)}` });
    expect(pesan).not.toBeNull();
    expect(radar).not.toBeNull();
    expect(cocokRute(pesan ?? "", pola)).toBe(true);
    expect(cocokRute(radar ?? "", pola)).toBe(true);
  });
});

