import type { Address } from "viem";
import type { PesanDeps } from "./ports";

/**
 * Spec 4c §7.2, bahasa Inggris sejak spec desain UI §7.4. Tidak pernah alamat,
 * tidak pernah isi pesan.
 */
export function teksPush(displayName: string): string {
  const nama = displayName.trim();
  return nama ? `New message from ${nama}` : "New message from a connection";
}

/**
 * Dipanggil TANPA await setelah pesan tersimpan (pola prosesUnggahGambar).
 * Dijamin tidak pernah melempar: push yang gagal dicatat, dan pengiriman pesan
 * tetap berhasil (spec 4c §7.1) — polling adalah fondasinya, push tambahan.
 */
export async function kirimPushPesan(
  deps: Pick<PesanDeps, "pesan" | "push" | "meet">,
  baris: { id: string; pengirim: Address; penerima: Address },
): Promise<void> {
  if (!deps.push) return;
  try {
    // Satu notifikasi per rentetan: kalau penerima masih punya pesan belum
    // dibaca lain dari pengirim ini, ia sudah pernah diberi tahu.
    if (await deps.pesan.adaBelumDibacaLainDari(baris.penerima, baris.pengirim, baris.id)) return;

    const tokens = await deps.pesan.tokenPush(baris.penerima);
    if (tokens.length === 0) return;

    const profil = await deps.meet.profilRingkas([baris.pengirim]);
    const nama = profil.get(baris.pengirim.toLowerCase())?.displayName ?? "";

    const { tokenMati } = await deps.push.kirim({
      tokens, judul: "Nearly", badan: teksPush(nama), data: { jenis: "pesan" },
    });
    if (tokenMati.length > 0) await deps.pesan.hapusTokenPush(tokenMati);
  } catch (e) {
    console.error("push pesan gagal:", e instanceof Error ? e.message : e);
  }
}
