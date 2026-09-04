import { describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";
import { tagsHashOf, vouchTypedData } from "@nearly/shared";
import { createApp } from "../src/app";
import { A, B, CONTRACT, NOW, depsFor } from "./support/deps";

// PK Anvil default #0, sama seperti trust.route.test.ts — hanya penanda tanda
// tangan asli, alamatnya tidak penting untuk test ini.
const PK = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as Hex;
const account = privateKeyToAccount(PK);

async function signedVouchBody() {
  const expiresAt = BigInt(Math.floor(NOW / 1000) + 3600);
  const tags = ["zk"];
  const msg = { from: account.address, to: B, tagsHash: tagsHashOf(tags), expiresAt };
  return {
    from: account.address,
    to: B,
    tags,
    expiresAt: String(Math.floor(NOW / 1000) + 3600),
    sig: await account.signTypedData(vouchTypedData(msg, CONTRACT)),
  };
}

function post(app: ReturnType<typeof createApp>, path: string, body: unknown) {
  return app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Task 8: onChanged diserialisasi", () => {
  it("GERBANG: dua panggilan onChanged() yang tumpang tindih hanya memicu SATU loadGraph", async () => {
    // loadGraph SENGAJA ditahan (tidak resolve) sampai kita membuka
    // gerbangnya secara manual, supaya request kedua BENAR-BENAR tumpang
    // tindih dengan yang pertama, bukan sekadar berurutan cepat.
    let bukaGerbang!: () => void;
    const gerbang = new Promise<void>((resolve) => { bukaGerbang = resolve; });
    const loadGraph = vi.fn(async () => {
      await gerbang;
      return {
        edges: [], vouches: [], seeds: [{ address: A, weight: 1 }], slashed: [], nowMs: NOW,
      };
    });

    const app = createApp(depsFor({ trust: { loadGraph } }));

    const body = await signedVouchBody();
    const p1 = post(app, "/vouch", body);
    const p2 = post(app, "/vouch", body);

    bukaGerbang();
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    // Dua permintaan /vouch yang tumpang tindih -> dua panggilan onChanged()
    // -> tapi HANYA SATU yang benar-benar menjalankan recomputeTrust (yang
    // kedua bergabung ke promise yang sama). Tanpa Task 8, ini akan jadi 2.
    expect(loadGraph).toHaveBeenCalledTimes(1);
  });
});
