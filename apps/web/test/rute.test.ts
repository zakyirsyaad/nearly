import { describe, expect, it } from "vitest";
import { bacaParamAcara, pilihHalaman } from "../src/rute";

describe("rute", () => {
  it("/live dan /live/ → live; selain itu landing", () => {
    expect(pilihHalaman("/live")).toBe("live");
    expect(pilihHalaman("/live/")).toBe("live");
    expect(pilihHalaman("/")).toBe("landing");
    expect(pilihHalaman("/lively")).toBe("landing");
    expect(pilihHalaman("/apa-saja")).toBe("landing");
  });

  it("?acara hanya diterima sebagai 0x + 64 hex, huruf kecil", () => {
    const id = `0x${"AB".repeat(32)}`;
    expect(bacaParamAcara(`?acara=${id}`)).toBe(id.toLowerCase());
    expect(bacaParamAcara("?acara=0x12")).toBeNull();
    expect(bacaParamAcara("")).toBeNull();
  });
});
