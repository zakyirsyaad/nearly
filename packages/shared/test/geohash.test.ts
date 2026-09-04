import { describe, expect, it } from "vitest";
import { encodeCell, neighborCells, GEOHASH_PRECISION } from "../src/geohash";

describe("encodeCell", () => {
  it("menghasilkan geohash presisi 7", () => {
    const cell = encodeCell(-6.2088, 106.8456); // Jakarta
    expect(cell).toHaveLength(GEOHASH_PRECISION);
  });

  it("dua titik berjarak beberapa meter menghasilkan sel yang sama atau bertetangga", () => {
    const a = encodeCell(-6.2088, 106.8456);
    const b = encodeCell(-6.20885, 106.84565);
    expect(a === b || neighborCells(a).includes(b)).toBe(true);
  });

  it("dua kota berbeda menghasilkan sel yang tidak bertetangga", () => {
    const jakarta = encodeCell(-6.2088, 106.8456);
    const bandung = encodeCell(-6.9175, 107.6191);
    expect(jakarta).not.toBe(bandung);
    expect(neighborCells(jakarta)).not.toContain(bandung);
  });
});

describe("neighborCells", () => {
  it("mengembalikan tepat 8 tetangga", () => {
    expect(neighborCells(encodeCell(-6.2088, 106.8456))).toHaveLength(8);
  });

  it("tidak memasukkan sel itu sendiri", () => {
    const cell = encodeCell(-6.2088, 106.8456);
    expect(neighborCells(cell)).not.toContain(cell);
  });

  it("hubungan tetangga bersifat timbal-balik", () => {
    const cell = encodeCell(-6.2088, 106.8456);
    for (const n of neighborCells(cell)) {
      expect(neighborCells(n)).toContain(cell);
    }
  });
});
