import "../src/polyfills"; // WAJIB baris pertama — lihat catatan di polyfills.ts
import { useEffect } from "react";
import { Stack, router } from "expo-router";
import * as Notifications from "expo-notifications";
import { ruteDariNotifikasi } from "../src/pesan/rute-push";

// Notifikasi yang tiba saat aplikasi terbuka tetap ditampilkan sebagai banner.
// Sesuaikan nama medan dengan NotificationBehavior versi terpasang (Step 1).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  useEffect(() => {
    const langganan = Notifications.addNotificationResponseReceivedListener((r) => {
      const rute = ruteDariNotifikasi(r.notification.request.content.data);
      if (rute) router.push(rute);
    });
    return () => langganan.remove();
  }, []);

  // Judul didaftarkan di sini, bukan lewat <Stack.Screen> di dalam layar:
  // yang di dalam layar baru berlaku setelah layar selesai memuat, jadi selama
  // spinner tampil header (dan tombol kembali layar berikutnya) memakai nama
  // rute mentah seperti "pesan/index".
  return (
    <Stack screenOptions={{ headerTitleStyle: { fontWeight: "600" } }}>
      <Stack.Screen name="pesan/index" options={{ title: "Pesan" }} />
      <Stack.Screen name="pesan/[address]" options={{ title: "Percakapan" }} />
      <Stack.Screen name="pesan/lapor/[address]" options={{ title: "Lapor" }} />
    </Stack>
  );
}
