import QRCode from "react-native-qrcode-svg";
import { StyleSheet, View } from "react-native";
import { KeadaanGalat } from "@/components/keadaan";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { RADIUS, UKURAN } from "@/theme/globals";
import type { NearlySigner } from "../../src/signer";
import { useRotatingQr } from "../../src/handshake/useRotatingQr";
import { CATATAN_LOKASI_QR, teksHitungMundurQr } from "../../src/teks-salaman";

/**
 * Mode "Show QR" layar Salaman (spec desain UI §6.2). Dipasang hanya saat tab
 * Salaman fokus dan mode ini aktif (R10); melepasnya menghentikan
 * useRotatingQr, dan memasangnya lagi langsung membuat offer baru.
 *
 * QR digambar di atas pelat `text` supaya kontras pemindai terjaga di tema
 * gelap — kode QR gelap di atas latar gelap tidak terbaca kamera.
 */
export function ModeQr({ signerSalaman }: { signerSalaman: NearlySigner }) {
  const { value, secondsLeft, error, refresh } = useRotatingQr(signerSalaman);
  const pelat = useColor("text");

  if (error) return <KeadaanGalat kalimat={error} onCobaLagi={() => void refresh()} />;

  return (
    <View style={s.root}>
      <View style={[s.pelat, { backgroundColor: pelat }]}>
        {value ? (
          <QRCode value={value} size={UKURAN.qr} />
        ) : (
          <Skeleton width={UKURAN.qr} height={UKURAN.qr} />
        )}
      </View>
      {value ? <Text variant="body" style={s.rata}>{teksHitungMundurQr(secondsLeft)}</Text> : null}
      {/* Alamat UTUH di sini (R4): ini layar detail milikmu sendiri. */}
      <Text variant="mono" selectable>{signerSalaman.address}</Text>
      <Text variant="caption" style={s.rata}>{CATATAN_LOKASI_QR}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { alignItems: "center", gap: 16, paddingVertical: 24 },
  pelat: { padding: 12, borderRadius: RADIUS.pelatQr },
  rata: { textAlign: "center" },
});
