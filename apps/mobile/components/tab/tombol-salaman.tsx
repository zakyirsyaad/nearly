import { Pressable, StyleSheet, View, type GestureResponderEvent } from "react-native";
import { ArrowLeftRight } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { jarak, MAKS_SKALA_HURUF_KECIL, RADIUS, UKURAN } from "@/theme/globals";

/**
 * Tombol Salaman di tengah tab bar (spec desain UI §3.4, §4.3, keputusan #3):
 * kotak primary 52×52 radius 14, naik 26 dari garis tab, cincin 5 px warna
 * latar tab bar. 52×52 sudah ≥ target sentuh 48 (§3.7). Label "Handshake"
 * di bawahnya seperti tab lain (mockup N1; hilang di Rencana A, uji iPhone
 * 2026-09-19), berwarna aktif/tak aktif yang sama dengan label tab lain.
 */
export function TombolSalaman({
  onPress,
  terpilih,
  label,
}: {
  onPress: (e: GestureResponderEvent) => void;
  terpilih: boolean;
  label: string;
}) {
  const primary = useColor("primary");
  const ikon = useColor("primaryForeground");
  const latarBar = useColor("input");
  const aktif = useColor("primary");
  const redup = useColor("textMuted");

  return (
    <View style={s.slot}>
      {/* Seluruh kolom (tombol + label) satu target sentuh, seperti tab lain. */}
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: terpilih }}
        style={s.kolom}
      >
        <View style={[s.cincin, { backgroundColor: latarBar }]}>
          <View style={[s.tombol, { backgroundColor: primary }]}>
            <ArrowLeftRight color={ikon} size={24} />
          </View>
        </View>
        <Text
          variant="label"
          style={[s.label, { color: terpilih ? aktif : redup }]}
          maxFontSizeMultiplier={MAKS_SKALA_HURUF_KECIL}
        >
          {label}
        </Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  slot: { flex: 1, alignItems: "center" },
  cincin: {
    marginTop: -UKURAN.naikSalaman,
    padding: UKURAN.cincinSalaman,
    borderRadius: RADIUS.salaman + UKURAN.cincinSalaman,
  },
  kolom: { alignItems: "center" },
  label: { marginTop: jarak.xs },
  tombol: {
    width: UKURAN.tombolSalaman,
    height: UKURAN.tombolSalaman,
    borderRadius: RADIUS.salaman,
    alignItems: "center",
    justifyContent: "center",
  },
});
