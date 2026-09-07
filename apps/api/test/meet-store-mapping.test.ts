import { describe, expect, it } from "vitest";
import { rowToTanda, type TandaDbRow } from "../src/meet-store";
import { potongKelompok } from "../src/feed-store";

describe("rowToTanda", () => {
  const row: TandaDbRow = {
    target: "0x00000000000000000000000000000000000000aa",
    who: "0x00000000000000000000000000000000000000bb",
    created_at: "2026-09-07T10:00:00.000Z",
  };

  it("mengubah created_at menjadi milidetik epoch", () => {
    expect(rowToTanda(row, "who").atMs).toBe(Date.parse("2026-09-07T10:00:00.000Z"));
  });

  // Satu baris dibaca dari DUA arah: saat mencari "siapa yang kutandai" yang
  // menarik adalah `target`; saat mencari "siapa yang menandaiku" yang
  // menarik adalah `who`. Satu pemeta, dua sisi.
  it("mengambil sisi yang diminta", () => {
    expect(rowToTanda(row, "target").address).toBe(row.target);
    expect(rowToTanda(row, "who").address).toBe(row.who);
  });
});

describe("potongKelompok dipakai ulang dari feed-store", () => {
  it("memotong 250 alamat menjadi tiga kelompok maksimal 100", () => {
    const alamat = Array.from({ length: 250 }, (_, i) => `0x${String(i).padStart(40, "0")}`);
    const kelompok = potongKelompok(alamat);
    expect(kelompok).toHaveLength(3);
    for (const k of kelompok) expect(k.length).toBeLessThanOrEqual(100);
    expect(kelompok.flat()).toHaveLength(250);
  });
});
