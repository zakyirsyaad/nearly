import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import konfigurasi, { berkasGoogleServices } from "../app.config";

const AKAR = join(__dirname, "..");
const appJson = JSON.parse(readFileSync(join(AKAR, "app.json"), "utf8"));

/** Lebar & tinggi dari header IHDR PNG (bait 16–23, big-endian). */
function ukuranPng(berkas: string): { w: number; h: number } {
  const b = readFileSync(join(AKAR, berkas));
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

describe("berkasGoogleServices (spec distribusi D7)", () => {
  it("EAS file variable menang", () => {
    expect(berkasGoogleServices("/tmp/eas/google-services.json", true)).toBe("/tmp/eas/google-services.json");
  });
  it("jatuh ke berkas lokal bila ada", () => {
    expect(berkasGoogleServices(undefined, true)).toBe("./google-services.json");
    expect(berkasGoogleServices("", true)).toBe("./google-services.json");
  });
  it("tidak memasang apa pun bila keduanya tidak ada", () => {
    expect(berkasGoogleServices(undefined, false)).toBeUndefined();
  });
});

describe("app.config.ts", () => {
  const cfg = konfigurasi({ config: appJson.expo } as never);

  it("mempertahankan isi app.json", () => {
    expect(cfg.name).toBe("Nearly");
    expect(cfg.android?.package).toBe("app.nearly.mobile");
    expect(cfg.ios?.bundleIdentifier).toBe("app.nearly.mobile");
    expect(cfg.runtimeVersion).toEqual({ policy: "appVersion" });
    expect(cfg.updates?.url).toMatch(/^https:\/\/u\.expo\.dev\//);
  });

  it("plugin expo-notifications dengan ikon notifikasi dan warna aksen", () => {
    const plugin = (cfg.plugins ?? []).find((p) => Array.isArray(p) && p[0] === "expo-notifications");
    expect(plugin).toEqual(["expo-notifications", { icon: "./assets/notification-icon.png", color: "#f3ba2f" }]);
  });

  it("tanpa http:// atau IP LAN (spec distribusi D6)", () => {
    const teks = JSON.stringify(cfg);
    expect(teks).not.toContain("http://");
    expect(teks).not.toContain("192.168.");
  });
});

describe("aset ikon (spec distribusi D9)", () => {
  it("ikon notifikasi 96×96", () => {
    expect(ukuranPng("assets/notification-icon.png")).toEqual({ w: 96, h: 96 });
  });
  it("ikon lama tetap 1024×1024", () => {
    for (const f of ["assets/icon.png", "assets/adaptive-icon.png", "assets/splash-icon.png"]) {
      expect(ukuranPng(f), f).toEqual({ w: 1024, h: 1024 });
    }
  });
});
