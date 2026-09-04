import { Hono } from "hono";
import { isAddress, type Address } from "viem";
import { TIER_LABELS } from "@nearly/trust";
import type { TrustStore } from "../ports";

const KOSONG = { connections: 0, occasions: 0, regions: 0, vouches: 0 };

export function trustRoutes(deps: { trust: Pick<TrustStore, "getSnapshot"> }) {
  const r = new Hono();

  r.get("/trust/:address", async (c) => {
    const raw = c.req.param("address");
    if (!isAddress(raw)) return c.json({ code: "invalid_address" }, 400);

    const snap = await deps.trust.getSnapshot(raw.toLowerCase() as Address);
    const tier = snap?.tier ?? 0;

    // Sengaja TIDAK mengirim score, ratio, atau operatorCluster.
    // Spec induk §8: tier + bukti, bukan angka telanjang — angka peringkat
    // telanjang menghidupkan lagi kecemasan ala Nosedive.
    return c.json({
      address: raw.toLowerCase(),
      tier,
      tierLabel: TIER_LABELS[tier],
      evidence: snap?.evidence ?? KOSONG,
    });
  });

  return r;
}
