import { Hono } from "hono";
import type { Address, Hex } from "viem";
import { reasonHashOf, recoverReportSigner, ReportRequestSchema } from "@nearly/shared";
import type { ReportStore } from "../ports";

export function reportRoutes(
  deps: { reports: ReportStore; vouchContract: Address; nowMs: () => number },
) {
  const r = new Hono();

  r.post("/report", async (c) => {
    const parsed = ReportRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ code: "invalid_body" }, 400);
    const b = parsed.data;

    const expiresAt = BigInt(b.expiresAt);
    // Tanpa tanda tangan ini, `reporter` datang telanjang dari body — siapa
    // pun bisa mengaku sebagai tiga pelapor ber-trust tinggi yang saling asing
    // dan menembus gerbang anti-brigading (spec fase §6). Laporan sendiri
    // TETAP off-chain; tanda tangan ini murni untuk otentikasi ke server.
    if (deps.nowMs() > Number(expiresAt) * 1000) return c.json({ code: "expired" }, 410);

    const signer = await recoverReportSigner(
      {
        reporter: b.reporter as Address,
        subject: b.subject as Address,
        reasonHash: reasonHashOf(b.reason),
        expiresAt,
      },
      b.sig as Hex,
      deps.vouchContract,
    );
    if (signer.toLowerCase() !== b.reporter.toLowerCase()) {
      return c.json({ code: "bad_signature" }, 401);
    }

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
