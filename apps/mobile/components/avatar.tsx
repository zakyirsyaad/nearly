import { useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import Svg, { Circle, ClipPath, Defs, G, LinearGradient, Rect, Stop } from "react-native-svg";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { MAKS_SKALA_HURUF_KECIL } from "@/theme/globals";
import { urlAvatarEns } from "../src/avatar-ens";
import { polaIdenticon, SISI_IDENTICON } from "../src/identicon";
import { hurufAvatar } from "../src/teks-ui";

export type UkuranAvatar = 42 | 56 | 64;
export type CincinAvatar = "primary" | "verified" | "avatarAwal";

/**
 * Lingkaran huruf awal (spec desain UI §6): 42 di kartu, 56 di sheet salaman,
 * 64 di kepala Profil orang; gradasi avatarAwal → border; cincin 2 px berwarna
 * pemberian pemanggil. Dekoratif untuk pembaca layar — nama selalu tampil di
 * sebelahnya (§3.7).
 *
 * *Ditambahkan 2026-09-24:* di belakang huruf ada pola 5×5 yang diturunkan
 * dari ALAMAT (src/identicon.ts). Nama tidak unik dan tidak akan pernah unik
 * (spec induk §9.2), jadi dua "Andi" dulu tampak kembar; pola ini membuat
 * keduanya berbeda sekilas tanpa harus membaca alamatnya.
 */
export function Avatar({
  nama,
  alamat,
  ukuran,
  cincin,
}: {
  nama: string | null;
  alamat: string;
  ukuran: UkuranAvatar;
  cincin: CincinAvatar;
}) {
  const awal = useColor("avatarAwal");
  const akhir = useColor("border");
  const warnaCincin = useColor(cincin);
  const warnaPola = useColor("mutedForeground");
  const r = ukuran / 2;
  const pola = polaIdenticon(alamat);
  // Avatar ENS (bila ada) menimpa pola; 404 adalah keadaan normal, jadi
  // kegagalannya tidak pernah jadi pesan — cukup kembali ke pola.
  const [gagalEns, setGagalEns] = useState(false);
  const [adaEns, setAdaEns] = useState(false);
  const sel = ukuran / (SISI_IDENTICON + 1); // sisa setengah sel jadi tepi

  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ width: ukuran, height: ukuran }}>
      <Svg width={ukuran} height={ukuran}>
        <Defs>
          <LinearGradient id="gradasiAvatar" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={awal} />
            <Stop offset="1" stopColor={akhir} />
          </LinearGradient>
          <ClipPath id="bulatAvatar">
            <Circle cx={r} cy={r} r={r - 1} />
          </ClipPath>
        </Defs>
        <Circle cx={r} cy={r} r={r - 1} fill="url(#gradasiAvatar)" />
        {/* Pola alamat: redup, supaya huruf di atasnya tetap yang terbaca duluan. */}
        <G clipPath="url(#bulatAvatar)" opacity={0.5}>
          {pola.flatMap((baris, b) => baris.map((hidup, k) => (hidup ? (
            <Rect
              key={`${b}-${k}`}
              x={sel / 2 + k * sel}
              y={sel / 2 + b * sel}
              width={sel}
              height={sel}
              fill={warnaPola}
            />
          ) : null)))}
        </G>
        <Circle cx={r} cy={r} r={r - 1} fill="none" stroke={warnaCincin} strokeWidth={2} />
      </Svg>
      {gagalEns ? null : (
        <Image
          source={{ uri: urlAvatarEns(alamat) }}
          onError={() => setGagalEns(true)}
          onLoad={() => setAdaEns(true)}
          style={{
            position: "absolute",
            top: 2,
            left: 2,
            width: ukuran - 4,
            height: ukuran - 4,
            borderRadius: (ukuran - 4) / 2,
          }}
        />
      )}
      {/* Huruf hanya selama foto ENS belum ada — dua-duanya bertumpuk itu
          justru membuat wajahnya tidak terbaca. */}
      <View style={[StyleSheet.absoluteFill, s.tengah]} pointerEvents="none">
        {adaEns ? null : <Text variant={ukuran >= 56 ? "title" : "body"} style={s.huruf} maxFontSizeMultiplier={MAKS_SKALA_HURUF_KECIL}>
          {hurufAvatar(nama, alamat)}
        </Text>}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  tengah: { alignItems: "center", justifyContent: "center" },
  huruf: { fontWeight: "600" },
});
