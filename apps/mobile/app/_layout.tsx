import "../src/polyfills"; // WAJIB baris pertama — lihat catatan di polyfills.ts
import { useEffect } from "react";
import { StyleSheet } from "react-native";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import { useFonts } from "expo-font";
import { Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { JetBrainsMono_400Regular } from "@expo-google-fonts/jetbrains-mono";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { ToastProvider } from "@/components/ui/toast";
import { useColor } from "@/hooks/useColor";
import { OPSI_STACK, opsiTampilan } from "@/theme/navigasi";
import { ruteDariNotifikasi } from "../src/pesan/rute-push";
import { layarMenurutDompet } from "../src/judul-layar";
import { DompetProvider, useDompet } from "../src/dompet/konteks-dompet";
import { pesanGalatDompet } from "../src/dompet/teks-dompet";
import { bolehSembunyikanSplash } from "../src/splash";
import { TEKS_COBA_LAGI } from "../src/teks-ui";

// Splash tetap menutupi layar sampai font DAN dompet siap (spec desain UI
// §3.5). Tingkat modul: harus terpanggil sebelum layar pertama tergambar.
void SplashScreen.preventAutoHideAsync().catch(() => {});

// Notifikasi yang tiba saat aplikasi terbuka tetap ditampilkan sebagai banner.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  // ToastProvider di luar DompetProvider: toast dipakai layar di kedua sisi
  // gerbang, dan ia membawa GestureHandlerRootView untuk seluruh aplikasi.
  return (
    <ToastProvider>
      <DompetProvider>
        <Navigasi />
      </DompetProvider>
    </ToastProvider>
  );
}

/**
 * Gerbang dompet (spec dompet §5.1, spec desain UI §4.2). Tanpa dompet hanya
 * layar Mulai yang ada; dengan dompet, Mulai tidak bisa dibuka. Saat penjaga
 * berubah — dompet baru dibuat, atau dompet dihapus lewat Ganti dompet —
 * expo-router memindahkan tumpukan ke layar pertama yang diizinkan.
 */
function Navigasi() {
  const { keadaan, galat, muatUlang } = useDompet();
  const [fontTermuat, fontGagal] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
    JetBrainsMono_400Regular,
  });
  const latar = useColor("background");
  // Font yang gagal dimuat tidak memblokir aplikasi: teks jatuh ke font sistem.
  const fontSelesai = fontTermuat || fontGagal !== null;
  const splashBoleh = bolehSembunyikanSplash(fontSelesai, keadaan);

  useEffect(() => {
    if (splashBoleh) void SplashScreen.hideAsync().catch(() => {});
  }, [splashBoleh]);

  useEffect(() => {
    // Rute tujuan notifikasi hanya ada saat dompet siap.
    if (keadaan !== "siap") return;
    const langganan = Notifications.addNotificationResponseReceivedListener((r) => {
      const rute = ruteDariNotifikasi(r.notification.request.content.data);
      // navigate, bukan push: dengan (tabs) sebagai layar Stack akar, push bisa
      // menumpuk navigator tab kedua (Ruling A9). ruteDariNotifikasi tidak berubah.
      if (rute) router.navigate(rute);
    });
    return () => langganan.remove();
  }, [keadaan]);

  // Selama "memuat" atau font belum selesai, splash masih menutupi layar.
  if (!splashBoleh) return null;

  if (keadaan === "galat") {
    // BUKAN layar Mulai: "Buat dompet baru" di sana akan menimpa dompet yang
    // mungkin hanya gagal terbaca sesaat.
    return (
      <SafeAreaView style={[s.tengah, { backgroundColor: latar }]}>
        <StatusBar style="light" />
        <Text variant="body" style={s.teksGalat}>{pesanGalatDompet(galat)}</Text>
        <Button onPress={muatUlang}>{TEKS_COBA_LAGI}</Button>
      </SafeAreaView>
    );
  }

  const punyaDompet = keadaan === "siap";

  // Judul semua layar dari JUDUL_LAYAR — alasannya di src/judul-layar.ts.
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={OPSI_STACK}>
        <Stack.Protected guard={punyaDompet}>
          {layarMenurutDompet(true).map(([name, opsi]) => (
            <Stack.Screen key={name} name={name} options={{ ...opsi, ...opsiTampilan(name) }} />
          ))}
        </Stack.Protected>
        <Stack.Protected guard={!punyaDompet}>
          {layarMenurutDompet(false).map(([name, opsi]) => (
            <Stack.Screen key={name} name={name} options={{ ...opsi, ...opsiTampilan(name) }} />
          ))}
        </Stack.Protected>
      </Stack>
    </>
  );
}

const s = StyleSheet.create({
  tengah: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  teksGalat: { textAlign: "center" },
});
