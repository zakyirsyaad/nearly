import { useRef, useState } from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LogoN } from "@/components/logo-n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { UKURAN } from "@/theme/globals";
import { useDompet } from "../src/dompet/konteks-dompet";
import { PERINGATAN_MNEMONIK_UTAMA, pesanGalatDompet } from "../src/dompet/teks-dompet";
import { LABEL_12_KATA } from "../src/teks-akun";
import {
  KALIMAT_MULAI, LABEL_KUNCI_DEV, PERINGATAN_KUNCI_DEV, PLACEHOLDER_12_KATA, TEKS_BUAT_DOMPET,
  TEKS_IMPOR_KUNCI_DEV, TEKS_KEMBALI, TEKS_MENYIAPKAN_DOMPET, TEKS_PAKAI_DOMPET,
  TEKS_PAKAI_DOMPET_INI, TEKS_PAKAI_KUNCI_INI,
} from "../src/teks-mulai";

// Membuat atau mengimpor dari 12 kata menurunkan kunci dengan PBKDF2 di thread
// JS — bisa beberapa detik di HP. Jeda ini memberi layar kesempatan
// menggambar "Setting up wallet…" sebelum thread sibuk.
const jedaUi = () => new Promise<void>((r) => { setTimeout(r, 50); });

type Mode = "pilih" | "mnemonik" | "kunci-dev";

export default function MulaiScreen() {
  const { buatBaru, imporMnemonik, imporKunciDev } = useDompet();
  const [mode, setMode] = useState<Mode>("pilih");
  const [teks, setTeks] = useState("");
  const [sibuk, setSibuk] = useState(false);
  // Penjaga SINKRON: dua ketukan dalam satu frame sama-sama melihat `sibuk`
  // bernilai false dari closure render yang sama. Ref berubah seketika.
  const sibukRef = useRef(false);
  const [galat, setGalat] = useState<string | null>(null);
  const kuning = useColor("primary");
  const merah = useColor("destructive");

  const pindah = (m: Mode) => {
    setMode(m);
    setTeks("");
    setGalat(null);
  };

  async function jalankan(aksi: () => Promise<void>) {
    if (sibukRef.current) return;
    sibukRef.current = true;
    setSibuk(true);
    setGalat(null);
    await jedaUi();
    try {
      // Berhasil → gerbang di _layout.tsx pindah ke beranda dan layar ini dilepas.
      await aksi();
    } catch (e) {
      setGalat(pesanGalatDompet(e));
    } finally {
      sibukRef.current = false;
      setSibuk(false);
    }
  }

  return (
    <SafeAreaView style={s.flex}>
      <ScrollView
        contentContainerStyle={s.root}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.kepala}>
          <LogoN ukuran={UKURAN.logoMulai} />
          <Text variant="title" style={s.rata}>{KALIMAT_MULAI}</Text>
        </View>

        {mode === "pilih" && (
          <View style={s.bagian}>
            <Button disabled={sibuk} onPress={() => void jalankan(buatBaru)}>
              {sibuk ? TEKS_MENYIAPKAN_DOMPET : TEKS_BUAT_DOMPET}
            </Button>
            <Button variant="outline" disabled={sibuk} onPress={() => pindah("mnemonik")}>
              {TEKS_PAKAI_DOMPET}
            </Button>
            {/* Khusus pengembangan: tidak pernah dirender di build produksi (spec dompet R5). */}
            {__DEV__ && (
              <Button variant="ghost" disabled={sibuk} onPress={() => pindah("kunci-dev")}>
                {TEKS_IMPOR_KUNCI_DEV}
              </Button>
            )}
          </View>
        )}

        {mode === "mnemonik" && (
          <View style={s.bagian}>
            <Text variant="caption">{LABEL_12_KATA}</Text>
            <Input
              value={teks}
              onChangeText={setTeks}
              placeholder={PLACEHOLDER_12_KATA}
              accessibilityLabel={LABEL_12_KATA}
              type="textarea"
              rows={3}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              textContentType="none"
              spellCheck={false}
              // Android: autoCorrect={false} tidak menghentikan Gboard belajar
              // dari ketikan; tipe visible-password mematikan saran & kamus.
              keyboardType={Platform.OS === "android" ? "visible-password" : "default"}
              importantForAutofill="no"
              editable={!sibuk}
            />
            <Text variant="caption" style={{ color: kuning }}>{PERINGATAN_MNEMONIK_UTAMA}</Text>
            <Button
              disabled={sibuk || teks.trim() === ""}
              onPress={() => void jalankan(() => imporMnemonik(teks))}
            >
              {sibuk ? TEKS_MENYIAPKAN_DOMPET : TEKS_PAKAI_DOMPET_INI}
            </Button>
            <Button variant="outline" disabled={sibuk} onPress={() => pindah("pilih")}>{TEKS_KEMBALI}</Button>
          </View>
        )}

        {__DEV__ && mode === "kunci-dev" && (
          <View style={s.bagian}>
            <Text variant="caption">{LABEL_KUNCI_DEV}</Text>
            <Input
              value={teks}
              onChangeText={setTeks}
              placeholder="0x…"
              accessibilityLabel={LABEL_KUNCI_DEV}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              textContentType="none"
              importantForAutofill="no"
              editable={!sibuk}
            />
            <Text variant="caption" style={{ color: kuning }}>{PERINGATAN_KUNCI_DEV}</Text>
            <Button
              disabled={sibuk || teks.trim() === ""}
              onPress={() => void jalankan(() => imporKunciDev(teks))}
            >
              {sibuk ? TEKS_MENYIAPKAN_DOMPET : TEKS_PAKAI_KUNCI_INI}
            </Button>
            <Button variant="outline" disabled={sibuk} onPress={() => pindah("pilih")}>{TEKS_KEMBALI}</Button>
          </View>
        )}

        {galat ? <Text variant="body" style={{ color: merah }}>{galat}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  root: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 32 },
  kepala: { alignItems: "center", gap: 16 },
  bagian: { gap: 12 },
  rata: { textAlign: "center" },
});
