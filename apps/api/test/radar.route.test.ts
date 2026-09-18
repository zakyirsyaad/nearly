import { beforeEach, describe, expect, it } from "vitest";
import { Hono } from "hono";
import { tandaRequest } from "@nearly/shared";
import { radarRoutes } from "../src/routes/radar";
import { createApp } from "../src/app";
import { depsFor } from "./support/deps";
import { buatPengguna } from "./support/dunia-pesan";
import { duniaRadar, EVENT_RADAR, MENIT, SEL_JAUH, SEL_PUSAT } from "./support/dunia-radar";

type Pengguna = Awaited<ReturnType<typeof buatPengguna>>;
let A: Pengguna;
let B: Pengguna;

beforeEach(async () => {
  [A, B] = await Promise.all([buatPengguna("a1"), buatPengguna("b2")]);
});

const tunggu = () => new Promise((r) => setTimeout(r, 0));

function dunia(awal: Parameters<typeof duniaRadar>[0] = {}) {
  const d = duniaRadar({ checkIn: [A.address, B.address], ...awal });
  for (const p of [A, B]) d.db.kunci.set(p.address.toLowerCase(), p.terdaftar);
  const app = new Hono().route("/", radarRoutes(d.deps));

  async function panggil(p: Pengguna, method: "GET" | "POST", path: string, body?: unknown, over: { badanDikirim?: string } = {}) {
    const badan = body === undefined ? "" : JSON.stringify(body);
    const ts = Math.floor(d.jam.sekarang / 1000);
    const tanda = tandaRequest(p.kunci.privTanda, { method, pathDenganQuery: path, badan, ts, who: p.address });
    return app.request(path, {
      method,
      headers: { "content-type": "application/json", "x-nearly-who": p.address, "x-nearly-ts": String(ts), "x-nearly-tanda": tanda },
      body: method === "GET" ? undefined : (over.badanDikirim ?? badan),
    });
  }
  const detak = (p: Pengguna, cell = SEL_PUSAT) => panggil(p, "POST", `/radar/${EVENT_RADAR}/detak`, { cell });
  const radar = (p: Pengguna) => panggil(p, "GET", `/radar/${EVENT_RADAR}`);
  return { d, app, panggil, detak, radar };
}

describe("POST /radar/:eventId/detak — langkah 1 dan 2 di rute", () => {
  it("tanpa header → 401 butuh_autentikasi", async () => {
    const { app } = dunia();
    const r = await app.request(`/radar/${EVENT_RADAR}/detak`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cell: SEL_PUSAT }),
    });
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ code: "butuh_autentikasi" });
  });

  it("urutan: tanpa header DENGAN badan sampah → 401, bukan 400", async () => {
    const { app } = dunia();
    const r = await app.request(`/radar/${EVENT_RADAR}/detak`, {
      method: "POST", headers: { "content-type": "application/json" }, body: "sampah",
    });
    expect(r.status).toBe(401);
  });

  it("pemanggil tanpa kunci sesi terdaftar → 401 yang sama", async () => {
    const { d, detak } = dunia();
    d.db.kunci.delete(A.address.toLowerCase());
    const r = await detak(A);
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ code: "butuh_autentikasi" });
  });

  it("badan diubah setelah ditandatangani → 401", async () => {
    const { panggil } = dunia();
    const r = await panggil(A, "POST", `/radar/${EVENT_RADAR}/detak`, { cell: SEL_PUSAT }, {
      badanDikirim: JSON.stringify({ cell: SEL_JAUH }),
    });
    expect(r.status).toBe(401);
  });

  it("sel bukan geohash7 → 400 invalid_body", async () => {
    const { panggil } = dunia();
    const r = await panggil(A, "POST", `/radar/${EVENT_RADAR}/detak`, { cell: "bukan" });
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ code: "invalid_body" });
  });

  it("urutan: badan tidak sah untuk acara yang tidak ada → 400, bukan 404", async () => {
    const { panggil } = dunia();
    const r = await panggil(A, "POST", `/radar/0x${"99".repeat(32)}/detak`, { cell: "bukan" });
    expect(r.status).toBe(400);
  });

  it("eventId cacat bentuk → 404 event_not_found", async () => {
    const { panggil } = dunia();
    const r = await panggil(A, "POST", "/radar/bukan-id/detak", { cell: SEL_PUSAT });
    expect(r.status).toBe(404);
  });
});

describe("POST /radar/:eventId/detak — jawaban", () => {
  it("hadir: kunci JSON persis { hadir }", async () => {
    const { detak } = dunia();
    const r = await detak(A);
    expect(r.status).toBe(200);
    const json = await r.json() as Record<string, unknown>;
    expect(Object.keys(json)).toEqual(["hadir"]);
    expect(json).toEqual({ hadir: true });
  });

  it("di luar area: kunci JSON persis { hadir, alasan } — tanpa baruHadir", async () => {
    const { detak } = dunia();
    const json = await (await detak(A, SEL_JAUH)).json() as Record<string, unknown>;
    expect(Object.keys(json).sort()).toEqual(["alasan", "hadir"]);
    expect(json).toEqual({ hadir: false, alasan: "di_luar_area" });
  });

  it("galat gerbang diteruskan dengan status HTTP-nya", async () => {
    const { d, detak } = dunia({ checkIn: [] });
    for (const p of [A, B]) d.db.kunci.set(p.address.toLowerCase(), p.terdaftar);
    const r = await detak(A);
    expect(r.status).toBe(403);
    expect(await r.json()).toMatchObject({ code: "belum_check_in" });
  });
});

