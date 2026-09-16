import { describe, expect, it } from "vitest";
import { alamatSingkat, labelSimpul, perluLabel, radiusSimpul } from "../src/label";

const ALAMAT = "0x12ab34cd56ef7890123456789012345678901234";

describe("label simpul", () => {
  it("alamat singkat = 6 karakter awal (termasuk 0x) + elipsis + 4 karakter akhir", () => {
    // 16 bit saja (`0x12ab…`) bisa di-grind dalam hitungan detik untuk menyamar di proyektor;
    // awal + akhir = 32 bit.
    expect(alamatSingkat(ALAMAT)).toBe("0x12ab…1234");
    expect(alamatSingkat("0x00000000000000000000000000000000000000ab")).toBe("0x0000…00ab");
  });

  it("nama ada → nama · alamat singkat", () => {
    expect(labelSimpul("Budi", ALAMAT)).toBe("Budi · 0x12ab…1234");
  });

  it("nama kosong atau spasi saja → alamat singkat saja, tidak pernah 'Tanpa nama'", () => {
    expect(labelSimpul("", ALAMAT)).toBe("0x12ab…1234");
    expect(labelSimpul("   ", ALAMAT)).toBe("0x12ab…1234");
    expect(labelSimpul("", ALAMAT)).not.toMatch(/tanpa nama/i);
  });

  it("nama panjang dipotong 20 karakter", () => {
    expect(labelSimpul("Bartholomew Kusumawardhana", ALAMAT)).toBe("Bartholomew Kusumawa… · 0x12ab…1234");
    expect(labelSimpul("12345678901234567890", ALAMAT)).toBe("12345678901234567890 · 0x12ab…1234");
  });

  it("emoji di batas potongan tidak terbelah", () => {
    const nama = `${"a".repeat(19)}😀😀`;
    expect(labelSimpul(nama, ALAMAT)).toBe(`${"a".repeat(19)}😀… · 0x12ab…1234`);
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
