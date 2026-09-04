import { Hono } from "hono";
import type { Address, Hex } from "viem";
import { RevokeRequestSchema, VouchRequestSchema } from "@nearly/shared";
import { revokeVouch, submitVouch, type VouchDeps } from "../vouch-gate";

export function vouchRoutes(deps: VouchDeps & { onChanged: () => Promise<void> }) {
  const r = new Hono();

  r.post("/vouch", async (c) => {
    const parsed = VouchRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ code: "invalid_body" }, 400);
    const b = parsed.data;

    const result = await submitVouch(
      {
        from: b.from as Address, to: b.to as Address, tags: b.tags,
        expiresAt: BigInt(b.expiresAt), sig: b.sig as Hex,
      },
      deps,
    );
    if (!result.ok) return c.json(result.failure, result.failure.httpStatus);

    await deps.onChanged();
    return c.json({ txHash: result.value.txHash });
  });

  r.post("/vouch/revoke", async (c) => {
    const parsed = RevokeRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ code: "invalid_body" }, 400);
    const b = parsed.data;

    const result = await revokeVouch(
      {
        from: b.from as Address, to: b.to as Address,
        expiresAt: BigInt(b.expiresAt), sig: b.sig as Hex,
      },
      deps,
    );
    if (!result.ok) return c.json(result.failure, result.failure.httpStatus);

    await deps.onChanged();
    return c.json({ txHash: result.value.txHash });
  });

  return r;
}