describe("notifikasi kedekatan dari rute", () => {
  it("transisi tidak hadir → hadir memicu notifikasi tepat sekali; detak lanjutan tidak", async () => {
    const { d, detak } = dunia({
      koneksi: [[A.address, B.address]],
      token: { [A.address]: ["ExponentPushToken[a]"], [B.address]: ["ExponentPushToken[b]"] },
    });
    d.hadirkan(B.address);
    expect((await detak(A)).status).toBe(200);
    await tunggu();
    expect(d.push.kirim).toHaveBeenCalledTimes(2); // dua arah, satu pasangan

    d.jam.sekarang += MENIT;
    expect((await detak(A)).status).toBe(200);
    await tunggu();
    expect(d.push.kirim).toHaveBeenCalledTimes(2);
    expect(d.deps.radar.hadirSejak).toHaveBeenCalledTimes(1);
  });

  it("push yang gagal tidak menggagalkan detak", async () => {
    const { d, detak } = dunia({ koneksi: [[A.address, B.address]], token: { [B.address]: ["ExponentPushToken[b]"] } });
    d.hadirkan(B.address);
    d.push.kirim.mockRejectedValue(new Error("expo mati"));
    expect((await detak(A)).status).toBe(200);
    await tunggu();
  });

  it("detak yang lolos memicu sapuan lokasi paling sering sekali per 10 menit", async () => {
    const { d, detak } = dunia();
    await detak(A);
    d.jam.sekarang += MENIT;
    await detak(A);
    await tunggu();
    expect(d.deps.radar.sapuLokasi).toHaveBeenCalledTimes(1);
  });
});

describe("GET /radar/:eventId", () => {
  it("tanpa header → 401", async () => {
    const { app } = dunia();
    expect((await app.request(`/radar/${EVENT_RADAR}`)).status).toBe(401);
  });

  it("belum hadir → 403 belum_hadir", async () => {
    const { radar } = dunia();
    const r = await radar(A);
    expect(r.status).toBe(403);
    expect(await r.json()).toMatchObject({ code: "belum_hadir" });
  });

  // Spec 4b+5 §5.2 dan §11: nama KUNCI, bukan hanya nilai.
  it("nama kunci JSON: { kartu, jumlah }, kartu hanya kunci yang diizinkan, tanpa cell/seen_at/skor", async () => {
    const { d, detak, radar } = dunia({
      koneksi: [[A.address, B.address]], nama: { [B.address]: "Budi" }, tier: { [B.address]: 2 },
    });
    d.hadirkan(B.address);
    await detak(A);
    const r = await radar(A);
    expect(r.status).toBe(200);
    const teks = await r.text();
    const json = JSON.parse(teks) as { kartu: Record<string, unknown>[]; jumlah: number };

    expect(Object.keys(json).sort()).toEqual(["jumlah", "kartu"]);
    expect(json.kartu).toHaveLength(1);
    expect(Object.keys(json.kartu[0]!).sort()).toEqual(
      ["address", "displayName", "pernahBertemu", "salingInginBertemu", "tierLabel"],
    );
    expect(json.kartu[0]).toEqual({
      address: B.address.toLowerCase(), displayName: "Budi", tierLabel: "Terpercaya",
      pernahBertemu: true, salingInginBertemu: false,
    });
    for (const terlarang of ["cell", "seen_at", "seenAt", "score", "skor", "tier\"", "ratio", SEL_PUSAT]) {
      expect(teks).not.toContain(terlarang);
    }
  });

  it("A memblokir B → keduanya saling tidak terlihat lewat HTTP", async () => {
    const { d, detak, radar } = dunia({ blokir: [{ blocker: A.address, blocked: B.address }] });
    await detak(A);
    await detak(B);
    expect(await (await radar(A)).json()).toEqual({ kartu: [], jumlah: 0 });
    expect(await (await radar(B)).json()).toEqual({ kartu: [], jumlah: 0 });
    expect(d.db.kehadiran.size).toBe(2);
  });

  it("rute memakai cache koneksi bersama: dua GET dalam 60 detik → satu hitungan", async () => {
    const { d, detak, radar } = dunia();
    d.hadirkan(B.address);
    await detak(A);
    await radar(A);
    await radar(A);
    expect(d.deps.radar.hitungKoneksiBersama).toHaveBeenCalledTimes(1);
  });
});

describe("perakitan createApp", () => {
  it("rute radar terpasang: tanpa header → 401", async () => {
    const app = createApp(depsFor());
    expect((await app.request(`/radar/${EVENT_RADAR}`)).status).toBe(401);
    const r = await app.request(`/radar/${EVENT_RADAR}/detak`, { method: "POST", body: "{}" });
    expect(r.status).toBe(401);
  });
});
