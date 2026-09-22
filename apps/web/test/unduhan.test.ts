import { describe, expect, it } from "vitest";
import { tautanApk } from "../src/unduhan";

describe("tautanApk (spec distribusi D10)", () => {
  it("menerima URL https", () => {
    expect(tautanApk("https://unduh.contoh.id/nearly.apk")).toBe("https://unduh.contoh.id/nearly.apk");
  });
  it("menolak kosong, http, dan bukan URL", () => {
    expect(tautanApk(undefined)).toBeNull();
    expect(tautanApk("")).toBeNull();
    expect(tautanApk("http://unduh.contoh.id/nearly.apk")).toBeNull();
    expect(tautanApk("nearly.apk")).toBeNull();
    expect(tautanApk("javascript:alert(1)")).toBeNull();
  });
});
