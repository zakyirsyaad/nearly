import { describe, expect, it, vi } from "vitest";
import { createExpoPush, URL_PUSH_EXPO } from "../src/push";

function fetchPalsu(jawab: (badan: unknown[]) => { ok?: boolean; status?: number; data?: unknown[] }) {
  return vi.fn(async (_url: string, init: RequestInit) => {
    const badan = JSON.parse(String(init.body)) as unknown[];
    const j = jawab(badan);
    return { ok: j.ok ?? true, status: j.status ?? 200, json: async () => ({ data: j.data }) } as Response;
  });
}

describe("createExpoPush", () => {
  it("satu pesan per token, ke Expo Push API", async () => {
    const f = fetchPalsu((b) => ({ data: b.map(() => ({ status: "ok" })) }));
    await createExpoPush(f as never).kirim({
      tokens: ["ExponentPushToken[a]", "ExponentPushToken[b]"], judul: "Nearly", badan: "Pesan baru dari Ani", data: { jenis: "pesan" },
    });
    expect(f).toHaveBeenCalledTimes(1);
    expect(f.mock.calls[0]![0]).toBe(URL_PUSH_EXPO);
    expect(JSON.parse(String(f.mock.calls[0]![1].body))).toEqual([
      { to: "ExponentPushToken[a]", title: "Nearly", body: "Pesan baru dari Ani", data: { jenis: "pesan" }, sound: "default" },
      { to: "ExponentPushToken[b]", title: "Nearly", body: "Pesan baru dari Ani", data: { jenis: "pesan" }, sound: "default" },
    ]);
  });

  it("lebih dari seratus token dipecah per seratus", async () => {
    const f = fetchPalsu((b) => ({ data: b.map(() => ({ status: "ok" })) }));
    const tokens = Array.from({ length: 250 }, (_, i) => `ExponentPushToken[${i}]`);
    await createExpoPush(f as never).kirim({ tokens, judul: "Nearly", badan: "x", data: {} });
    expect(f.mock.calls.map((c) => (JSON.parse(String(c[1].body)) as unknown[]).length)).toEqual([100, 100, 50]);
  });

  it("DeviceNotRegistered dikembalikan sebagai token mati, galat lain tidak", async () => {
    const f = fetchPalsu(() => ({ data: [
      { status: "error", details: { error: "DeviceNotRegistered" } },
      { status: "error", details: { error: "MessageRateExceeded" } },
      { status: "ok" },
    ] }));
    const hasil = await createExpoPush(f as never).kirim({
      tokens: ["ExponentPushToken[mati]", "ExponentPushToken[sibuk]", "ExponentPushToken[hidup]"], judul: "Nearly", badan: "x", data: {},
    });
    expect(hasil).toEqual({ tokenMati: ["ExponentPushToken[mati]"] });
  });

  it("HTTP bukan 2xx melempar", async () => {
    const f = fetchPalsu(() => ({ ok: false, status: 500 }));
    await expect(createExpoPush(f as never).kirim({ tokens: ["ExponentPushToken[a]"], judul: "Nearly", badan: "x", data: {} }))
      .rejects.toThrow(/HTTP 500/);
  });
});
