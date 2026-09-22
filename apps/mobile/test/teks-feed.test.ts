import { describe, expect, it } from "vitest";
import { labelGambar, labelHapus, labelSuka, labelTandaFeed, labelUnggah } from "../src/teks-feed";

describe("teks Feed (spec §7.4)", () => {
  it("tombol suka memakai simbol dan angka, tanpa kata baru", () => {
    expect(labelSuka(false, 3)).toBe("♡ 3");
    expect(labelSuka(true, 4)).toBe("♥ 4");
  });

  it("label sibuk dan konfirmasi hapus dua ketukan", () => {
    expect(labelTandaFeed(false)).toBe("Want to meet");
    expect(labelTandaFeed(true)).toBe("Marking…");
    expect(labelHapus(false)).toBe("Delete");
    expect(labelHapus(true)).toBe("Really delete?");
    expect(labelGambar(false)).toBe("Add image");
    expect(labelGambar(true)).toBe("Change image");
    expect(labelUnggah(false)).toBe("Post");
    expect(labelUnggah(true)).toBe("Sending…");
  });
});
