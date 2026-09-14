import { describe, expect, it } from "vitest";
import { alamatSingkat, labelSimpul, perluLabel, radiusSimpul } from "../src/label";

const ALAMAT = "0x12ab34cd56ef7890123456789012345678901234";

describe("label simpul", () => {
  it("alamat singkat = 6 karakter pertama + elipsis", () => {
    expect(alamatSingkat(ALAMAT)).toBe("0x12ab…");
  });

  it("nama ada → nama · alamat singkat", () => {
    expect(labelSimpul("Budi", ALAMAT)).toBe("Budi · 0x12ab…");
  });

  it("nama kosong atau spasi saja → alamat singkat saja, tidak pernah 'Tanpa nama'", () => {
    expect(labelSimpul("", ALAMAT)).toBe("0x12ab…");
    expect(labelSimpul("   ", ALAMAT)).toBe("0x12ab…");
    expect(labelSimpul("", ALAMAT)).not.toMatch(/tanpa nama/i);
  });

  it("nama panjang dipotong 20 karakter", () => {
    expect(labelSimpul("Bartholomew Kusumawardhana", ALAMAT)).toBe("Bartholomew Kusumawa… · 0x12ab…");
    expect(labelSimpul("12345678901234567890", ALAMAT)).toBe("12345678901234567890 · 0x12ab…");
  });

  it("emoji di batas potongan tidak terbelah", () => {
    const nama = `${"a".repeat(19)}😀😀`;
    expect(labelSimpul(nama, ALAMAT)).toBe(`${"a".repeat(19)}😀… · 0x12ab…`);
  });
});

describe("ukuran dan label", () => {
  it("jari-jari naik dengan tier; tier tak dikenal = terkecil", () => {
    const r = ["Baru", "Dikenal", "Terpercaya", "Inti"].map(radiusSimpul);
    expect([...r].sort((x, y) => x - y)).toEqual(r);
    expect(new Set(r).size).toBe(4);
    expect(radiusSimpul("???")).toBe(radiusSimpul("Baru"));
  });

  it("label semua simpul sampai 300; di atasnya hanya simpul baru atau saat diperbesar", () => {
    expect(perluLabel(300, false, 1)).toBe(true);
    expect(perluLabel(301, false, 1)).toBe(false);
    expect(perluLabel(301, true, 1)).toBe(true);
    expect(perluLabel(301, false, 2.5)).toBe(true);
  });
});
