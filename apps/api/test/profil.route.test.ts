import { beforeEach, describe, expect, it } from "vitest";
import { Hono } from "hono";
import type { Hex } from "viem";
import { aturProfilTypedData, tandaRequest } from "@nearly/shared";
import { profilRoutes } from "../src/routes/profil";
import { createApp } from "../src/app";
import { depsFor } from "./support/deps";
import { buatPengguna } from "./support/dunia-pesan";
import { duniaRadar, EVENT_RADAR, VC_RADAR } from "./support/dunia-radar";

type Pengguna = Awaited<ReturnType<typeof buatPengguna>>;
let A: Pengguna;

beforeEach(async () => {
  A = await buatPengguna("a1");
});

function dunia() {
  const d = duniaRadar();
  d.db.kunci.set(A.address.toLowerCase(), A.terdaftar);
  const app = new Hono().route("/", profilRoutes(d.deps));

  async function simpan(over: { displayName?: string; visibilitas?: "terlihat" | "tersembunyi"; sig?: Hex } = {}) {
    const msg = {
      who: A.address, displayName: over.displayName ?? "Budi", visibilitas: over.visibilitas ?? "terlihat",
      expiresAt: BigInt(Math.floor(d.jam.sekarang / 1000) + 300),
    } as const;
    const sig = over.sig ?? await A.akun.signTypedData(aturProfilTypedData(msg, VC_RADAR));
    return app.request("/profil", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...msg, expiresAt: msg.expiresAt.toString(), sig }),
    });
  }

  async function saya() {
    const path = "/profil/saya";
    const ts = Math.floor(d.jam.sekarang / 1000);
    const tanda = tandaRequest(A.kunci.privTanda, { method: "GET", pathDenganQuery: path, badan: "", ts, who: A.address });
    return app.request(path, { headers: { "x-nearly-who": A.address, "x-nearly-ts": String(ts), "x-nearly-tanda": tanda } });
  }
  return { d, app, simpan, saya };
}

describe("POST /profil", () => {
  it("sah → 200 { ok: true }, lalu GET /profil/saya membacanya", async () => {
    const { simpan, saya } = dunia();
    const r = await simpan({ displayName: "  Budi  ", visibilitas: "tersembunyi" });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
    expect(await (await saya()).json()).toEqual({ displayName: "Budi", visibilitas: "tersembunyi" });
  });

  it("badan tidak sah → 400 invalid_body", async () => {
    const { app } = dunia();
    const r = await app.request("/profil", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ code: "invalid_body" });
  });

  it("tanda tangan cacat bentuk → 401 bad_signature, bukan 500", async () => {
    const { simpan } = dunia();
    const r = await simpan({ sig: `0x${"99".repeat(65)}` as Hex });
    expect(r.status).toBe(401);
    expect(await r.json()).toMatchObject({ code: "bad_signature" });
  });

  it("nama bidi → 400 nama_tidak_sah", async () => {
    const { simpan } = dunia();
    const r = await simpan({ displayName: "Budi‮gnp" });
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({ code: "nama_tidak_sah" });
  });

  it("pindah ke Tersembunyi lewat HTTP menghapus kehadiran", async () => {
    const { d, simpan } = dunia();
    d.hadirkan(A.address.toLowerCase() as Hex);
    expect(d.db.kehadiran.has(`${EVENT_RADAR}|${A.address.toLowerCase()}`)).toBe(true);
    await simpan({ visibilitas: "tersembunyi" });
    expect(d.db.kehadiran.size).toBe(0);
  });
});

describe("GET /profil/saya", () => {
  it("tanpa header → 401", async () => {
    const { app } = dunia();
    expect((await app.request("/profil/saya")).status).toBe(401);
  });

  it("nama kunci JSON persis { displayName, visibilitas }", async () => {
    const { saya } = dunia();
    const json = await (await saya()).json() as Record<string, unknown>;
    expect(Object.keys(json).sort()).toEqual(["displayName", "visibilitas"]);
  });
});

describe("perakitan createApp", () => {
  it("rute profil terpasang", async () => {
    const app = createApp(depsFor());
    expect((await app.request("/profil/saya")).status).toBe(401);
    expect((await app.request("/profil", { method: "POST", body: "{}" })).status).toBe(400);
  });
});
