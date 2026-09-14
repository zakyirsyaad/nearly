import { describe, expect, it } from "vitest";
import { bacaPort, bacaWebOrigins, PORT_BAWAAN } from "../src/server-env";

describe("PORT (spec 6 §4.7)", () => {
  it("tidak ada atau kosong → 8787", () => {
    expect(PORT_BAWAAN).toBe(8787);
    expect(bacaPort(undefined)).toBe(8787);
    expect(bacaPort("")).toBe(8787);
    expect(bacaPort("   ")).toBe(8787);
  });

  it("bilangan bulat dari env dipakai", () => {
    expect(bacaPort("3000")).toBe(3000);
    expect(bacaPort(" 8080 ")).toBe(8080);
  });

  it("nilai tak sah melempar, bukan diam-diam kembali ke 8787", () => {
    for (const v of ["0", "65536", "abc", "80.5", "-1", "8787x"]) {
      expect(() => bacaPort(v), v).toThrow(/PORT tidak sah/);
    }
  });
});

describe("WEB_ORIGINS (spec 6 §4.6)", () => {
  it("tidak ada atau kosong → daftar kosong (CORS mati)", () => {
    expect(bacaWebOrigins(undefined)).toEqual([]);
    expect(bacaWebOrigins("")).toEqual([]);
    expect(bacaWebOrigins(" , ")).toEqual([]);
  });

  it("dipisah koma, spasi dan garis miring penutup dibuang", () => {
    expect(bacaWebOrigins("https://nearly.vercel.app/, https://nearly.xyz")).toEqual([
      "https://nearly.vercel.app", "https://nearly.xyz",
    ]);
  });
});
