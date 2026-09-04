import { Hono } from "hono";
import { handshakeRoutes } from "./routes/handshake";
import { profileRoutes } from "./routes/profile";
import type { GateDeps } from "./ports";

export function createApp(deps: GateDeps) {
  const app = new Hono();
  app.get("/health", (c) => c.json({ ok: true }));
  app.route("/", handshakeRoutes(deps));
  app.route("/", profileRoutes(deps));
  return app;
}
