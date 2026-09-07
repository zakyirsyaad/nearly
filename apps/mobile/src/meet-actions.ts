import type { Address } from "viem";
import { inginBertemuTypedData } from "@nearly/shared";
import { CONFIG } from "./config";
import { postJson } from "./http";
import type { PenandaSigner } from "./meet-api";

type Pengirim = (body: unknown) => Promise<{ ok: true }>;

const kirimBawaan: Pengirim = (body) => postJson<{ ok: true }>("/ingin-bertemu", body);

/**
 * Logika di balik tombol "Ingin bertemu", dipisahkan dari layar supaya bisa
 * diuji tanpa merender apa pun.
 *
 * SATU-SATUNYA tempat `InginBertemu` ditandatangani. Tiga layar (kartu feed,
 * layar profil, dan — lewat layar profil — tautan dari kartu feed) memanggil
 * fungsi ini, tidak ada yang membangun typed data-nya sendiri. Kalau
 * penandatanganan digandakan, satu tempat bisa berubah nanti tanpa yang lain
 * ikut berubah, diam-diam.
 *
 * `ingin` yang dikirim adalah KEBALIKAN keadaan sekarang, dan nilainya ikut
 * ditandatangani — mencabut adalah satu-satunya cara menutup pintu
 * pengungkapan (spec §2.1), jadi ia tidak boleh bisa dipalsukan.
 */
export async function aksiTanda(
  signer: PenandaSigner,
  target: Address,
  sedangDitandai: boolean,
  kirim: Pengirim = kirimBawaan,
): Promise<void> {
  const ingin = !sedangDitandai;
  const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 300);
  const sig = await signer.signTypedData(inginBertemuTypedData(
    { target, who: signer.address, ingin, expiresAt }, CONFIG.verifyingContract,
  ) as never);

  await kirim({
    target, who: signer.address, ingin, expiresAt: expiresAt.toString(), sig,
  });
}
