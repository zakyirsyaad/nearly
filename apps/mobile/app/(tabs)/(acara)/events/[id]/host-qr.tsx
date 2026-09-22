import { useIsFocused, useLocalSearchParams } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { ScrollView, StyleSheet, View } from "react-native";
import type { Hex } from "viem";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { RADIUS, UKURAN } from "@/theme/globals";
import { CONFIG } from "../../../../../src/config";
import type { NearlySigner } from "../../../../../src/signer";
import { useNearlySigner } from "../../../../../src/dompet/konteks-dompet";
import { useCheckInQr } from "../../../../../src/events/useCheckInQr";
import { teksPetunjukQrHost } from "../../../../../src/teks-acara";

export default function HostQrScreen() {
  const signer = useNearlySigner(CONFIG.attendanceRegistry);
  // Dompet belum siap — mis. sesaat setelah Ganti dompet, selagi layar ini
  // masih di tumpukan. Isi layar tidak dirender, supaya hook di dalamnya tidak
  // pernah berjalan tanpa signer (Ruling D4).
  if (!signer) return null;
  return <HostQrScreenIsi key={signer.address} signer={signer} />;
}

function HostQrScreenIsi({ signer }: { signer: NearlySigner }) {
  // Layar di dalam tab tetap terpasang saat host pindah tab. Tanpa gerbang
  // fokus, useCheckInQr terus membaca GPS, menandatangani, dan mengirim
  // tawaran check-in tiap 30 detik tanpa ada yang melihat (review Rencana A #2,
  // spec §4.6). QR dilepas saat tidak fokus, jadi intervalnya ikut berhenti.
  const fokus = useIsFocused();
  return fokus ? <QrCheckInAktif signer={signer} /> : null;
}

function QrCheckInAktif({ signer }: { signer: NearlySigner }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { value, secondsLeft, error } = useCheckInQr(signer, id as Hex);
  const pelat = useColor("text");

  // Tanpa "Try again": useCheckInQr sengaja tidak mengekspor refresh (lihat
  // komentar di hook itu). Galat yang bisa pulih dicoba lagi sendiri oleh
  // rotasi 30 detik; penolakan 4xx memang tidak akan berubah.
  if (error) {
    return (
      <View style={s.root}>
        <Text variant="body" style={s.rata}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.root} contentInsetAdjustmentBehavior="automatic">
      {/* Pelat terang: kode QR gelap di atas latar gelap tidak terbaca kamera
          tamu (pola yang sama dengan mode Show QR, spec §6.2). */}
      <View style={[s.pelat, { backgroundColor: pelat }]}>
        {value ? (
          <QRCode value={value} size={UKURAN.qr} />
        ) : (
          <Skeleton width={UKURAN.qr} height={UKURAN.qr} />
        )}
      </View>
      {value ? <Text variant="body" style={s.rata}>{teksPetunjukQrHost(secondsLeft)}</Text> : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flexGrow: 1, alignItems: "center", justifyContent: "center", gap: 24, padding: 24 },
  pelat: { padding: 12, borderRadius: RADIUS.pelatQr },
  rata: { textAlign: "center" },
});
