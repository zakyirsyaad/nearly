import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { depsFor } from "./support/deps";

const ORIGIN = "https://nearly.vercel.app";
const A = "0x000000000000000000000000000000000000000a";

function headerCors(res: Response): string[] {
  return [...res.headers.keys()].filter((k) => k.toLowerCase().startsWith("access-control-"));
}

describe("perakitan graf di createApp", () => {
  it("rute graf terpasang dan mendapat CORS untuk origin terdaftar", async () => {
    const app = createApp({ ...depsFor(), webOrigins: [ORIGIN] });
    const res = await app.request("/graf/jaringan", { headers: { Origin: ORIGIN } });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
  });

  it("rute non-graf tidak pernah mendapat header CORS, walau origin terdaftar", async () => {
    const app = createApp({ ...depsFor(), webOrigins: [ORIGIN] });
    const permintaan: [string, RequestInit][] = [
      ["/health", {}],
      [`/trust/${A}`, {}],
      ["/handshake/offer", { method: "POST", body: "{}", headers: { "content-type": "application/json" } }],
      ["/blokir", { method: "OPTIONS" }],
    ];
    for (const [jalur, init] of permintaan) {
      const headers = { ...(init.headers as Record<string, string> | undefined), Origin: ORIGIN };
      const res = await app.request(jalur, { ...init, headers });
      expect(headerCors(res), jalur).toEqual([]);
    }
  });
});

describe("index.ts (spec 6 §4.6, §4.7)", () => {
  const src = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");

  it("memakai bacaPort, bukan 8787 yang ditulis mati", () => {
    expect(src).toContain("bacaPort(process.env.PORT)");
    expect(src).not.toMatch(/port:\s*8787/);
  });

  it("meneruskan WEB_ORIGINS dan store graf ke createApp", () => {
    expect(src).toContain("bacaWebOrigins(process.env.WEB_ORIGINS)");
    expect(src).toContain("graf: createGrafStore(supabase)");
  });
});
