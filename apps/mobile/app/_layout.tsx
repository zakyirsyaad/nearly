import "../src/polyfills"; // WAJIB baris pertama — lihat catatan di polyfills.ts
import { useEffect } from "react";
import { Stack, router } from "expo-router";
import * as Notifications from "expo-notifications";
import { ruteDariNotifikasi } from "../src/pesan/rute-push";
import { JUDUL_LAYAR } from "../src/judul-layar";

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

  // Judul semua layar dari JUDUL_LAYAR — alasannya di src/judul-layar.ts.
  return (
    <Stack screenOptions={{ headerTitleStyle: { fontWeight: "600" } }}>
      {Object.entries(JUDUL_LAYAR).map(([name, title]) => (
        <Stack.Screen key={name} name={name} options={{ title }} />
      ))}
    </Stack>
  );
}
