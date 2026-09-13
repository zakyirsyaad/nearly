import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import type { SesiPesan } from "./sesi";
import { postTokenPush } from "./pesan-api";

let sudahDicoba = false;

/**
 * Best-effort (spec 4c §7.1, §11.6): izin diminta saat layar pesan pertama
 * kali dibuka, token didaftarkan bila didapat. Semua kegagalan ditelan dengan
 * sengaja — push belum tentu jalan di Expo Go SDK 57, dan polling tetap
 * mengantar pesan. Galat push TIDAK PERNAH ditampilkan ke pengguna.
 *
 * Dicoba sekali per kali buka aplikasi, supaya penolakan izin tidak ditanyakan
 * ulang setiap layar difokuskan.
 */
export async function daftarkanPush(sesi: SesiPesan): Promise<void> {
  if (sudahDicoba) return;
  sudahDicoba = true;
  try {
    let izin = await Notifications.getPermissionsAsync();
    if (!izin.granted) izin = await Notifications.requestPermissionsAsync();
    if (!izin.granted) return;

    const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
    const projectId = extra?.eas?.projectId;
    if (!projectId) return;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await postTokenPush(sesi, token);
  } catch (e) {
    if (__DEV__) console.warn("push tidak tersedia:", e instanceof Error ? e.message : e);
  }
}
