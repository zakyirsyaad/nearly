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

import { baca, berkasTanpaWarna, kodeTampilanBaru, tanpaKomentar } from "./support/berkas";

const POLA_WARNA = /#[0-9a-fA-F]{3,8}\b|\brgba?\(/;

/** Nama yang diimpor dari "react-native" di satu berkas. */
function imporReactNative(isi: string): string[] {
  return [...isi.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*["']react-native["']/g)].flatMap((m) =>
    (m[1] ?? "").split(",").map((s) => s.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0] ?? "").filter(Boolean),
  );
}

describe("warna hanya dari theme/colors.ts (spec §10.1)", () => {
  it("ada berkas yang diperiksa", () => {
    expect(berkasTanpaWarna().length).toBeGreaterThan(0);
  });

  it("tidak ada literal warna di luar theme/colors.ts", () => {
    const salah = berkasTanpaWarna().filter((b) => POLA_WARNA.test(tanpaKomentar(baca(b))));
    expect(salah).toEqual([]);
  });
});

describe("teks dan isian lewat salinan BNA (spec §10.1)", () => {
  it("Text, TextInput, dan Button tidak diimpor dari react-native di kode bertampilan baru", () => {
    const salah = kodeTampilanBaru().filter((b) =>
      imporReactNative(baca(b)).some((n) => ["Text", "TextInput", "Button"].includes(n)));
    expect(salah).toEqual([]);
  });

  it("setiap <Input di kode bertampilan baru berasal dari @/components/ui/input", () => {
    const salah = kodeTampilanBaru().filter((b) => {
      const isi = baca(b);
      return /<Input\b/.test(isi) && !isi.includes('from "@/components/ui/input"');
    });
    expect(salah).toEqual([]);
  });
});

import { OPSI_STACK, opsiTampilan } from "../theme/navigasi";

describe("tema gelap navigasi (spec §3.2)", () => {
  it("header Stack memakai token latar dan teks", () => {
    expect(OPSI_STACK.headerStyle.backgroundColor).toBe(Colors.dark.background);
    expect(OPSI_STACK.headerTintColor).toBe(Colors.dark.text);
  });

  // Ruling A2: layar yang belum dimigrasi tetap berlatar terang.
  it("latar isi gelap tidak diberikan ke layar yang belum dimigrasi", () => {
    expect(opsiTampilan("mulai")).toEqual({});
  });

  it("root layout tidak membaca skema warna OS; useColorScheme selalu gelap", () => {
    expect(baca("app/_layout.tsx")).not.toMatch(/useColorScheme/);
    expect(baca("hooks/useColorScheme.ts")).toMatch(/return "dark";/);
  });
});

describe("batang trust (spec §3.4, #16B)", () => {
  it("ruas kosong memakai segmentEmpty, bukan border", () => {
    const isi = baca("components/batang-trust.tsx");
    expect(isi).toContain('useColor("segmentEmpty")');
    expect(isi).not.toContain('useColor("border")');
  });
});


