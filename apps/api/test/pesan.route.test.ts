import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { Address, Hex } from "viem";
import {
  bukaPesan, daftarKunciPesanTypedData, enkripsiPesan, reasonHashOf, reportTypedData, tandaRequest,
} from "@nearly/shared";
import { pesanRoutes } from "../src/routes/pesan";
import { buatPengguna, duniaPesan, VC_PESAN, VOUCH_PESAN } from "./support/dunia-pesan";

type Pengguna = Awaited<ReturnType<typeof buatPengguna>>;
let A: Pengguna;
let B: Pengguna;
let C: Pengguna;

beforeEach(async () => {
  [A, B, C] = await Promise.all([buatPengguna("a1"), buatPengguna("b2"), buatPengguna("c3")]);
});

function dunia() {
  const d = duniaPesan({ koneksi: [[A.address, B.address]], nama: { [A.address]: "Ani" } });
  const app = new Hono().route("/", pesanRoutes(d.deps));

  async function panggil(p: Pengguna, method: string, path: string, body?: unknown, over: { badan?: string; tanda?: string } = {}) {
    const badan = body === undefined ? "" : JSON.stringify(body);
    const ts = Math.floor(d.jam.sekarang / 1000);
    const tanda = over.tanda ?? tandaRequest(p.kunci.privTanda, { method, pathDenganQuery: path, badan, ts, who: p.address });
    return app.request(path, {
      method,
      headers: { "content-type": "application/json", "x-nearly-who": p.address, "x-nearly-ts": String(ts), "x-nearly-tanda": tanda },
      body: method === "GET" ? undefined : (over.badan ?? badan),
    });
  }

  async function daftar(p: Pengguna) {
    const msg = { who: p.address, kunciEnkripsi: p.terdaftar.kunciEnkripsi, kunciTanda: p.terdaftar.kunciTanda, expiresAt: BigInt(Math.floor(d.jam.sekarang / 1000) + 300) };
    const sig = await p.akun.signTypedData(daftarKunciPesanTypedData(msg, VC_PESAN));
    return app.request("/pesan/kunci", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...msg, expiresAt: msg.expiresAt.toString(), sig }),
    });
  }

  function amplopDari(pengirim: Pengguna, penerima: Pengguna, isi: string) {
    return enkripsiPesan({
      kunci: pengirim.kunci, pubEnkripsiLawan: penerima.terdaftar.kunciEnkripsi,
      pengirim: pengirim.address, penerima: penerima.address, isi, dikirimMs: d.jam.sekarang,
    });
  }

  return { d, app, panggil, daftar, amplopDari };
}

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const tunggu = () => new Promise((r) => setTimeout(r, 0));

describe("alur pesan ujung-ke-ujung", () => {
  it("daftar kunci, kirim terenkripsi, lawan melihat percakapan, membuka, menandai dibaca", async () => {
    const { d, panggil, daftar, amplopDari } = dunia();
    expect((await daftar(A)).status).toBe(200);
    expect((await daftar(B)).status).toBe(200);

    const kunciB = await panggil(A, "GET", `/pesan/kunci/${B.address}`);
    expect(kunciB.status).toBe(200);
    expect(await kunciB.json()).toEqual(B.terdaftar);

    const amplop = amplopDari(A, B, "sampai jumpa di acara besok");
    expect((await panggil(A, "POST", "/pesan", { id: ID(1), penerima: B.address, ...amplop })).status).toBe(200);

    const daftarB = await (await panggil(B, "GET", "/pesan/percakapan")).json() as { percakapan: { lawan: string; belumDibaca: number; displayName: string }[] };
    expect(daftarB.percakapan).toEqual([expect.objectContaining({ lawan: A.address.toLowerCase(), belumDibaca: 1, displayName: "Ani" })]);

    const riwayat = await (await panggil(B, "GET", `/pesan/dengan/${A.address}?limit=50`)).json() as { pesan: { ciphertext: string; nonce: Hex; pengirim: string; penerima: string }[] };
    const terbuka = bukaPesan({
      kunci: B.kunci, pubEnkripsiLawan: A.terdaftar.kunciEnkripsi, pubTandaPengirim: A.terdaftar.kunciTanda,
      pengirim: riwayat.pesan[0]!.pengirim, penerima: riwayat.pesan[0]!.penerima,
      ciphertext: riwayat.pesan[0]!.ciphertext, nonce: riwayat.pesan[0]!.nonce,
    });
    expect(terbuka.ok && terbuka.amplop.isi).toBe("sampai jumpa di acara besok");

    expect((await panggil(B, "POST", `/pesan/dengan/${A.address}/dibaca`, { sampaiMs: d.jam.sekarang })).status).toBe(200);
    expect(await (await panggil(B, "GET", "/pesan/belum-dibaca")).json()).toEqual({ total: 0 });
  });
});

