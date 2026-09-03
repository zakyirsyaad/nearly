import { beforeEach, describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { encodeCell, offerTypedData, acceptTypedData } from "@nearly/shared";
import { createApp } from "../src/app.js";
import type { GateDeps, PendingOffer } from "../src/ports.js";

const A = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
const B = privateKeyToAccount("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a");
const VC = "0x0000000000000000000000000000000000000abc" as Address;
const NONCE = `0x${"11".repeat(32)}` as Hex;
const CELL = encodeCell(-6.2088, 106.8456);
const NOW = 1_700_000_000_000;
const EXPIRES = BigInt(Math.floor(NOW / 1000) + 30);
const TX = `0x${"ab".repeat(32)}` as Hex;

function deps(): GateDeps {
  const offers = new Map<Hex, PendingOffer>();
  return {
    verifyingContract: VC,
    nowMs: () => NOW,
    store: {
      putOffer: async (o) => { offers.set(o.nonce, { ...o, consumed: false }); },
      getOffer: async (n) => offers.get(n) ?? null,
      consumeOffer: async (n) => {
        const o = offers.get(n); if (o) offers.set(n, { ...o, consumed: true });
      },
      areConnected: async () => false,
      countConnectionsSince: async () => 0,
      recordConnection: async () => {},
    },
    chain: { submitConnect: vi.fn(async () => TX) },
  };
}

function post(app: ReturnType<typeof createApp>, path: string, body: unknown) {
  return app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function offerBody() {
  const o = { initiator: A.address, nonce: NONCE, expiresAt: EXPIRES };
  return {
    initiator: A.address, nonce: NONCE, expiresAt: EXPIRES.toString(),
    sigOffer: await A.signTypedData(offerTypedData(o, VC)),
    cell: CELL, atMs: NOW,
  };
}

async function acceptBody(cell = CELL) {
  const acc = { initiator: A.address, counterparty: B.address, nonce: NONCE, expiresAt: EXPIRES };
  return {
    initiator: A.address, counterparty: B.address, nonce: NONCE,
    expiresAt: EXPIRES.toString(),
    sigAccept: await B.signTypedData(acceptTypedData(acc, VC)),
    cell, atMs: NOW,
  };
}

describe("POST /handshake/offer", () => {
  let app: ReturnType<typeof createApp>;
  beforeEach(() => { app = createApp(deps()); });

  it("200 untuk offer yang sah", async () => {
    expect((await post(app, "/handshake/offer", await offerBody())).status).toBe(200);
  });

  it("400 untuk body yang tidak sesuai skema", async () => {
    const res = await post(app, "/handshake/offer", { initiator: "salah" });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "invalid_body" });
  });

  it("400 untuk body yang bukan JSON", async () => {
    const res = await app.request("/handshake/offer", {
      method: "POST", headers: { "content-type": "application/json" }, body: "bukan json",
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /handshake/accept", () => {
  let d: GateDeps;
  let app: ReturnType<typeof createApp>;
  beforeEach(async () => {
    d = deps();
    app = createApp(d);
    await post(app, "/handshake/offer", await offerBody());
  });

  it("200 dan mengembalikan txHash ketika keduanya berdekatan", async () => {
    const res = await post(app, "/handshake/accept", await acceptBody());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ txHash: TX });
  });

  it("422 ketika keduanya berjauhan, dan TIDAK menyentuh chain", async () => {
    const jauh = encodeCell(-6.9175, 107.6191);
    const res = await post(app, "/handshake/accept", await acceptBody(jauh));
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ code: "not_colocated", reason: "cell_too_far" });
    expect(d.chain.submitConnect).not.toHaveBeenCalled();
  });

  it("404 ketika nonce-nya tidak dikenal", async () => {
    const body = { ...(await acceptBody()), nonce: `0x${"99".repeat(32)}` };
    expect((await post(app, "/handshake/accept", body)).status).toBe(404);
  });

  it("400 ketika counterparty sama dengan initiator", async () => {
    const body = { ...(await acceptBody()), counterparty: A.address };
    expect((await post(app, "/handshake/accept", body)).status).toBe(400);
  });
});

describe("GET /health", () => {
  it("200", async () => {
    expect((await createApp(deps()).request("/health")).status).toBe(200);
  });
});
