import ts from "typescript";
import { describe, expect, it } from "vitest";
import { baca, semuaBerkas } from "./support/berkas";

/**
 * Penjaga bahasa aplikasi (spec desain UI §7.4, §10.1): hanya SIMPUL TEKS —
 * string, templat, dan teks JSX — yang diperiksa, jadi pengenal dan komentar
 * Indonesia tetap boleh. `\b` memperlakukan `_` sebagai bagian kata, sehingga
 * kode seperti `dompet_tidak_konsisten` tidak cocok. Tes ini jaring, bukan
 * bukti: kalimat Indonesia tanpa kata di pola bisa lolos.
 */
const POLA_INDONESIA = /\b(yang|dan|kamu|tidak|sudah|belum|dengan|untuk|ini|itu|gagal|berhasil|coba|sedang)\b/i;

type Temuan = { berkas: string; teks: string };

/**
 * String KODE yang sah walau memuat kata di pola. Setiap pasangan harus masih
 * cocok dengan kode — yang tidak lagi cocok membuat tes merah, supaya daftar
 * ini tidak menumpuk.
 */
const IZIN: readonly (Temuan & { alasan: string })[] = [
  { berkas: "src/dompet/aksi-dompet.ts", teks: "belum-ada", alasan: "keadaan dompet internal, tidak pernah dirender" },
  { berkas: "src/dompet/konteks-dompet.tsx", teks: "belum-ada", alasan: "keadaan dompet internal, tidak pernah dirender" },
  { berkas: "src/pesan/pesan-api.ts", teks: "/pesan/dengan/", alasan: "jalur API — nama rute tetap Indonesia (§7.4)" },
  { berkas: "src/pesan/pesan-api.ts", teks: "/pesan/belum-dibaca", alasan: "jalur API" },
  { berkas: "src/messages.ts", teks: "gagal", alasan: "nilai KeadaanRadar internal" },
  { berkas: "app/(tabs)/(acara)/radar/[eventId].tsx", teks: "gagal", alasan: "nilai KeadaanRadar internal" },
  { berkas: "src/teks-radar.ts", teks: "gagal", alasan: "nilai KeadaanRadar internal (radarBisaDicobaLagi)" },
  { berkas: "app/(tabs)/(pesan)/pesan/[address].tsx", teks: "belum", alasan: "tahap pembukaan bertahap internal" },
  { berkas: "src/judul-layar.ts", teks: "judul untuk ", alasan: "pesan galat pengembang, tidak dirender" },
  { berkas: "src/judul-layar.ts", teks: " tidak ada", alasan: "pesan galat pengembang, tidak dirender" },
  { berkas: "src/trust-api.ts", teks: "gagal (", alasan: "Error.message pengembang; layar tidak merender Error.message (review B1 #I1)" },
  { berkas: "src/trust-api.ts", teks: "gagal membaca trust (", alasan: "idem" },
];

function temuanSumber(berkas: string, isi: string): Temuan[] {
  const sumber = ts.createSourceFile(
    berkas, isi, ts.ScriptTarget.Latest, true, berkas.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const hasil: Temuan[] = [];
  const kunjungi = (n: ts.Node): void => {
    // Penentu modul import/export … from dilewati.
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) return;
    if (ts.isCallExpression(n)) {
      const f = n.expression;
      // Argumen console.* dan require(...) dilewati.
      if (ts.isPropertyAccessExpression(f) && ts.isIdentifier(f.expression) && f.expression.text === "console") return;
      if (ts.isIdentifier(f) && f.text === "require") return;
    }
    // Kunci properti dilewati; NILAINYA tetap diperiksa.
    if (ts.isPropertyAssignment(n)) {
      kunjungi(n.initializer);
      return;
    }
    let teks: string | null = null;
    if (
      ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)
      || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)
    ) {
      teks = n.text;
    } else if (ts.isJsxText(n)) {
      teks = n.text.trim();
    }
    if (teks && POLA_INDONESIA.test(teks)) hasil.push({ berkas, teks });
    ts.forEachChild(n, kunjungi);
  };
  kunjungi(sumber);
  return hasil;
}

const BERKAS = ["app", "components", "src"].flatMap((d) => semuaBerkas(d));
const TEMUAN = BERKAS.flatMap((b) => temuanSumber(b, baca(b)));
const diizinkan = (t: Temuan) => IZIN.some((i) => i.berkas === t.berkas && i.teks === t.teks);

describe("bahasa aplikasi: Inggris (spec §7.4, §10.1)", () => {
  it("penjaga menangkap teks, dan melewati impor, console, kunci properti, serta komentar", () => {
    const contoh = [
      'import x from "./yang";',
      'console.log("gagal dan coba");',
      'const peta = { "tidak_ada": 1, sudah: "Done" };',
      "// komentar yang tidak diperiksa",
      'const a = "Gagal memuat acara.";',
      "const b = <T>Belum ada unggahan.</T>;",
    ].join("\n");
    expect(temuanSumber("contoh.tsx", contoh).map((t) => t.teks)).toEqual([
      "Gagal memuat acara.", "Belum ada unggahan.",
    ]);
  });

  it("ada berkas yang diperiksa", () => {
    expect(BERKAS.length).toBeGreaterThan(50);
  });

  it("tidak ada teks Indonesia di app/, components/, src/", () => {
    expect(TEMUAN.filter((t) => !diizinkan(t))).toEqual([]);
  });

  it("setiap izin masih cocok dengan kode — izin basi dibuang", () => {
    expect(IZIN.filter((i) => !TEMUAN.some((t) => t.berkas === i.berkas && t.teks === i.teks))).toEqual([]);
  });

  it("TIER_LABELS (label kawat Indonesia) hanya diimpor src/tier.ts", () => {
    expect(BERKAS.filter((b) => b !== "src/tier.ts" && /\bTIER_LABELS\b/.test(baca(b)))).toEqual([]);
  });

  it("tanggal dan jam lewat src/waktu.ts — tidak ada toLocale*", () => {
    expect(BERKAS.filter((b) => /\btoLocale(String|DateString|TimeString)\b/.test(baca(b)))).toEqual([]);
  });

  it("teks izin app.json persis kalimat §7.4 dan lolos penjaga", () => {
    const plist = JSON.parse(baca("app.json")).expo.ios.infoPlist as Record<string, string>;
    expect(plist.NSCameraUsageDescription).toBe(
      "Nearly uses the camera only to scan the QR codes of people you meet.",
    );
    expect(plist.NSLocationWhenInUseUsageDescription).toBe(
      "Nearly uses approximate location (~150 m) only while the app is open: during a handshake, to confirm you're really in the same place, and while the Radar screen is open, to mark that you're at the event.",
    );
    for (const [k, v] of Object.entries(plist)) {
      if (k.endsWith("UsageDescription")) expect(POLA_INDONESIA.test(v), k).toBe(false);
    }
  });
});