describe("autentikasi", () => {
  it("tanpa header → 401", async () => {
    const { app, daftar } = dunia();
    await daftar(A);
    expect((await app.request("/pesan/percakapan")).status).toBe(401);
  });

  it("POST /pesan tanpa header dengan badan sampah → 401", async () => {
    const { app, daftar } = dunia();
    await daftar(A);
    const res = await app.request("/pesan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "sampah bukan json",
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ code: "butuh_autentikasi" });
  });

  it("badan diubah setelah ditandatangani → 401", async () => {
    const { panggil, daftar, amplopDari } = dunia();
    await daftar(A); await daftar(B);
    const asli = { id: ID(1), penerima: B.address, ...amplopDari(A, B, "halo") };
    const diubah = JSON.stringify({ ...asli, id: ID(2) });
    expect((await panggil(A, "POST", "/pesan", asli, { badan: diubah })).status).toBe(401);
  });

  it("tanda tangan cacat bentuk → 401, bukan 500", async () => {
    const { panggil, daftar } = dunia();
    await daftar(A);
    expect((await panggil(A, "GET", "/pesan/percakapan", undefined, { tanda: `0x${"9".repeat(130)}` })).status).toBe(401);
  });
});

describe("gerbang lewat HTTP", () => {
  it("bukan koneksi → 403 tidak_terhubung walau lawan punya kunci", async () => {
    const { panggil, daftar } = dunia();
    await daftar(A); await daftar(C);
    const r = await panggil(C, "GET", `/pesan/kunci/${A.address}`);
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ code: "tidak_terhubung", httpStatus: 403 });
  });

  it("badan lebih dari 32 KB → 413", async () => {
    const { panggil, daftar } = dunia();
    await daftar(A);
    const r = await panggil(A, "POST", "/pesan", { id: ID(1), penerima: B.address, ciphertext: "A".repeat(40_000), nonce: `0x${"cd".repeat(24)}` });
    expect(r.status).toBe(413);
  });
});

describe("push dari rute", () => {
  it("pesan baru memicu push bernama; pesan kedua yang belum dibaca tidak", async () => {
    const { d, panggil, daftar, amplopDari } = dunia();
    await daftar(A); await daftar(B);
    expect((await panggil(B, "POST", "/pesan/token-push", { token: "ExponentPushToken[b]" })).status).toBe(200);

    await panggil(A, "POST", "/pesan", { id: ID(1), penerima: B.address, ...amplopDari(A, B, "satu") });
    await tunggu();
    await panggil(A, "POST", "/pesan", { id: ID(2), penerima: B.address, ...amplopDari(A, B, "dua") });
    await tunggu();

    expect(d.push.kirim).toHaveBeenCalledTimes(1);
    expect(d.push.kirim.mock.calls[0]![0].badan).toBe("Pesan baru dari Ani");
  });

  it("push yang gagal tidak menggagalkan pengiriman", async () => {
    const { d, panggil, daftar, amplopDari } = dunia();
    await daftar(A); await daftar(B);
    await panggil(B, "POST", "/pesan/token-push", { token: "ExponentPushToken[b]" });
    d.push.kirim.mockRejectedValueOnce(new Error("Expo mati"));
    const galat = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await panggil(A, "POST", "/pesan", { id: ID(1), penerima: B.address, ...amplopDari(A, B, "halo") })).status).toBe(200);
    await tunggu();
    galat.mockRestore();
  });
});

describe("lapor lewat HTTP", () => {
  it("bukti dari pesan yang dibuka pelapor diterima", async () => {
    const { d, app, panggil, daftar, amplopDari } = dunia();
    await daftar(A); await daftar(B);
    const amplop = amplopDari(B, A, "ancaman");
    await panggil(B, "POST", "/pesan", { id: ID(1), penerima: A.address, ...amplop });

    const terbuka = bukaPesan({
      kunci: A.kunci, pubEnkripsiLawan: B.terdaftar.kunciEnkripsi, pubTandaPengirim: B.terdaftar.kunciTanda,
      pengirim: B.address, penerima: A.address, ...amplop,
    });
    if (!terbuka.ok) throw new Error("amplop uji harus terbuka");

    const reason = "mengirim ancaman berulang kali";
    const expiresAt = BigInt(Math.floor(d.jam.sekarang / 1000) + 300);
    const sig = await A.akun.signTypedData(reportTypedData({ reporter: A.address, subject: B.address, reasonHash: reasonHashOf(reason), expiresAt }, VOUCH_PESAN));
    const r = await app.request("/pesan/laporan", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        laporan: { reporter: A.address, subject: B.address, reason, expiresAt: expiresAt.toString(), sig },
        bukti: [{ pesanId: ID(1), isi: terbuka.amplop.isi, dikirimMs: terbuka.amplop.dikirimMs, tanda: terbuka.amplop.tanda }],
      }),
    });
    expect(r.status).toBe(200);
    expect(d.db.bukti.get(1)).toHaveLength(1);
  });
});
