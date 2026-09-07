import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, postJson, req } from "../src/http";

const asli = globalThis.fetch;
afterEach(() => { globalThis.fetch = asli; });

function palsu(status: number, body: unknown) {
  globalThis.fetch = vi.fn(async () => new Response(JSON.stringify(body), {
    status, headers: { "content-type": "application/json" },
  })) as unknown as typeof fetch;
}

describe("req", () => {
  it("mengembalikan JSON pada respons sukses", async () => {
    palsu(200, { ok: true });
    await expect(req<{ ok: boolean }>("/x")).resolves.toEqual({ ok: true });
  });

  it("melempar ApiError dengan code dan status dari badan", async () => {
    palsu(409, { code: "post_exists" });
    await expect(req("/x")).rejects.toMatchObject({ code: "post_exists", status: 409 });
  });

  it("meneruskan reason kalau ada", async () => {
    palsu(422, { code: "not_colocated", reason: "time_too_far" });
    await expect(req("/x")).rejects.toMatchObject({ reason: "time_too_far" });
  });

  // Badan bukan JSON tidak boleh menjadi galat parse yang membingungkan.
  it("memakai code unknown kalau badan tidak bisa dibaca", async () => {
    globalThis.fetch = vi.fn(async () => new Response("bukan json", { status: 500 })) as unknown as typeof fetch;
    await expect(req("/x")).rejects.toMatchObject({ code: "unknown", status: 500 });
  });
});

describe("postJson", () => {
  it("mengirim metode POST dengan content-type JSON", async () => {
    const mata = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = mata as unknown as typeof fetch;
    await postJson("/x", { a: 1 });
    const [, init] = mata.mock.calls[0]!;
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).body).toBe(JSON.stringify({ a: 1 }));
  });
});

describe("ApiError", () => {
  it("pesannya memuat code, dan reason kalau ada", () => {
    expect(new ApiError("expired", 410).message).toContain("expired");
    expect(new ApiError("not_colocated", 422, "cell_too_far").message).toContain("cell_too_far");
  });
});
