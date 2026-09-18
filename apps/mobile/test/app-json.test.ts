import { describe, expect, it } from "vitest";
import { baca } from "./support/berkas";

const expo = JSON.parse(baca("app.json")).expo;
const pkg = JSON.parse(baca("package.json"));

describe("app.json (spec desain UI §3.2, §3.5, §7.4, R12)", () => {
  it("tema dikunci gelap dengan latar akar background", () => {
    expect(expo.userInterfaceStyle).toBe("dark");
    expect(expo.backgroundColor).toBe("#07090f");
  });

  it("versi 0.2.0 dengan runtimeVersion appVersion", () => {
    expect(expo.version).toBe("0.2.0");
    expect(expo.runtimeVersion).toEqual({ policy: "appVersion" });
  });

  it("teks izin iOS persis spec §7.4", () => {
    expect(expo.ios.infoPlist).toEqual({
      NSCameraUsageDescription: "Nearly uses the camera only to scan the QR codes of people you meet.",
      NSLocationWhenInUseUsageDescription:
        "Nearly uses approximate location (~150 m) only while the app is open: during a handshake, to confirm you're really in the same place, and while the Radar screen is open, to mark that you're at the event.",
    });
  });

  it("splash: n kuning di latar gelap, lebar 120, sama untuk dark", () => {
    const splash = (expo.plugins as unknown[]).find((p) => Array.isArray(p) && p[0] === "expo-splash-screen");
    expect((splash as [string, unknown] | undefined)?.[1]).toEqual({
      image: "./assets/splash-icon.png",
      imageWidth: 120,
      backgroundColor: "#07090f",
      dark: { image: "./assets/splash-icon.png", backgroundColor: "#07090f" },
    });
  });

  it("paket tema dan font terpasang sebagai dependensi langsung", () => {
    for (const p of [
      "expo-splash-screen", "expo-system-ui", "@expo-google-fonts/inter", "@expo-google-fonts/jetbrains-mono",
      "react-native-reanimated", "react-native-worklets", "expo-haptics", "lucide-react-native",
    ]) {
      expect(pkg.dependencies[p], p).toBeDefined();
    }
  });
});
