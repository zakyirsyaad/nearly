import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { Landing } from "../src/pages/Landing";
import { CHAIN_ID, KONTRAK, tautanBscScan } from "../src/kontrak";

/** Teks yang terbaca pengunjung: tanpa tag, entitas umum diurai, spasi dirapatkan, huruf kecil. */
function teksTerbaca(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

describe("Landing component", () => {
  it("bagian wajib spec 6 §6.4 hadir berurutan, dengan tautan ke /live", () => {
    const html = renderToString(Landing());

    expect(html).toContain('class="landing"');
    expect(html).toContain('class="hero"');
    expect(html).toContain("Connections you can only make in person.");
    expect(html).toContain("See the live graph");
    expect(html).toContain('href="/live"');

    // Dicocokkan sebagai JUDUL (<h2>…</h2>), bukan teks mana pun: sejak landing
    // punya navigasi, kata "How it works" dan "On-chain" juga muncul di header.
    const bagian = ["How it works", "Trust comes from the graph", "Privacy by design", "What Nearly does not claim", "On-chain"];
    const posisi = bagian.map((b) => html.indexOf(`<h2>${b}</h2>`));
    for (const [i, p] of posisi.entries()) expect(p, bagian[i]).toBeGreaterThan(-1);
    expect([...posisi].sort((x, y) => x - y)).toEqual(posisi);

    expect(html).toContain("BNB Smart Chain testnet");
    expect(html).toContain(`${CHAIN_ID}`);
    expect(html).toContain("Nearly · testnet demo");
  });

  it("kelima kontrak tampil dengan tautan BscScan (spec 6 §6.4 butir 6)", () => {
    const html = renderToString(Landing());
    for (const k of KONTRAK) {
      expect(html).toContain(k.nama);
      expect(html).toContain(k.peran);
      expect(html).toContain(k.alamat);
      expect(html).toContain(tautanBscScan(k.alamat));
    }
  });
});

/**
 * Penjaga klaim (spec induk §14: "Jangan pernah mengklaim lebih dari ini").
 * Bagian "What Nearly does not claim" justru yang dibaca juri; satu kalimat
 * berlebihan di sana merusak seluruh bagian. Frasa di bawah pernah muncul
 * (recompute) atau sering tergelincir masuk salinan produk.
 */
describe("Landing tidak mengklaim berlebihan", () => {
  const TERLARANG = [
    // Blokir privat dan seed off-chain sejak Fase 4a: skor tidak bisa dihitung ulang dari data publik.
    "anyone can recompute", "anyone recompute", "recompute trust", "check our work",
    // Sybil multi-perangkat dideteksi, tidak dicegah (induk §9.1).
    "prevent sybil", "prevents sybil", "sybil-proof", "sybil proof",
    "guarantee", "impossible to fake", "cannot be faked", "trustless",
  ];

  it("tidak memuat frasa overclaim", () => {
    const teks = teksTerbaca(renderToString(Landing()));
    for (const f of TERLARANG) expect(teks, `frasa overclaim: "${f}"`).not.toContain(f);
  });

  it("tanpa angka pengguna (spec 6 §6.4)", () => {
    const teks = teksTerbaca(renderToString(Landing()));
    expect(teks).not.toMatch(/\b\d[\d,.]*\s*(k\+?|\+)?\s*(users|people|members|handshakes|connections)\b/);
  });

  it("klaim graf publik yang benar: setiap koneksi bisa diverifikasi on-chain", () => {
    const teks = teksTerbaca(renderToString(Landing()));
    expect(teks).toContain("the connection graph is public");
    expect(teks).toContain("verify every connection on-chain");
  });
});

describe("Landing — Get the app (spec distribusi D10)", () => {
  const APK = "https://unduh.contoh.id/nearly.apk";

  it("tombol unduh APK tampil bila tautan ada, beserta catatan iPhone", () => {
    const html = renderToString(Landing({ apkUrl: APK }));
    expect(html).toContain("<h2>Get the app</h2>");
    expect(html).toContain(`href="${APK}"`);
    expect(html).toContain("Download for Android");
    expect(teksTerbaca(html)).toContain("iphone: coming soon");
    expect(html.indexOf("<h2>Get the app</h2>")).toBeLessThan(html.indexOf("<h2>How it works</h2>"));
  });

  it("tidak dirender bila tautan kosong", () => {
    const html = renderToString(Landing({ apkUrl: null }));
    expect(html).not.toContain("Get the app");
    expect(html).not.toContain("Download for Android");
  });
});

