import { Hono } from "hono";
import { handshakeRoutes } from "./routes/handshake";
import { profileRoutes } from "./routes/profile";
import { trustRoutes } from "./routes/trust";
import { vouchRoutes } from "./routes/vouch";
import { reportRoutes } from "./routes/report";
import { adminRoutes } from "./routes/admin";
import { recomputeTrust } from "./trust/recompute";
import type { GateDeps, TrustStore, VouchStore, ReportStore, AttestorPort, VouchChainPort } from "./ports";
import type { Address } from "viem";

export type TrustDeps = GateDeps & {
  trust: TrustStore;
  vouches: VouchStore;
  reports: ReportStore;
  attestor: AttestorPort;
  vouchChain: VouchChainPort;
  vouchContract: Address;
  adminToken: string;
};

export function createApp(deps: TrustDeps) {
  const app = new Hono();
  app.get("/health", (c) => c.json({ ok: true }));

  const onChanged = async () => {
    try {
      await recomputeTrust({ trust: deps.trust, attestor: deps.attestor, nowMs: deps.nowMs });
    } catch (e) {
      // Perhitungan ulang yang gagal TIDAK boleh menggagalkan handshake atau
      // vouch yang sudah tercetak on-chain. Skor akan menyusul pada pemicu
      // berikutnya; koneksinya sendiri sudah permanen.
      console.error("recompute gagal:", e);
    }
  };

  app.route("/", handshakeRoutes({ ...deps, onChanged }));
  app.route("/", profileRoutes(deps));
  app.route("/", trustRoutes(deps));
  app.route("/", vouchRoutes({ ...deps, onChanged }));
  app.route("/", reportRoutes(deps));
  app.route("/", adminRoutes({ ...deps, onChanged }));
  return app;
}
