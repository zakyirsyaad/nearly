import { useEffect, useState } from "react";
import { router } from "expo-router";
import { Modal, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Avatar } from "@/components/avatar";
import { Lencana } from "@/components/lencana";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { useGerakDikurangi } from "@/hooks/useGerakDikurangi";
import { jarak, RADIUS, UKURAN } from "@/theme/globals";
import { req } from "../../src/http";
import { alamatSingkat, AWALAN_SHEET_BERTEMU, judulSheetBertemu } from "../../src/messages";
import {
  namaSheetUntuk, teksTerkoneksi, TEKS_LIHAT_PROFIL, TEKS_PINDAI_ORANG_LAIN, type SimpananNama,
} from "../../src/teks-salaman";

/** Yang diketahui pemindai setelah postAccept berhasil — alamat dari QR + txHash. */
export type HasilSalaman = { initiator: string; txHash: string };

/**
 * Sheet "You met …" (spec desain UI §6.2, keputusan #16D, R13, R14). Hanya sisi
 * PEMINDAI yang melihatnya: pemegang QR tidak menerima sinyal apa pun dari
 * postAccept (§11 batas #7).
 *
 * Modal React Native, bukan komponen BNA: daftar komponen §3.6 tidak memuat
 * sheet, dan salinan `bottom-sheet` BNA gagal tsc repo ini (R13).
 */
export function SheetBertemu({
  hasil,
  alamatSendiri,
  onTutup,
}: {
  hasil: HasilSalaman;
  alamatSendiri: string;
  onTutup: () => void;
}) {
  const [simpananNama, setSimpananNama] = useState<SimpananNama | null>(null);
  // R14: nama hanya dipakai untuk alamat yang memintanya (Ruling B2-4).
  const nama = namaSheetUntuk(simpananNama, hasil.initiator);
  const gerakDikurangi = useGerakDikurangi();
  const insets = useSafeAreaInsets();
  const selubung = useColor("selubung");
  const latar = useColor("card");
  const garis = useColor("border");

  useEffect(() => {
    // Jawaban yang datang setelah efek ini dibersihkan (sheet ditutup atau
    // alamat berganti) tidak disimpan; jawaban yang lolos pun disimpan BERSAMA
    // alamatnya dan dibandingkan saat render (namaSheetUntuk).
    let aktif = true;
    // Haptic tepat saat sheet TERBUKA (§6.2 butir 7), bukan saat ditutup.
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const untuk = hasil.initiator;
    // SATU panggilan publik, rute dan bentuk yang sama dengan layar profil,
    // TANPA bukti: sheet hanya butuh displayName. Galat, waktu habis, atau
    // nama kosong → judul tetap alamat singkat, tanpa pesan galat (R14).
    req<{ displayName?: string }>(`/profile/${untuk}`)
      .then((p) => {
        if (aktif) setSimpananNama({ alamat: untuk, nama: p.displayName ?? null });
      })
      .catch(() => {});
    return () => {
      aktif = false;
    };
  }, [hasil.initiator]);

  const lihatProfil = () => {
    onTutup();
    router.push(`/profile/${hasil.initiator}`);
  };

  const pindaiOrangLain = () => {
    onTutup();
  };

  const namaBersih = nama?.trim() ?? "";

  return (
    <Modal
      transparent
      visible
      animationType={gerakDikurangi ? "fade" : "slide"}
      onRequestClose={pindaiOrangLain}
    >
      <View style={[s.selubung, { backgroundColor: selubung }]}>
        <View
          style={[
            s.panel,
            {
              backgroundColor: latar,
              borderTopColor: garis,
              paddingBottom: jarak.lg + insets.bottom,
            },
          ]}
        >
          <View style={s.avatar}>
            <Avatar nama={null} alamat={alamatSendiri} ukuran={UKURAN.avatarSheet} cincin="primary" />
            <View style={s.tumpuk}>
              <Avatar
                nama={namaBersih || null}
                alamat={hasil.initiator}
                ukuran={UKURAN.avatarSheet}
                cincin="verified"
              />
            </View>
          </View>

          {namaBersih ? (
            <Text variant="title">{judulSheetBertemu(nama, hasil.initiator)}</Text>
          ) : (
            <Text variant="title">
              {AWALAN_SHEET_BERTEMU}
              <Text variant="mono">{alamatSingkat(hasil.initiator)}</Text>
            </Text>
          )}

          <Lencana varian="terverifikasi" />

          <Text variant="caption">{teksTerkoneksi(hasil.txHash)}</Text>

          <View style={s.tombol}>
            <Button onPress={lihatProfil} style={s.penuh}>{TEKS_LIHAT_PROFIL}</Button>
            <Button variant="outline" onPress={pindaiOrangLain} style={s.penuh}>
              {TEKS_PINDAI_ORANG_LAIN}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  selubung: { flex: 1, justifyContent: "flex-end" },
  panel: {
    borderTopLeftRadius: RADIUS.sheet,
    borderTopRightRadius: RADIUS.sheet,
    borderTopWidth: 1,
    padding: 16,
    gap: 12,
    alignItems: "center",
  },
  avatar: { flexDirection: "row", alignItems: "center", paddingBottom: 4 },
  // Tumpang tindih 16 (§6.2 butir 2) — nilai mutlak tetap di skala jarak.
  tumpuk: { marginLeft: -16 },
  tombol: { alignSelf: "stretch", gap: 8, paddingTop: 4 },
  penuh: { width: "100%" },
});
