import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const AKAR = join(__dirname, "..");
const eas = JSON.parse(readFileSync(join(AKAR, "eas.json"), "utf8"));
const pkg = JSON.parse(readFileSync(join(AKAR, "package.json"), "utf8"));

describe("eas.json (spec distribusi D6, D8, D11)", () => {
  it("tanpa nilai env: EXPO_PUBLIC_* hanya di EAS environment variables", () => {
    for (const [nama, profil] of Object.entries<Record<string, unknown>>(eas.build)) {
      expect(profil.env, nama).toBeUndefined();
    }
    const teks = JSON.stringify(eas);
    expect(teks).not.toContain("http://");
    expect(teks).not.toContain("192.168.");
  });

  it("preview: APK internal di kanal preview, versionCode naik otomatis", () => {
    expect(eas.build.preview).toMatchObject({
      distribution: "internal",
      channel: "preview",
      environment: "preview",
      autoIncrement: true,
      android: { buildType: "apk" },
    });
  });

  it("production: kanal production, Android app-bundle, iOS disiapkan", () => {
    expect(eas.build.production).toMatchObject({
      channel: "production",
      environment: "production",
      autoIncrement: true,
      android: { buildType: "app-bundle" },
    });
    expect(eas.build.production.ios).toBeDefined();
  });

  it("development: dev client APK", () => {
    expect(eas.build.development).toMatchObject({
      developmentClient: true,
      distribution: "internal",
      channel: "development",
      environment: "development",
      android: { buildType: "apk" },
    });
  });

  it("versi aplikasi dikelola EAS", () => {
    expect(eas.cli.appVersionSource).toBe("remote");
  });

  it("expo-updates terpasang", () => {
    expect(pkg.dependencies["expo-updates"]).toMatch(/^~57\./);
  });
});
