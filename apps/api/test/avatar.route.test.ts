import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { Address } from "viem";
import { avatarRoutes, MAKS_BAIT_AVATAR } from "../src/routes/avatar";

/**
 * Proksi avatar ENS (2026-09-24). Yang diuji di sini bukan "gambarnya keluar",
 * melainkan batas-batas yang membuatnya aman dipasang di VPS kecil:
 * hanya https, hanya tipe gambar raster, ada batas ukuran, dan ketiadaan
 * avatar ikut di-cache supaya RPC mainnet tidak dipanggil berulang.
 */
const ALAMAT = "0x7814656e4bcc5acae46099bd0238856e2a118811" as Address;
const NOW = 1_800_000_000_000;

const aslinya = globalThis.fetch;
afterEach(() => { globalThis.fetch = aslinya; });

function app(ensAvatar: () => Promise<string | null>) {
  const a = new Hono();
  a.route("/", avatarRoutes({ identity: { ensAvatar }, nowMs: () => NOW } as never));
  return a;
}

function balasGambar(tipe: string, bait: number, extra: Record<string, string> = {}) {
  return vi.fn(async () => new Response(new Uint8Array(bait), {
    status: 200,
    headers: { "content-type": tipe, ...extra },
  }));
}

describe("GET /avatar/:address", () => {
  it("alamat cacat → 404 tanpa menyentuh ENS", async () => {
    const ensAvatar = vi.fn(async () => "https://contoh.test/a.png");
    const res = await app(ensAvatar).request("/avatar/bukan-alamat");
    expect(res.status).toBe(404);
    expect(ensAvatar).not.toHaveBeenCalled();
  });

  it("tanpa avatar ENS → 404", async () => {
    const res = await app(async () => null).request(`/avatar/${ALAMAT}`);
    expect(res.status).toBe(404);
  });

  it("meneruskan gambar dari server, bukan mengalihkan HP ke host asing", async () => {
    globalThis.fetch = balasGambar("image/png", 1024) as never;
    const res = await app(async () => "https://contoh.test/a.png").request(`/avatar/${ALAMAT}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect((await res.arrayBuffer()).byteLength).toBe(1024);
  });

  it("URL non-https ditolak", async () => {
    globalThis.fetch = balasGambar("image/png", 10) as never;
    const res = await app(async () => "http://contoh.test/a.png").request(`/avatar/${ALAMAT}`);
    expect(res.status).toBe(404);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("SVG dan tipe non-gambar ditolak — SVG bisa memuat skrip", async () => {
    for (const tipe of ["image/svg+xml", "text/html", "application/json"]) {
      globalThis.fetch = balasGambar(tipe, 10) as never;
      const res = await app(async () => "https://contoh.test/a").request(`/avatar/${ALAMAT}`);
      expect(res.status, tipe).toBe(404);
    }
  });

  it("gambar kelewat besar ditolak, walau content-length berbohong", async () => {
    globalThis.fetch = balasGambar("image/png", MAKS_BAIT_AVATAR + 1, { "content-length": "10" }) as never;
    const res = await app(async () => "https://contoh.test/besar.png").request(`/avatar/${ALAMAT}`);
    expect(res.status).toBe(404);
  });

  it("ketiadaan avatar di-cache: ENS tidak dipanggil dua kali", async () => {
    const ensAvatar = vi.fn(async () => null);
    const a = app(ensAvatar);
    await a.request(`/avatar/${ALAMAT}`);
    await a.request(`/avatar/${ALAMAT}`);
    expect(ensAvatar).toHaveBeenCalledTimes(1);
  });

  it("gambar yang sudah diambil dilayani dari cache", async () => {
    const ambil = balasGambar("image/webp", 512);
    globalThis.fetch = ambil as never;
    const a = app(async () => "https://contoh.test/a.webp");
    const satu = await a.request(`/avatar/${ALAMAT}`);
    const dua = await a.request(`/avatar/${ALAMAT}`);
    expect(satu.status).toBe(200);
    expect(dua.status).toBe(200);
    expect(ambil).toHaveBeenCalledTimes(1);
  });

  it("RPC mainnet gagal → 404 TANPA ikut di-cache, supaya bisa dicoba lagi", async () => {
    const ensAvatar = vi.fn(async () => { throw new Error("rpc mati"); });
    const a = app(ensAvatar as never);
    expect((await a.request(`/avatar/${ALAMAT}`)).status).toBe(404);
    expect((await a.request(`/avatar/${ALAMAT}`)).status).toBe(404);
    expect(ensAvatar).toHaveBeenCalledTimes(2);
  });
});
