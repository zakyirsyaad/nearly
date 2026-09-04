import { Hono } from "hono";
import { isAddress, type Address } from "viem";
import { confirmSlash, type SlashDeps } from "../vouch-gate";

export function adminRoutes(
  deps: SlashDeps & { adminToken: string; onChanged: () => Promise<void> },
) {
  const r = new Hono();

  r.post("/admin/slash/:address", async (c) => {
    // Token dibandingkan lengkap, dan header yang hilang tidak boleh cocok
    // dengan token kosong.
    const token = c.req.header("x-admin-token") ?? "";
    if (deps.adminToken.length === 0 || token !== deps.adminToken) {
      return c.json({ code: "unauthorized" }, 401);
    }

    const raw = c.req.param("address");
    if (!isAddress(raw)) return c.json({ code: "invalid_address" }, 400);

    const result = await confirmSlash(raw.toLowerCase() as Address, deps);
    if (!result.ok) return c.json(result.failure, result.failure.httpStatus);

    await deps.onChanged();
    return c.json({ txHash: result.value.txHash });
  });

  return r;
}
