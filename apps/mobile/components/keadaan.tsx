import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { UKURAN } from "@/theme/globals";
import { TEKS_COBA_LAGI } from "../src/teks-ui";

/**
 * Empat keadaan seragam (spec desain UI §7.2). "Berhasil" adalah toast BNA +
 * haptic, dipanggil langsung oleh layar. Kalimat kosong/galat selalu kalimat
 * yang SUDAH ADA di layar (diterjemahkan Rencana B), bukan teks baru.
 */

/** Kosong: ikon lucide redup + kalimat + satu aksi bila masuk akal. */
export function KeadaanKosong({
  Ikon,
  kalimat,
  aksi,
}: {
  Ikon: ComponentType<LucideProps>;
  kalimat: string;
  aksi?: { label: string; onPress: () => void };
}) {
  const redup = useColor("textMuted");
  return (
    <View style={s.tengah}>
      <Ikon color={redup} size={32} />
      <Text variant="body" style={[s.rata, { color: redup }]}>{kalimat}</Text>
      {aksi ? <Button onPress={aksi.onPress}>{aksi.label}</Button> : null}
    </View>
  );
}

/** Galat: kalimat galat + "Try again" yang memuat ulang. */
export function KeadaanGalat({ kalimat, onCobaLagi }: { kalimat: string; onCobaLagi: () => void }) {
  return (
    <View style={s.tengah}>
      <Text variant="body" style={s.rata}>{kalimat}</Text>
      <Button variant="outline" onPress={onCobaLagi}>{TEKS_COBA_LAGI}</Button>
    </View>
  );
}

/** Memuat: kerangka berbentuk kartu (diam saat Reduce Motion — lihat Skeleton). */
export function KerangkaDaftar({ baris = 3 }: { baris?: number }) {
  return (
    <View style={s.daftar}>
      {Array.from({ length: baris }, (_, i) => (
        <Skeleton key={i} height={UKURAN.tinggiKerangka} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  tengah: { alignItems: "center", gap: 12, paddingVertical: 32, paddingHorizontal: 16 },
  rata: { textAlign: "center" },
  daftar: { gap: 12 },
});
