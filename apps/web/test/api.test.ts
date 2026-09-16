import { describe, expect, it, vi } from "vitest";
import { apiBelumDiatur, basisApi, buatKlienGraf, GalatApi, urlGraf } from "../src/api";

const HALAMAN = { simpul: [], sisi: [], kursor: 0, lengkap: true };

function jawab(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

describe("klien graf", () => {
  it("basis dari VITE_API_URL tanpa garis miring penutup; kosong = origin yang sama", () => {
    expect(basisApi("https://api.nearly.xyz/")).toBe("https://api.nearly.xyz");
    expect(basisApi(undefined)).toBe("");
    expect(urlGraf("", "/graf/jaringan", 5)).toBe("/graf/jaringan?sejakId=5");
  });

  it("build produksi tanpa VITE_API_URL = API belum diatur; dev boleh kosong (proxy Vite)", () => {
    expect(apiBelumDiatur(undefined, true)).toBe(true);
    expect(apiBelumDiatur("", true)).toBe(true);
    expect(apiBelumDiatur("  / ", true)).toBe(true);
    expect(apiBelumDiatur("https://api.nearly.xyz", true)).toBe(false);
    expect(apiBelumDiatur(undefined, false)).toBe(false);
  });

  it("jaringan dan acara memakai sejakId; hanya header Accept", async () => {
    const ambil = jawab(200, { ...HALAMAN, acara: { eventId: "0x1", title: "x", startsAt: 1, endsAt: 2, live: true }, hitungan: { hadir: 1, salaman: 0 } });
    const k = buatKlienGraf("https://api.x", ambil);
    await k.jaringan(7);
    await k.acara("0xabc", 9);
    expect(ambil.mock.calls.map((c) => (c as unknown as [string])[0])).toEqual([
      "https://api.x/graf/jaringan?sejakId=7", "https://api.x/graf/acara/0xabc?sejakId=9",
    ]);
    const init = (ambil.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.headers).toEqual({ Accept: "application/json" });
  });

  it("404 event_not_found menjadi GalatApi dengan status dan kode", async () => {
    const k = buatKlienGraf("", jawab(404, { code: "event_not_found" }));
    await expect(k.acara("0xabc", 0)).rejects.toMatchObject({ status: 404, kode: "event_not_found" });
  });

  it("bentuk respons salah ditolak", async () => {
    const k = buatKlienGraf("", jawab(200, { simpul: "bukan array" }));
    await expect(k.jaringan(0)).rejects.toBeInstanceOf(GalatApi);
  });

  it("batas waktu membatalkan permintaan", async () => {
    const ambil = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_, tolak) => {
      init.signal!.addEventListener("abort", () => tolak(new Error("aborted")));
    }));
    const k = buatKlienGraf("", ambil, 20);
    await expect(k.jaringan(0)).rejects.toMatchObject({ status: null, kode: "batas_waktu" });
  });

  it("galat jaringan menjadi kode jaringan", async () => {
    const k = buatKlienGraf("", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    await expect(k.jaringan(0)).rejects.toMatchObject({ status: null, kode: "jaringan" });
  });
});
