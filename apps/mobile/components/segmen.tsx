import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { RADIUS, UKURAN } from "@/theme/globals";

export type PilihanSegmen<T extends string> = { nilai: T; label: string };

/**
 * Pemilih mode (spec desain UI §3.6: BNA tidak punya segmented control).
 * Dipakai layar Salaman ("Show QR" | "Scan"). Setiap butir ≥ 48 tinggi.
 */
export function Segmen<T extends string>({
  pilihan,
  nilai,
  onGanti,
}: {
  pilihan: readonly PilihanSegmen<T>[];
  nilai: T;
  onGanti: (nilai: T) => void;
}) {
  const latar = useColor("card");
  const garis = useColor("border");
  const aktif = useColor("primary");
  const teksAktif = useColor("primaryForeground");
  const teks = useColor("text");

  return (
    <View accessibilityRole="tablist" style={[s.wadah, { backgroundColor: latar, borderColor: garis }]}>
      {pilihan.map((p) => {
        const terpilih = p.nilai === nilai;
        return (
          <Pressable
            key={p.nilai}
            accessibilityRole="tab"
            accessibilityState={{ selected: terpilih }}
            onPress={() => onGanti(p.nilai)}
            style={[s.butir, terpilih ? { backgroundColor: aktif } : null]}
          >
            <Text variant="body" style={{ color: terpilih ? teksAktif : teks, fontWeight: "600" }}>
              {p.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  wadah: { flexDirection: "row", borderWidth: 1, borderRadius: RADIUS.kartu, padding: 4, gap: 4 },
  butir: {
    flex: 1,
    minHeight: UKURAN.sentuh,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.kartu,
  },
});
