import { StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { jarak, RADIUS, UKURAN } from "@/theme/globals";
import { JUMLAH_RUAS_TRUST, labelAksesTrust, labelTier, ruasTerisiTrust } from "../src/tier";

/**
 * Batang trust bertingkat (spec desain UI §6, keputusan #10f): 4 ruas, terisi
 * = tier + 1 berwarna `verified`, kosong `segmentEmpty` (#16B). Tidak pernah
 * persentase atau angka skor. SATU elemen aksesibel "Trust: ‹tier›"; bila label
 * tier ikut tampil, keduanya satu elemen supaya tidak terbaca dua kali (§3.7).
 */
export function BatangTrust({
  tier,
  kecil = false,
  denganLabel = false,
}: {
  tier: number;
  kecil?: boolean;
  denganLabel?: boolean;
}) {
  const terisi = useColor("verified");
  const kosong = useColor("segmentEmpty");
  const jumlahTerisi = ruasTerisiTrust(tier);
  const tinggi = kecil ? UKURAN.batangTrustKecil : UKURAN.batangTrust;

  return (
    <View accessible accessibilityLabel={labelAksesTrust(tier)} style={s.baris}>
      <View style={[s.ruas, { gap: UKURAN.celahRuas }]}>
        {Array.from({ length: JUMLAH_RUAS_TRUST }, (_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: tinggi,
              borderRadius: RADIUS.batang,
              backgroundColor: i < jumlahTerisi ? terisi : kosong,
            }}
          />
        ))}
      </View>
      {denganLabel ? <Text variant="caption">{labelTier(tier)}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  baris: { flexDirection: "row", alignItems: "center", gap: jarak.sm },
  ruas: { flex: 1, flexDirection: "row" },
});
