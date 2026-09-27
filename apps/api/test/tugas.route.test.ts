import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { tugasRoutes } from "../src/routes/tugas";

/**
 * Rute tugas terjadwal (2026-09-27). Yang diuji: rute ini TIDAK bisa dipicu
 * orang luar, dan ketiadaan rahasia membuatnya hilang sama sekali — bukan
 * terbuka. Sapuan lokasi menghapus baris lokasi orang; dipicu sembarangan ia
 * bukan bencana, tapi rute tak terlindung yang menulis ke basis data adalah
 * pintu yang tidak perlu kita buka.
 */
const NOW = 1_800_000_000_000;

function app(cronSecret: string | undefined, sapuLokasi = vi.fn(async () => {})) {
  const a = new Hono();
  a.route("/", tugasRoutes({ radar: { sapuLokasi } as never, nowMs: () => NOW, cronSecret }));
  return { a, sapuLokasi };
}

describe("GET /tugas/sapu-lokasi", () => {
  it("tanpa rahasia terkonfigurasi → 404, sapuan tidak jalan", async () => {
    const { a, sapuLokasi } = app(undefined);
    const res = await a.request("/tugas/sapu-lokasi", { headers: { authorization: "Bearer apa pun" } });
    expect(res.status).toBe(404);
    expect(sapuLokasi).not.toHaveBeenCalled();
  });

  it("token salah atau tanpa header → 404, bukan 401", async () => {
    const kasus: Record<string, string>[] = [{}, { authorization: "Bearer salah" }, { authorization: "rahasia" }];
    for (const headers of kasus) {
      const { a, sapuLokasi } = app("rahasia");
      const res = await a.request("/tugas/sapu-lokasi", { headers });
      expect(res.status, JSON.stringify(headers)).toBe(404);
      expect(sapuLokasi).not.toHaveBeenCalled();
    }
  });

  it("token benar → sapuan jalan dengan waktu dari deps", async () => {
    const { a, sapuLokasi } = app("rahasia");
    const res = await a.request("/tugas/sapu-lokasi", { headers: { authorization: "Bearer rahasia" } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(sapuLokasi).toHaveBeenCalledWith(NOW);
  });

  it("sapuan gagal tetap 200: cron yang dianggap error akan diulang terus", async () => {
    const gagal = vi.fn(async () => { throw new Error("supabase tersendat"); });
    const { a } = app("rahasia", gagal);
    const res = await a.request("/tugas/sapu-lokasi", { headers: { authorization: "Bearer rahasia" } });
    expect(res.status).toBe(200);
    expect(gagal).toHaveBeenCalled();
  });
});
