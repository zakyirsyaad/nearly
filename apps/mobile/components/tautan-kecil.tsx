import { Pressable, StyleSheet } from "react-native";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { UKURAN } from "@/theme/globals";

/**
 * Tautan teks kecil ("See all ›", "Open radar ›", "Copy", "Report", …) dengan
 * target sentuh ≥ 48 lewat minHeight, tanpa membesarkan hurufnya (spec desain
 * UI §3.7).
 */
export function TautanKecil({
  label,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const warna = useColor("primary");
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} style={s.sentuh}>
      <Text variant="caption" style={{ color: warna, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  sentuh: { minHeight: UKURAN.sentuh, justifyContent: "center" },
});
