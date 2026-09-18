import "../src/polyfills"; // WAJIB baris pertama — lihat catatan di polyfills.ts
import { useEffect } from "react";
import { Stack, router } from "expo-router";
import { ActivityIndicator, Button, StyleSheet, Text, View } from "react-native";
import * as Notifications from "expo-notifications";
import { ruteDariNotifikasi } from "../src/pesan/rute-push";
import { layarMenurutDompet } from "../src/judul-layar";
import { DompetProvider, useDompet } from "../src/dompet/konteks-dompet";
import { pesanGalatDompet } from "../src/dompet/teks-dompet";

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
  return (
    <DompetProvider>
      <Navigasi />
    </DompetProvider>
  );
}

/**
 * Gerbang dompet (spec dompet §5.1). Tanpa dompet hanya layar Mulai yang ada;
 * dengan dompet, Mulai tidak bisa dibuka. Saat penjaga berubah — dompet baru
 * dibuat, atau dompet dihapus lewat Ganti dompet — expo-router memindahkan
 * tumpukan ke layar pertama yang diizinkan.
 */
function Navigasi() {
  const { keadaan, galat, muatUlang } = useDompet();

  useEffect(() => {
    // Rute tujuan notifikasi hanya ada saat dompet siap.
    if (keadaan !== "siap") return;
    const langganan = Notifications.addNotificationResponseReceivedListener((r) => {
      const rute = ruteDariNotifikasi(r.notification.request.content.data);
      if (rute) router.push(rute);
    });
    return () => langganan.remove();
  }, [keadaan]);

  if (keadaan === "memuat") {
    return <View style={s.tengah}><ActivityIndicator /></View>;
  }

  if (keadaan === "galat") {
    // BUKAN layar Mulai: "Buat dompet baru" di sana akan menimpa dompet yang
    // mungkin hanya gagal terbaca sesaat.
    return (
      <View style={s.tengah}>
        <Text style={s.galat}>{pesanGalatDompet(galat)}</Text>
        <Button title="Coba lagi" onPress={muatUlang} />
      </View>
    );
  }

  const punyaDompet = keadaan === "siap";

  // Judul semua layar dari JUDUL_LAYAR — alasannya di src/judul-layar.ts.
  return (
    <Stack screenOptions={{ headerTitleStyle: { fontWeight: "600" } }}>
      <Stack.Protected guard={punyaDompet}>
        {layarMenurutDompet(true).map(([name, title]) => (
          <Stack.Screen key={name} name={name} options={{ title }} />
        ))}
      </Stack.Protected>
      <Stack.Protected guard={!punyaDompet}>
        {layarMenurutDompet(false).map(([name, title]) => (
          <Stack.Screen key={name} name={name} options={{ title }} />
        ))}
      </Stack.Protected>
    </Stack>
  );
}

const s = StyleSheet.create({
  tengah: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  galat: { fontSize: 15, lineHeight: 22, textAlign: "center" },
});
