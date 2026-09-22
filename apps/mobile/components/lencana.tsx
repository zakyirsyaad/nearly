import { StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { jarak, MAKS_SKALA_HURUF_KECIL, RADIUS } from "@/theme/globals";
import { LENCANA_BERTEMU, LENCANA_RINGKAS } from "../src/teks-ui";

export type PropsLencana =
  | { varian: "terverifikasi"; ekor?: string }
  | { varian: "ringkas" }
  | { varian: "teks"; teks: string };

/**
 * Lencana (spec desain UI §3.4, §6): garis 1 px, teks 11, radius 5, dibatasi
 * 1,3× (§3.7). `terverifikasi` = "✓ met in person" (+ ekor seperti
 * " · 2 events together" dari pemanggil); `ringkas` = "✓"; `teks` = kalimat
 * bebas (mis. "You both want to meet") berwarna primary (Ruling A15).
 */
export function Lencana(props: PropsLencana) {
  const hijau = useColor("verified");
  const kuning = useColor("primary");
  const warna = props.varian === "teks" ? kuning : hijau;
  const teks =
    props.varian === "terverifikasi"
      ? `${LENCANA_BERTEMU}${props.ekor ?? ""}`
      : props.varian === "ringkas"
        ? LENCANA_RINGKAS
        : props.teks;

  return (
    <View style={[s.kotak, { borderColor: warna }]}>
      <Text variant="label" style={{ color: warna }} maxFontSizeMultiplier={MAKS_SKALA_HURUF_KECIL}>
        {teks}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  kotak: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: RADIUS.lencana,
    paddingHorizontal: jarak.sm,
    paddingVertical: 0,
  },
});
