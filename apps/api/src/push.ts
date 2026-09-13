import type { PushPort } from "./ports";
import { potongKelompok } from "./feed-store";

export const URL_PUSH_EXPO = "https://exp.host/--/api/v2/push/send";
/** Expo Push API menerima paling banyak 100 pesan per permintaan. */
export const MAKS_PUSH_PER_PERMINTAAN = 100;

type Tiket = { status?: string; details?: { error?: string } };

/**
 * Implementasi PushPort lewat layanan push Expo. Expo dan Apple melihat isi
 * notifikasi — itulah sebabnya isinya diputuskan di pesan-push.ts dan tidak
 * pernah memuat isi pesan atau alamat (spec 4c §7.2, §11.5).
 */
export function createExpoPush(fetchFn: typeof fetch = fetch): PushPort {
  return {
    async kirim({ tokens, judul, badan, data }) {
      const tokenMati: string[] = [];
      for (const bagian of potongKelompok(tokens, MAKS_PUSH_PER_PERMINTAAN)) {
        const res = await fetchFn(URL_PUSH_EXPO, {
          method: "POST",
          headers: { accept: "application/json", "content-type": "application/json" },
          body: JSON.stringify(bagian.map((to) => ({ to, title: judul, body: badan, data, sound: "default" }))),
        });
        if (!res.ok) throw new Error(`push Expo gagal: HTTP ${res.status}`);
        const tiket = ((await res.json()) as { data?: Tiket[] }).data ?? [];
        bagian.forEach((token, i) => {
          if (tiket[i]?.status === "error" && tiket[i]?.details?.error === "DeviceNotRegistered") {
            tokenMati.push(token);
          }
        });
      }
      return { tokenMati };
    },
  };
}
