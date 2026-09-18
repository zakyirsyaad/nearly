import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { RADIUS, UKURAN } from "@/theme/globals";
import { alamatSingkat, namaKartuRadar } from "../src/messages";
import { Avatar } from "./avatar";
import { BatangTrust } from "./batang-trust";

export type PropsKartuOrang = {
  nama: string;
  alamat: string;
  terverifikasi: boolean;
  lencana?: ReactNode;
  keterangan?: string;
  tier?: number;
  onPress?: () => void;
};

/**
 * Kartu orang ringkas (spec desain UI §6, R4): Avatar 42 (cincin `verified`
 * bila sudah salaman), nama + alamat SINGKAT mono yang tidak pernah
 * dihilangkan (anti-impersonasi), lencana, keterangan redup, batang trust
 * opsional.
 */
export function KartuOrang({ nama, alamat, terverifikasi, lencana, keterangan, tier, onPress }: PropsKartuOrang) {
  const latar = useColor("card");
  const garis = useColor("border");
  const gaya = [s.kartu, { backgroundColor: latar, borderColor: garis }];

  const isi = (
    <View style={s.baris}>
      <Avatar
        nama={nama}
        alamat={alamat}
        ukuran={UKURAN.avatarKartu}
        cincin={terverifikasi ? "verified" : "avatarAwal"}
      />
      <View style={s.teks}>
        <View style={s.nama}>
          <Text variant="body" style={s.tebal}>{namaKartuRadar(nama)}</Text>
          <Text variant="mono">{alamatSingkat(alamat)}</Text>
        </View>
        {lencana}
        {keterangan ? <Text variant="caption">{keterangan}</Text> : null}
        {tier !== undefined ? <BatangTrust tier={tier} kecil /> : null}
      </View>
    </View>
  );

  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" style={gaya}>
      {isi}
    </Pressable>
  ) : (
    <View style={gaya}>{isi}</View>
  );
}

const s = StyleSheet.create({
  kartu: { borderWidth: 1, borderRadius: RADIUS.kartu, padding: 16 },
  baris: { flexDirection: "row", alignItems: "center", gap: 12 },
  teks: { flex: 1, gap: 4 },
  nama: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", gap: 8 },
  tebal: { fontWeight: "600" },
});
