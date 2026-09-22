import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { baca, MOBILE } from "./support/berkas";

const PATH_N_SPEC =
  "M28 74V34c0-6 4-9 9-9s8 3 10 7l13 24c1 2 2 2 2 0V26h10v40c0 6-4 9-9 9s-8-3-10-7L40 44c-1-2-2-2-2 0v30z";

/** Lebar dan tinggi dari kepala PNG (IHDR). */
function ukuranPng(berkas: string): [number, number] {
  const b = readFileSync(join(MOBILE, berkas));
  expect(b.subarray(1, 4).toString("ascii"), berkas).toBe("PNG");
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

describe("ikon dan splash (spec desain UI §3.5, R11)", () => {
  it("ketiga PNG berukuran 1024×1024", () => {
    for (const b of ["assets/icon.png", "assets/adaptive-icon.png", "assets/splash-icon.png"]) {
      expect(ukuranPng(b), b).toEqual([1024, 1024]);
    }
  });

  it("SVG sumber memuat path spec, dan LogoN memakai path yang sama persis", () => {
    const d = baca("assets/sumber/n.svg").match(/\sd="([^"]+)"/)?.[1];
    expect(d).toBe(PATH_N_SPEC);
    expect(baca("components/logo-n.tsx")).toContain(`"${PATH_N_SPEC}"`);
  });

  it("app.json menunjuk ikon dan ikon adaptif", () => {
    const expo = JSON.parse(baca("app.json")).expo;
    expect(expo.icon).toBe("./assets/icon.png");
    expect(expo.android.adaptiveIcon).toEqual({
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#f3ba2f",
    });
  });

  it("@resvg/resvg-js dipatok persis dan skrip ikon terdaftar", () => {
    const pkg = JSON.parse(baca("package.json"));
    expect(pkg.devDependencies["@resvg/resvg-js"]).toBe("2.6.2");
    expect(pkg.scripts.ikon).toBe("node scripts/buat-ikon.mjs");
  });
});
