import { Hono } from "hono";
import { isAddress, type Address, type Hex } from "viem";
import { BlokirRequestSchema, recoverLihatBlokirSigner } from "@nearly/shared";
import { daftarBlokir, setBlokir } from "../blokir-gate";
import type { BlokirDeps } from "../ports";
import { pulihkanTandaTangan } from "../pulihkan-tanda-tangan";

/**
 * Mengembalikan alamat pemanggil HANYA kalau `who`, `expiresAt`, dan `sig`
 * lengkap, belum kedaluwarsa, dan tanda tangan LihatBlokir-nya memang milik
 * `who`. Selain itu null.
 *
 * `recoverLihatBlokirSigner` dan TIDAK PERNAH yang lain. `LihatKecocokan` dan
 * `TandaiDilihat` berbentuk field identik `{ who, expiresAt }`; kalau salah
 * satunya diterima di sini, tanda tangan yang bocor dari layar kecocokan
 * membuka daftar blokir orang lain. Kelas kesalahan Ruling 23.
 */
async function pemanggilTerbukti(
  q: Record<string, string>, deps: BlokirDeps,
): Promise<Address | null> {
  const { who, expiresAt, sig } = q;
  if (!who || !expiresAt || !sig) return null;
  if (!isAddress(who)) return null;
  if (!/^\d+$/.test(expiresAt)) return null;
  if (deps.nowMs() > Number(expiresAt) * 1000) return null;

  const signer = await pulihkanTandaTangan(() => recoverLihatBlokirSigner(
    { who: who as Address, expiresAt: BigInt(expiresAt) },
    sig as Hex,
    deps.verifyingContract,
  ));
  if (signer === null || signer.toLowerCase() !== who.toLowerCase()) return null;
  return who.toLowerCase() as Address;
}

export function blokirRoutes(deps: BlokirDeps) {
  const r = new Hono();

  r.post("/blokir", async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = BlokirRequestSchema.safeParse(raw);
    if (!parsed.success) return c.json({ code: "invalid_body" }, 400);

    const b = parsed.data;
    const hasil = await setBlokir({
      target: b.target as Address, who: b.who as Address, blokir: b.blokir,
      expiresAt: BigInt(b.expiresAt), sig: b.sig as Hex,
    }, deps);
    if (!hasil.ok) return c.json(hasil.failure, hasil.failure.httpStatus);
    return c.json({ ok: true });
  });

  r.get("/blokir", async (c) => {
    const pemanggil = await pemanggilTerbukti(c.req.query(), deps);
    // 403, BUKAN daftar kosong. Daftar kosong tidak bisa dibedakan dari "kamu
    // tidak memblokir siapa pun", jadi otorisasi yang rusak akan terlihat
    // seperti keadaan normal.
    if (!pemanggil) return c.json({ code: "butuh_bukti" }, 403);
    return c.json(await daftarBlokir(pemanggil, deps));
  });

  return r;
}
