import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { Address, Hex } from "viem";
import { AturProfilRequestSchema } from "@nearly/shared";
import { bacaRequestSesi } from "../baca-request-sesi";
import { pemanggilPesan } from "../pesan-auth";
import type { ProfilDeps } from "../ports";
import { ambilProfilSaya, aturProfil } from "../profil-gate";

export function profilRoutes(deps: ProfilDeps) {
  const r = new Hono();

  // Tanpa header sesi: identitas dibuktikan tanda tangan EIP-712 `AturProfil`
  // dompet (R2), sama seperti POST /blokir.
  r.post(
    "/profil",
    bodyLimit({ maxSize: 4 * 1024, onError: (c) => c.json({ code: "terlalu_besar" }, 413) }),
    async (c) => {
      const parsed = AturProfilRequestSchema.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) return c.json({ code: "invalid_body" }, 400);
      const b = parsed.data;
      const hasil = await aturProfil({
        who: b.who as Address, displayName: b.displayName, visibilitas: b.visibilitas,
        expiresAt: BigInt(b.expiresAt), sig: b.sig as Hex,
      }, deps);
      if (!hasil.ok) return c.json(hasil.failure, hasil.failure.httpStatus);
      return c.json({ ok: true });
    },
  );

  // Tidak ada cara membaca visibilitas orang lain (spec 4b+5 §7.3).
  r.get("/profil/saya", async (c) => {
    const pemanggil = await pemanggilPesan(await bacaRequestSesi(c), deps);
    if (!pemanggil) return c.json({ code: "butuh_autentikasi" }, 401);
    return c.json(await ambilProfilSaya(pemanggil, deps));
  });

  return r;
}
