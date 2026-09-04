import { Hono } from "hono";
import type { Address } from "viem";
import { ReportRequestSchema } from "@nearly/shared";
import type { ReportStore } from "../ports";

export function reportRoutes(deps: { reports: ReportStore }) {
  const r = new Hono();

  r.post("/report", async (c) => {
    const parsed = ReportRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ code: "invalid_body" }, 400);
    const b = parsed.data;

    await deps.reports.recordReport({
      reporter: b.reporter as Address,
      subject: b.subject as Address,
      reason: b.reason,
      evidence: b.evidence,
    });

    // TIDAK ada perhitungan ulang trust di sini, dengan sengaja. Laporan tidak
    // pernah menurunkan trust — ia hanya memicu peninjauan (spec fase §6).
    return c.json({ ok: true, status: "diterima" });
  });

  return r;
}
