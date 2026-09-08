import { Hono } from "hono";
import { isAddress, type Address, type Hex } from "viem";
import {
  InginBertemuRequestSchema, recoverLihatKecocokanSigner, TandaiDilihatRequestSchema,
} from "@nearly/shared";
import { daftarKecocokan, setTanda, tandaiDilihat } from "../meet-gate";
import type { MeetDeps } from "../ports";
import { pulihkanTandaTangan } from "../pulihkan-tanda-tangan";

/**
 * Mengembalikan alamat pemanggil HANYA kalau `who`, `expiresAt`, dan `sig`
 * lengkap, belum kedaluwarsa, dan tanda tangan LihatKecocokan-nya memang
 * milik `who`. Selain itu null.
 *
 * Tipe LihatKecocokan, BUKAN TandaiDilihat: bentuk fieldnya IDENTIK
 * ({who, expiresAt}), tapi POST /kecocokan/dilihat menerima TandaiDilihat
 * sebagai perintah TULIS. Kalau bukti baca ini memakai tipe yang sama, tanda
 * tangan yang bocor lewat query string — log akses, proxy, siapa pun yang
 * membaca URL dalam masa berlakunya — bisa diputar ulang untuk menghapus
 * lencana kecocokan orang itu, menyembunyikan dari mereka bahwa seseorang
 * baru saja saling menandai. Kelas kesalahan Ruling 23.
 */
async function pemanggilTerbukti(
  q: Record<string, string>, deps: MeetDeps,
): Promise<Address | null> {
  const { who, expiresAt, sig } = q;
  if (!who || !expiresAt || !sig) return null;
  if (!isAddress(who)) return null;
  if (!/^\d+$/.test(expiresAt)) return null;
  if (deps.nowMs() > Number(expiresAt) * 1000) return null;

  // Lewat pulihkanTandaTangan: tanda tangan yang cacat bentuknya membuat viem
  // melempar. Itu tetap "tidak terbukti", bukan 500.
  const signer = await pulihkanTandaTangan(() => recoverLihatKecocokanSigner(
      { who: who as Address, expiresAt: BigInt(expiresAt) },
    sig as Hex,
    deps.verifyingContract,
  ));
  if (signer === null || signer.toLowerCase() !== who.toLowerCase()) return null;
  return who.toLowerCase() as Address;
}

export function meetRoutes(deps: MeetDeps) {
  const r = new Hono();

  r.post("/ingin-bertemu", async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = InginBertemuRequestSchema.safeParse(raw);
    if (!parsed.success) return c.json({ code: "invalid_body" }, 400);

    const b = parsed.data;
    const hasil = await setTanda({
      target: b.target as Address, who: b.who as Address, ingin: b.ingin,
      expiresAt: BigInt(b.expiresAt), sig: b.sig as Hex,
    }, deps);
    if (!hasil.ok) return c.json(hasil.failure, hasil.failure.httpStatus);
    return c.json({ ok: true });
  });

  /**
   * MENOLAK 403 tanpa bukti sah (spec §6.2), bukan mengembalikan daftar
   * kosong. Rute ini mengembalikan identitas orang lain — daftar kosong dan
   * "kamu tidak berhak" adalah dua hal berbeda, dan klien perlu
   * membedakannya. Kalau disamakan, orang yang tanda tangannya kedaluwarsa
   * akan disuguhi layar "belum ada kecocokan" yang berbohong.
   *
   * Ini sengaja BERBEDA dari GET /profile/:address, yang tanda tangan
   * cacatnya bukan galat — profil harus tetap terbuka untuk orang asing.
   */
  r.get("/kecocokan", async (c) => {
    const who = await pemanggilTerbukti(c.req.query(), deps);
    if (!who) return c.json({ code: "butuh_bukti" }, 403);

    const hasil = await daftarKecocokan(who, deps);
    return c.json(hasil);
  });

  r.post("/kecocokan/dilihat", async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = TandaiDilihatRequestSchema.safeParse(raw);
    if (!parsed.success) return c.json({ code: "invalid_body" }, 400);

    const b = parsed.data;
    const hasil = await tandaiDilihat({
      who: b.who as Address, expiresAt: BigInt(b.expiresAt), sig: b.sig as Hex,
    }, deps);
    if (!hasil.ok) return c.json(hasil.failure, hasil.failure.httpStatus);
    return c.json({ ok: true });
  });

  return r;
}
