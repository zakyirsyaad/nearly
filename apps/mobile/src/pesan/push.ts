import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import type { SesiPesan } from "./sesi";
import { postTokenPush } from "./pesan-api";

/**
 * Kanal Android untuk semua notifikasi Nearly (spec distribusi §4.2, D12).
 * API mengirim tanpa channelId dan Expo mengantarnya ke kanal "default", jadi id
 * ini TIDAK boleh diganti tanpa mengubah API. Nama tampil di Pengaturan Android.
 */
export const KANAL_ANDROID = "default";
export const NAMA_KANAL_ANDROID = "Messages and Radar";

let sudahDicoba = false;

/**
 * Best-effort (spec 4c §7.1, §11.6): izin diminta saat layar pesan pertama
 * kali dibuka, token didaftarkan bila didapat. Semua kegagalan ditelan dengan
 * sengaja — push tidak jalan di Expo Go SDK 57 dan butuh build EAS (spec distribusi D5), dan polling tetap
 * mengantar pesan. Galat push TIDAK PERNAH ditampilkan ke pengguna.
 *
 * Dicoba sekali per kali buka aplikasi, supaya penolakan izin tidak ditanyakan
 * ulang setiap layar difokuskan.
 */
export async function daftarkanPush(sesi: SesiPesan): Promise<void> {
  if (sudahDicoba) return;
  sudahDicoba = true;
  try {
    // Android 13 hanya menampilkan dialog izin bila aplikasi sudah punya kanal.
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(KANAL_ANDROID, {
        name: NAMA_KANAL_ANDROID,
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

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

/**
 * Dipanggil saat dompet dihapus dari HP (Ganti dompet): dompet berikutnya
 * mencoba mendaftarkan token push lagi pada layar Pesan atau Radar berikutnya.
 */
export function lupakanPendaftaranPush(): void {
  sudahDicoba = false;
}
