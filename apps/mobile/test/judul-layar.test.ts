import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import {
  JUDUL_LAYAR, LAYAR_AKAR, LAYAR_TERMIGRASI, layarDalam, layarMenurutDompet, TAB_BAWAH,
} from "../src/judul-layar";
import { opsiTampilan } from "../theme/navigasi";

const MOBILE = join(__dirname, "..");
const APP = join(MOBILE, "app");

/** Kunci setiap berkas layar: `app/(tabs)/(acara)/events/[id].tsx` → `(tabs)/(acara)/events/[id]`. */
function semuaRute(dir = APP): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const jalur = join(dir, e.name);
    if (e.isDirectory()) return semuaRute(jalur);
    if (!e.name.endsWith(".tsx") || e.name.startsWith("_")) return [];
    return [relative(APP, jalur).split(sep).join("/").replace(/\.tsx$/, "")];
  });
}

// Tanpa judul, header menampilkan nama rute mentah ("events/new",
// "profile/[address]") — ditemukan di iPhone saat uji lapangan Fase 4b + 5.
// Layar baru yang lupa didaftarkan harus membuat tes ini merah.
describe("judul layar", () => {
  it("setiap berkas layar di app/ punya judul", () => {
    const tanpaJudul = semuaRute().filter((r) => !(r in JUDUL_LAYAR));
    expect(tanpaJudul).toEqual([]);
  });

  it("tidak ada judul untuk rute yang sudah tidak ada", () => {
    const rute = new Set(semuaRute());
    expect(Object.keys(JUDUL_LAYAR).filter((r) => !rute.has(r))).toEqual([]);
  });

  it("judul tidak kosong dan bukan nama rute", () => {
    for (const [rute, judul] of Object.entries(JUDUL_LAYAR)) {
      expect(judul.trim(), rute).not.toBe("");
      expect(judul, rute).not.toMatch(/[\/\[\]]/);
    }
  });

  it("judul persis spec desain UI §4.7", () => {
    expect(JUDUL_LAYAR).toEqual({
      mulai: "Get started",
      "profile/[address]": "Profile",
      "(tabs)/(beranda)/index": "Home",
      "(tabs)/(beranda)/feed/index": "Feed",
      "(tabs)/(beranda)/feed/new": "New post",
      "(tabs)/(acara)/events/index": "Events",
      "(tabs)/(acara)/events/new": "Create event",
      "(tabs)/(acara)/events/[id]": "Event details",
      "(tabs)/(acara)/events/[id]/host-qr": "Check-in QR",
      "(tabs)/(acara)/radar/[eventId]": "Radar",
      "(tabs)/(salaman)/salaman": "Handshake",
      "(tabs)/(pesan)/pesan/index": "Messages",
      "(tabs)/(pesan)/pesan/[address]": "Conversation",
      "(tabs)/(pesan)/pesan/lapor/[address]": "Report",
      "(tabs)/(profil)/profil-saya": "Profile",
      "(tabs)/(profil)/connections": "Connections",
      "(tabs)/(profil)/kecocokan": "Matches",
      "(tabs)/(profil)/dompet": "Wallet",
      "(tabs)/(profil)/blokir": "Blocked",
    });
  });

  it("setiap kunci dimiliki tepat satu layout: Stack akar atau satu Stack tab", () => {
    const akar = LAYAR_AKAR.filter((n) => n !== "(tabs)");
    const perTab = TAB_BAWAH.flatMap((t) =>
      layarDalam(`(tabs)/${t.grup}`).map(([nama]) => `(tabs)/${t.grup}/${nama}`));
    const semua = [...akar, ...perTab];
    expect([...semua].sort()).toEqual(Object.keys(JUDUL_LAYAR).sort());
    expect(new Set(semua).size).toBe(semua.length);
  });

  // Tanpa dompet hanya layar Mulai; dengan dompet, (tabs) adalah layar pertama
  // yang dituju saat penjaga berubah (spec §4.2).
  it("layarMenurutDompet: tanpa dompet hanya mulai; dengan dompet (tabs) lebih dulu", () => {
    expect(layarMenurutDompet(false)).toEqual([["mulai", { title: "Get started" }]]);
    expect(layarMenurutDompet(true)).toEqual([
      ["(tabs)", { headerShown: false }],
      ["profile/[address]", { title: "Profile" }],
    ]);
  });

  // Memeriksa pemakaian, bukan sekadar nama: impor saja tanpa pendaftaran
  // meloloskan tes versi awal, dan judul yang ditulis tangan di layout akan
  // lolos dari tes "setiap layar punya judul" di atas.
  it("_layout.tsx akar mendaftarkan kedua sisi gerbang dompet, tanpa judul tulisan tangan", () => {
    const layout = readFileSync(join(APP, "_layout.tsx"), "utf8");
    expect(layout).toMatch(/layarMenurutDompet\(true\)\.map\(/);
    expect(layout).toMatch(/layarMenurutDompet\(false\)\.map\(/);
    expect(layout).not.toMatch(/title:\s*"/);
  });

  it("TAB_BAWAH: lima grup dalam urutan spec §4.3, masing-masing punya _layout.tsx", () => {
    expect(TAB_BAWAH.map((t) => [t.grup, t.label])).toEqual([
      ["(beranda)", "Home"],
      ["(acara)", "Events"],
      ["(salaman)", "Handshake"],
      ["(pesan)", "Messages"],
      ["(profil)", "Profile"],
    ]);
    for (const t of TAB_BAWAH) expect(existsSync(join(APP, "(tabs)", t.grup, "_layout.tsx")), t.grup).toBe(true);
  });

  it("setiap _layout.tsx tab merender StackTab grupnya dengan initialRouteName layar akar tab", () => {
    for (const t of TAB_BAWAH) {
      const isi = readFileSync(join(APP, "(tabs)", t.grup, "_layout.tsx"), "utf8");
      expect(isi, t.grup).toContain(`<StackTab grup="${t.grup}" />`);
      expect(isi, t.grup).toContain(`initialRouteName: "${t.layarAwal}"`);
      expect(isi, t.grup).not.toMatch(/title:\s*"/);
      expect(`(tabs)/${t.grup}/${t.layarAwal}` in JUDUL_LAYAR, t.grup).toBe(true);
    }
  });

  it("StackTab mendaftarkan judul dari layarDalam, tanpa judul tulisan tangan", () => {
    const isi = readFileSync(join(MOBILE, "components", "stack-tab.tsx"), "utf8");
    expect(isi).toMatch(/layarDalam\(induk\)\.map\(/);
    expect(isi).not.toMatch(/title:\s*"/);
  });

  it("(tabs)/_layout.tsx memetakan TAB_BAWAH, tanpa judul tulisan tangan", () => {
    const isi = readFileSync(join(APP, "(tabs)", "_layout.tsx"), "utf8");
    expect(isi).toMatch(/TAB_BAWAH\.map\(/);
    expect(isi).toContain("name={tab.grup}");
    expect(isi).not.toMatch(/title:\s*"/);
  });

  it("LAYAR_TERMIGRASI hanya berisi kunci JUDUL_LAYAR", () => {
    expect([...LAYAR_TERMIGRASI].filter((k) => !(k in JUDUL_LAYAR))).toEqual([]);
  });

  it("Beranda lama tetap berheader; tanpa header hanya setelah dimigrasi (sapaan menggantikannya)", () => {
    // Beranda lama tidak punya jarak aman dari status bar: tanpa header isinya
    // naik ke area jam, dan ikon status bar terang hilang di latar terang.
    const beranda = "(tabs)/(beranda)/index";
    expect(opsiTampilan(beranda)).not.toHaveProperty("headerShown");
    expect(opsiTampilan(beranda, new Set([beranda]))).toMatchObject({ headerShown: false });
  });

  it("layar akar tab selain Beranda berjudul besar HANYA setelah dimigrasi (spec §4.7)", () => {
    // Judul besar iOS hanya memberi ruang yang benar bila isi layar ScrollView
    // (contentInsetAdjustmentBehavior "automatic"). Layar lama bukan ScrollView:
    // judul besar menutupi bagian atasnya — segmen Show QR/Scan hilang di uji
    // iPhone 2026-09-19.
    for (const k of [
      "(tabs)/(acara)/events/index", "(tabs)/(salaman)/salaman", "(tabs)/(pesan)/pesan/index",
      "(tabs)/(profil)/profil-saya",
    ]) {
      expect(opsiTampilan(k), k).not.toHaveProperty("headerLargeTitle");
      expect(opsiTampilan(k, new Set([k])), k).toMatchObject({ headerLargeTitle: true });
    }
    expect(opsiTampilan("(tabs)/(acara)/events/[id]")).toEqual({});
  });
});
