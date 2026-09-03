import { Hono } from "hono";
import { handshakeRoutes } from "./routes/handshake.js";
import { profileRoutes } from "./routes/profile.js";
import type { GateDeps } from "./ports.js";

export function createApp(deps: GateDeps) {
  const app = new Hono();
  app.get("/health", (c) => c.json({ ok: true }));
  app.route("/", handshakeRoutes(deps));
  app.route("/", profileRoutes(deps));
  return app;
}
