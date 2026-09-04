/**
 * Mengambil offer tertunda terbaru dari database dan mencetaknya sebagai isi QR.
 *
 * Gunanya: menghapus keharusan menyalin QR dari layar HP. Offer sudah dikirim
 * HP ke server saat layar QR dibuka, jadi datanya memang sudah ada di sini.
 *
 *   tsx tools/peer.ts --qr "$(tsx tools/latest-offer.ts)" --at bandung
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import type { Address, Hex } from "viem";
import { encodeQr, isQrExpired } from "@nearly/shared";
import { createSupabase } from "../src/db";

function need(n: string, v: string | undefined) {
  if (!v) throw new Error(`${n} wajib diisi`);
  return v;
}

async function main() {
  const db = createSupabase(
    need("SUPABASE_URL", process.env.SUPABASE_URL),
    need("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY),
  );

  const { data, error } = await db
    .from("handshake_offers")
    .select("nonce, initiator, expires_at, sig_offer, cell, created_at")
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`baca offer gagal: ${error.message}`);
  if (!data) throw new Error("Belum ada offer tertunda. Buka layar 'Tampilkan QR-ku' di HP dulu.");

  const payload = {
    v: 1 as const,
    initiator: data.initiator as Address,
    nonce: data.nonce as Hex,
    expiresAt: BigInt(data.expires_at as string),
    sigOffer: data.sig_offer as Hex,
  };

  if (isQrExpired(payload, Date.now())) {
    throw new Error("Offer terbaru sudah kedaluwarsa. Pastikan layar QR di HP masih terbuka.");
  }

  console.error(`A   : ${payload.initiator}\nlok : ${data.cell}  (dari GPS HP)\n`);
  console.log(encodeQr(payload)); // stdout = isi QR saja
}

main().catch((e) => {
  console.error(`GAGAL: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
