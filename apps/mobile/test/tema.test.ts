import { describe, expect, it } from "vitest";
import { Colors } from "../theme/colors";

// Nilai persis spec desain UI §3.1 dan §3.4 (keputusan #7, #16B).
const B2: Record<string, string> = {
  background: "#07090f",
  card: "#0f1420",
  border: "#1d2638",
  segmentEmpty: "#56627d",
  text: "#e6edf7",
  foreground: "#e6edf7",
  cardForeground: "#e6edf7",
  textMuted: "#8a96ad",
  mutedForeground: "#8a96ad",
  primary: "#f3ba2f",
  primaryForeground: "#07090f",
  verified: "#37d6a8",
  destructive: "#f06a6a",
  destructiveForeground: "#f06a6a",
  input: "#0b0f19",
  placeholder: "#6b778e",
};

const TURUNAN: Record<string, string> = {
  selubung: "rgba(7,9,15,0.70)",
  spandukLatar: "rgba(243,186,47,0.10)",
  spandukGaris: "rgba(243,186,47,0.40)",
  destruktifLatar: "rgba(240,106,106,0.12)",
  destruktifGaris: "rgba(240,106,106,0.35)",
};

describe("token warna B2", () => {
  // Tema dikunci gelap: skema apa pun yang terbaca tidak boleh menghasilkan
  // warna terang (spec §3.1, §3.2).
  it("objek light dan dark identik", () => {
    expect(Colors.light).toEqual(Colors.dark);
  });

  it("nilai token persis spec §3.1 dan §3.4", () => {
    for (const [kunci, nilai] of Object.entries(B2)) {
      expect(Colors.dark[kunci as keyof typeof Colors.dark], kunci).toBe(nilai);
    }
  });

  it("turunan transparansi persis spec §3.4", () => {
    for (const [kunci, nilai] of Object.entries(TURUNAN)) {
      expect(Colors.dark[kunci as keyof typeof Colors.dark], kunci).toBe(nilai);
    }
  });

  it("ruas kosong batang trust memakai segmentEmpty, bukan warna garis", () => {
    expect(Colors.dark.segmentEmpty).toBe("#56627d");
    expect(Colors.dark.segmentEmpty).not.toBe(Colors.dark.border);
  });

  // Tidak ada nilai baru di luar palet B2 selain turunan transparansi dan
  // gradasi avatar #2a3550 yang disebut spec §6.
  it("setiap nilai adalah warna palet atau turunannya", () => {
    const izin = new Set([...Object.values(B2), ...Object.values(TURUNAN), "#2a3550"]);
    const asing = Object.entries(Colors.dark).filter(([, v]) => !izin.has(v)).map(([k]) => k);
    expect(asing).toEqual([]);
  });
});
