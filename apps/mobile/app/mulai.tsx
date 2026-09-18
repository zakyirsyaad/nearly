import { useRef, useState } from "react";
import { Button, Platform, ScrollView, StyleSheet, Text, TextInput } from "react-native";
import { useDompet } from "../src/dompet/konteks-dompet";
import { PERINGATAN_MNEMONIK_UTAMA, pesanGalatDompet } from "../src/dompet/teks-dompet";
import { WARNA } from "../src/warna";

// Membuat atau mengimpor dari 12 kata menurunkan kunci dengan PBKDF2 di thread
// JS — bisa beberapa detik di HP. Jeda ini memberi layar kesempatan
// menggambar "Menyiapkan dompet…" sebelum thread sibuk.
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

  const labelSibuk = "Menyiapkan dompet…";

  return (
    <ScrollView
      contentContainerStyle={s.root}
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
    >
      <Text style={s.h1}>Nearly</Text>
      <Text style={s.p}>
        Identitasmu di Nearly adalah dompet yang dibuat dan disimpan di HP ini. Tidak perlu aplikasi
        dompet lain, email, atau nomor telepon.
      </Text>

      {mode === "pilih" && (
        <>
          <Button
            title={sibuk ? labelSibuk : "Buat dompet baru"}
            disabled={sibuk}
            onPress={() => void jalankan(buatBaru)}
          />
          <Button
            title="Pakai dompet yang sudah ada (12 kata)"
            disabled={sibuk}
            onPress={() => pindah("mnemonik")}
          />
          {/* Khusus pengembangan: tidak pernah dirender di build produksi (spec dompet R5). */}
          {__DEV__ && (
            <Button
              title="Impor kunci privat (khusus pengembangan)"
              disabled={sibuk}
              onPress={() => pindah("kunci-dev")}
            />
          )}
        </>
      )}

      {mode === "mnemonik" && (
        <>
          <Text style={s.label}>12 kata pemulihan</Text>
          <TextInput
            value={teks}
            onChangeText={setTeks}
            placeholder="kata1 kata2 kata3 …"
            multiline
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
            style={[s.isian, s.isianBesar, { color: WARNA.teks }]}
            placeholderTextColor={WARNA.placeholder}
          />
          <Text style={s.peringatan}>{PERINGATAN_MNEMONIK_UTAMA}</Text>
          <Button
            title={sibuk ? labelSibuk : "Pakai dompet ini"}
            disabled={sibuk || teks.trim() === ""}
            onPress={() => void jalankan(() => imporMnemonik(teks))}
          />
          <Button title="Kembali" disabled={sibuk} onPress={() => pindah("pilih")} />
        </>
      )}

      {__DEV__ && mode === "kunci-dev" && (
        <>
          <Text style={s.label}>Kunci privat (khusus pengembangan)</Text>
          <TextInput
            value={teks}
            onChangeText={setTeks}
            placeholder="0x…"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            textContentType="none"
            importantForAutofill="no"
            editable={!sibuk}
            style={[s.isian, { color: WARNA.teks }]}
            placeholderTextColor={WARNA.placeholder}
          />
          <Text style={s.peringatan}>
            Hanya untuk dompet uji sekali pakai. Pilihan ini tidak ada di build produksi.
          </Text>
          <Button
            title={sibuk ? labelSibuk : "Pakai kunci ini"}
            disabled={sibuk || teks.trim() === ""}
            onPress={() => void jalankan(() => imporKunciDev(teks))}
          />
          <Button title="Kembali" disabled={sibuk} onPress={() => pindah("pilih")} />
        </>
      )}

      {galat && <Text style={s.galat}>{galat}</Text>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 14 },
  h1: { fontSize: 32, fontWeight: "700" },
  p: { fontSize: 15, lineHeight: 22, opacity: 0.75 },
  label: { fontSize: 13, fontWeight: "600", opacity: 0.7, paddingTop: 8 },
  isian: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, padding: 10, fontSize: 16 },
  isianBesar: { minHeight: 96, textAlignVertical: "top" },
  peringatan: { fontSize: 13, lineHeight: 19, color: "#8a4b00" },
  galat: { fontSize: 15, lineHeight: 22, color: "#b00" },
});
