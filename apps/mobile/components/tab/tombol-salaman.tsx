import { Pressable, StyleSheet, View, type GestureResponderEvent } from "react-native";
import { ArrowLeftRight } from "lucide-react-native";
import { useColor } from "@/hooks/useColor";
import { RADIUS, UKURAN } from "@/theme/globals";

/**
 * Tombol Salaman di tengah tab bar (spec desain UI §3.4, §4.3, keputusan #3):
 * kotak primary 52×52 radius 14, naik 26 dari garis tab, cincin 5 px warna
 * latar tab bar. 52×52 sudah ≥ target sentuh 48 (§3.7).
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

  return (
    <View style={s.slot}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: terpilih }}
        style={[s.cincin, { backgroundColor: latarBar }]}
      >
        <View style={[s.tombol, { backgroundColor: primary }]}>
          <ArrowLeftRight color={ikon} size={24} />
        </View>
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
  tombol: {
    width: UKURAN.tombolSalaman,
    height: UKURAN.tombolSalaman,
    borderRadius: RADIUS.salaman,
    alignItems: "center",
    justifyContent: "center",
  },
});
