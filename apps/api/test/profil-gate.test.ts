import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";
import { aturProfilTypedData, type Visibilitas } from "@nearly/shared";
import { ambilProfilSaya, aturProfil, MAKS_UMUR_ATUR_PROFIL_DETIK } from "../src/profil-gate";
import { alamat, duniaRadar, EVENT_RADAR, VC_RADAR } from "./support/dunia-radar";

const AKU = privateKeyToAccount(`0x${"a1".repeat(32)}` as Hex);
const LAIN = privateKeyToAccount(`0x${"b2".repeat(32)}` as Hex);

async function masukan(d: ReturnType<typeof duniaRadar>, over: {
  displayName?: string; visibilitas?: Visibilitas; expiresAt?: bigint; penanda?: typeof AKU;
} = {}) {
  const msg = {
    who: AKU.address,
    displayName: over.displayName ?? "Budi",
    visibilitas: over.visibilitas ?? "terlihat",
    expiresAt: over.expiresAt ?? BigInt(Math.floor(d.jam.sekarang / 1000) + 300),
  };
  const sig = await (over.penanda ?? AKU).signTypedData(aturProfilTypedData(msg, VC_RADAR));
  return { ...msg, sig };
}

describe("aturProfil — gerbang spec 4b+5 §7.2", () => {
  it("sah → profil tersimpan dengan nama setelah trim", async () => {
    const d = duniaRadar();
    expect(await aturProfil(await masukan(d, { displayName: "  Budi  " }), d.deps)).toEqual({ ok: true, value: undefined });
    expect(d.db.profil.get(AKU.address.toLowerCase())).toEqual({ displayName: "Budi", visibilitas: "terlihat" });
  });

  it("nama kosong menghapus nama", async () => {
    const d = duniaRadar({ nama: { [AKU.address]: "Lama" } });
    await aturProfil(await masukan(d, { displayName: "" }), d.deps);
    expect(d.db.profil.get(AKU.address.toLowerCase())?.displayName).toBe("");
  });

  it("langkah 2: expiresAt sudah lewat → 410 expired", async () => {
    const d = duniaRadar();
    const m = await masukan(d, { expiresAt: BigInt(Math.floor(d.jam.sekarang / 1000) - 1) });
    expect(await aturProfil(m, d.deps)).toEqual({ ok: false, failure: { code: "expired", httpStatus: 410 } });
  });

  it("langkah 2: expiresAt lebih dari 1 jam ke depan → 410 expired", async () => {
    const d = duniaRadar();
    const nowSec = BigInt(Math.floor(d.jam.sekarang / 1000));
    const tepat = await masukan(d, { expiresAt: nowSec + BigInt(MAKS_UMUR_ATUR_PROFIL_DETIK) });
    const lebih = await masukan(d, { expiresAt: nowSec + BigInt(MAKS_UMUR_ATUR_PROFIL_DETIK) + 1n });
    expect((await aturProfil(tepat, d.deps)).ok).toBe(true);
    expect(await aturProfil(lebih, d.deps)).toEqual({ ok: false, failure: { code: "expired", httpStatus: 410 } });
  });

  it("langkah 3: ditandatangani dompet lain → 401 bad_signature, tidak menulis", async () => {
    const d = duniaRadar();
    const m = await masukan(d, { penanda: LAIN });
    expect(await aturProfil(m, d.deps)).toEqual({ ok: false, failure: { code: "bad_signature", httpStatus: 401 } });
    expect(d.deps.profilSaya.aturProfil).not.toHaveBeenCalled();
  });

  it("langkah 3: tanda tangan cacat bentuk (v = 0x99) → 401, bukan melempar", async () => {
    const d = duniaRadar();
    const m = { ...(await masukan(d)), sig: `0x${"99".repeat(65)}` as Hex };
    expect(await aturProfil(m, d.deps)).toEqual({ ok: false, failure: { code: "bad_signature", httpStatus: 401 } });
  });

  it("langkah 3: visibilitas ditukar setelah ditandatangani → 401", async () => {
    const d = duniaRadar();
    const m = { ...(await masukan(d, { visibilitas: "terlihat" })), visibilitas: "tersembunyi" as const };
    expect(await aturProfil(m, d.deps)).toEqual({ ok: false, failure: { code: "bad_signature", httpStatus: 401 } });
  });

  it("langkah 4: nama bidi → 400 nama_tidak_sah, tidak menulis", async () => {
    const d = duniaRadar();
    const m = await masukan(d, { displayName: "Budi‮gnp" });
    expect(await aturProfil(m, d.deps)).toEqual({ ok: false, failure: { code: "nama_tidak_sah", httpStatus: 400 } });
    expect(d.deps.profilSaya.aturProfil).not.toHaveBeenCalled();
  });

  it("langkah 4: nama 33 code point → 400 nama_tidak_sah", async () => {
    const d = duniaRadar();
    const m = await masukan(d, { displayName: "👍".repeat(33) });
    expect(await aturProfil(m, d.deps)).toEqual({ ok: false, failure: { code: "nama_tidak_sah", httpStatus: 400 } });
  });

  it("urutan: kedaluwarsa + tanda tangan salah + nama bidi → expired", async () => {
    const d = duniaRadar();
    const m = await masukan(d, { displayName: "a‮b", penanda: LAIN, expiresAt: 1n });
    expect(await aturProfil(m, d.deps)).toEqual({ ok: false, failure: { code: "expired", httpStatus: 410 } });
  });

  it("urutan: tanda tangan salah + nama bidi → bad_signature", async () => {
    const d = duniaRadar();
    const m = await masukan(d, { displayName: "a‮b", penanda: LAIN });
    expect(await aturProfil(m, d.deps)).toEqual({ ok: false, failure: { code: "bad_signature", httpStatus: 401 } });
  });

  it("pindah ke Tersembunyi menghapus SEMUA baris kehadiran who, di acara mana pun", async () => {
    const d = duniaRadar();
    const aku = AKU.address.toLowerCase();
    const acaraLain = `0x${"e2".repeat(32)}`;
    d.db.kehadiran.set(`${EVENT_RADAR}|${aku}`, { eventId: EVENT_RADAR, address: aku, cell: "qqguv1r", seenAtMs: 1 });
    d.db.kehadiran.set(`${acaraLain}|${aku}`, { eventId: acaraLain, address: aku, cell: "qqguv1r", seenAtMs: 1 });
    d.hadirkan(alamat(0xb));
    await aturProfil(await masukan(d, { visibilitas: "tersembunyi" }), d.deps);
    expect([...d.db.kehadiran.values()].map((b) => b.address)).toEqual([alamat(0xb)]);
    expect(d.db.profil.get(aku)?.visibilitas).toBe("tersembunyi");
  });

  it("tetap Terlihat tidak menghapus kehadiran", async () => {
    const d = duniaRadar();
    d.hadirkan(AKU.address.toLowerCase() as `0x${string}`);
    await aturProfil(await masukan(d, { visibilitas: "terlihat" }), d.deps);
    expect(d.db.kehadiran.size).toBe(1);
  });
});

describe("ambilProfilSaya", () => {
  it("hanya displayName dan visibilitas; default untuk profil yang belum ada", async () => {
    const d = duniaRadar();
    expect(await ambilProfilSaya(AKU.address, d.deps)).toEqual({ displayName: "", visibilitas: "terlihat" });
  });
});
