import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { MAKS_SKALA_HURUF_KECIL } from "@/theme/globals";

/**
 * Ikon tab dengan lencana angka (Pesan) atau titik (Profil). Dirender di sini,
 * bukan lewat tabBarBadge, supaya lencana dibatasi 1,3× (spec desain UI §3.7,
 * Ruling A6).
 */
export function IkonTab({
  Ikon,
  warna,
  lencana = null,
  titik = false,
}: {
  Ikon: ComponentType<LucideProps>;
  warna: string;
  lencana?: string | null;
  titik?: boolean;
}) {
  const latarLencana = useColor("destructive");
  const teksLencana = useColor("background");

  return (
    <View style={s.wadah}>
      <Ikon color={warna} size={22} />
      {lencana ? (
        <View style={[s.lencana, { backgroundColor: latarLencana }]}>
          <Text variant="label" style={{ color: teksLencana }} maxFontSizeMultiplier={MAKS_SKALA_HURUF_KECIL}>
            {lencana}
          </Text>
        </View>
      ) : titik ? (
        <View style={[s.titik, { backgroundColor: latarLencana }]} />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wadah: { width: 32, height: 24, alignItems: "center", justifyContent: "center" },
  lencana: {
    position: "absolute",
    top: -4,
    right: -8,
    minWidth: 16,
    minHeight: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  titik: { position: "absolute", top: 0, right: 2, width: 8, height: 8, borderRadius: 4 },
});
