import type { Address, Hex } from "viem";
import { JENDELA_HADIR_MS } from "./radar-gate";
import { kecocokanDari } from "./meet-rank";
import type { RadarDeps } from "./ports";

/** Paling banyak lima notifikasi per orang per acara (spec 4b+5 §6.3). */
export const BATAS_NOTIF_KEDEKATAN = 5;

export type HubunganKedekatan = "saling_ingin_bertemu" | "pernah_bertemu";

/**
 * Spec 4b+5 §6.4, bahasa Inggris sejak spec desain UI §7.4. Tidak pernah
 * alamat, judul atau lokasi acara, maupun sel.
 */
export function teksNotifKedekatan(hubungan: HubunganKedekatan, displayName: string): string {
  const nama = displayName.trim();
  if (hubungan === "saling_ingin_bertemu") {
    return nama
      ? `${nama} is at this event. You both want to meet.`
      : "Someone you both want to meet is at this event.";
  }
  return nama
    ? `${nama}, who you've met, is at this event.`
    : "Someone you've met is at this event.";
}

type DepsNotif = Pick<RadarDeps, "radar" | "profilSaya" | "blokir" | "meet" | "pesan" | "push" | "nowMs">;

/** Satu arah: `penerima` diberi tahu tentang `subjek`. Kegagalannya tidak menghentikan arah lain. */
async function kirimSatuArah(
  deps: DepsNotif & { push: NonNullable<RadarDeps["push"]> },
  a: { eventId: Hex; penerima: Address; subjek: Address; namaSubjek: string; hubungan: HubunganKedekatan },
): Promise<void> {
  try {
    if (await deps.radar.hitungNotifKedekatan(a.eventId, a.penerima) >= BATAS_NOTIF_KEDEKATAN) return;
    // Kirim HANYA bila baris benar-benar tersisip: sekali per pasangan per acara.
    if (!(await deps.radar.sisipNotifKedekatan(a.eventId, a.penerima, a.subjek))) return;

    const tokens = await deps.pesan.tokenPush(a.penerima);
    if (tokens.length === 0) return;
    const { tokenMati } = await deps.push.kirim({
      tokens,
      judul: "Nearly",
      badan: teksNotifKedekatan(a.hubungan, a.namaSubjek),
      data: { jenis: "radar", eventId: a.eventId },
    });
    if (tokenMati.length > 0) await deps.pesan.hapusTokenPush(tokenMati);
  } catch (e) {
    console.error("notifikasi kedekatan gagal:", e instanceof Error ? e.message : e);
  }
}

/**
 * Dipanggil TANPA await oleh rute detak saat `subjek` berpindah dari tidak
 * hadir ke hadir (spec 4b+5 §6.1). Dijamin tidak pernah melempar — pola
 * `kirimPushPesan`; detak tetap 200 apa pun yang terjadi di sini.
 *
 * Penerima (§6.2): hadir sekarang dan terlihat, bukan subjek, tanpa blokir dua
 * arah, dan pernah bertemu ATAU saling ingin bertemu. Tanda SEPIHAK tidak
 * cukup — itu vektor penguntitan. Dikirim ke DUA arah, berurutan.
 */
export async function kirimNotifKedekatan(
  deps: DepsNotif, a: { eventId: Hex; subjek: Address },
): Promise<void> {
  const push = deps.push;
  if (!push) return;
  try {
    const eventId = a.eventId.toLowerCase() as Hex;
    const subjek = a.subjek.toLowerCase() as Address;
    const now = deps.nowMs();

    const hadir = (await deps.radar.hadirSejak(eventId, now - JENDELA_HADIR_MS))
      .map((x) => x.toLowerCase() as Address)
      .filter((x) => x !== subjek);
    if (hadir.length === 0) return;

    const [visibilitas, terblokir] = await Promise.all([
      deps.profilSaya.visibilitasBanyak([subjek, ...hadir]),
      deps.blokir.himpunanUntuk(subjek),
    ]);
    // Subjek yang sudah pindah ke Tersembunyi sejak detaknya tidak memicu apa pun.
    if (visibilitas.get(subjek) !== "terlihat") return;
    const kandidat = hadir.filter((x) => visibilitas.get(x) === "terlihat" && !terblokir.has(x));
    if (kandidat.length === 0) return;

    const kecuali = [...terblokir];
    const [koneksi, oleh, ke] = await Promise.all([
      deps.radar.terhubungDengan(subjek, kandidat),
      deps.meet.tandaOleh(subjek, kecuali),
      deps.meet.tandaKe(subjek, kecuali),
    ]);
    const saling = new Set(kecocokanDari(oleh, ke).map((k) => k.address.toLowerCase()));
    const penerima = kandidat.filter((x) => saling.has(x) || koneksi.has(x));
    if (penerima.length === 0) return;

    const profil = await deps.meet.profilRingkas([subjek, ...penerima]);
    const nama = (x: string) => profil.get(x)?.displayName ?? "";
    const depsPush = { ...deps, push };

    for (const r of penerima) {
      // Saling ingin bertemu mengalahkan pernah bertemu (§6.4).
      const hubungan: HubunganKedekatan = saling.has(r) ? "saling_ingin_bertemu" : "pernah_bertemu";
      await kirimSatuArah(depsPush, { eventId, penerima: r, subjek, namaSubjek: nama(subjek), hubungan });
      await kirimSatuArah(depsPush, { eventId, penerima: subjek, subjek: r, namaSubjek: nama(r), hubungan });
    }
  } catch (e) {
    console.error("notifikasi kedekatan gagal:", e instanceof Error ? e.message : e);
  }
}
