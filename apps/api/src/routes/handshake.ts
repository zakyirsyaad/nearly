import { Hono } from "hono";
import type { Address, Hex } from "viem";
import { AcceptRequestSchema, OfferRequestSchema } from "@nearly/shared";
import { acceptHandshake, submitOffer } from "../handshake-gate";
import type { GateDeps } from "../ports";

export function handshakeRoutes(deps: GateDeps) {
  const r = new Hono();

  r.post("/handshake/offer", async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = OfferRequestSchema.safeParse(raw);
    if (!parsed.success) return c.json({ code: "invalid_body" }, 400);

    const b = parsed.data;
    const result = await submitOffer(
      {
        initiator: b.initiator as Address,
        nonce: b.nonce as Hex,
        expiresAt: BigInt(b.expiresAt),
        sigOffer: b.sigOffer as Hex,
        cell: b.cell,
        atMs: b.atMs,
      },
      deps,
    );
    if (!result.ok) return c.json(result.failure, result.failure.httpStatus);
    return c.json({ ok: true });
  });

  r.post("/handshake/accept", async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = AcceptRequestSchema.safeParse(raw);
    if (!parsed.success) return c.json({ code: "invalid_body" }, 400);

    const b = parsed.data;
    const result = await acceptHandshake(
      {
        initiator: b.initiator as Address,
        counterparty: b.counterparty as Address,
        nonce: b.nonce as Hex,
        expiresAt: BigInt(b.expiresAt),
        sigAccept: b.sigAccept as Hex,
        cell: b.cell,
        atMs: b.atMs,
      },
      deps,
    );
    if (!result.ok) return c.json(result.failure, result.failure.httpStatus);
    return c.json({ txHash: result.value.txHash });
  });

  return r;
}
