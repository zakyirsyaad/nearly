import { useEffect, useMemo, useState } from "react";
import { Button, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { periksaNamaTampilan, type Visibilitas } from "@nearly/shared";
import { CONFIG } from "../src/config";
import { createDevSigner } from "../src/signer";
import { ApiError } from "../src/http";
import { sesiPesan } from "../src/pesan/sesi";
import { getProfilSaya, simpanProfil } from "../src/radar/radar-api";
import {
  KALIMAT_BATAS_TERSEMBUNYI,
  kalimatVisibilitas,
  labelSimpanProfil,
  pesanNamaTidakSah,
  profilErrorMessage,
  sisaKarakterNama,
} from "../src/messages";
import { WARNA } from "../src/warna";

const MODE: { nilai: Visibilitas; judul: string }[] = [
  { nilai: "terlihat", judul: "Terlihat" },
  { nilai: "tersembunyi", judul: "Tersembunyi" },
];

export default function ProfilSayaScreen() {
  const signer = useMemo(
    () => createDevSigner(CONFIG.devPrivateKey!, CONFIG.verifyingContract),
    [],
  );
  const [nama, setNama] = useState("");
  const [visibilitas, setVisibilitas] = useState<Visibilitas>("terlihat");
  const [dimuat, setDimuat] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const p = await getProfilSaya(await sesiPesan(signer));
        setNama(p.displayName);
        setVisibilitas(p.visibilitas);
      } catch (e) {
        setPesan(e instanceof ApiError ? profilErrorMessage(e.code) : "Profil gagal dimuat.");
      } finally {
        setDimuat(true);
      }
    })();
  }, [signer]);

  async function simpan() {
    if (sibuk) return;
    const cek = periksaNamaTampilan(nama);
    if (!cek.ok) {
      setPesan(pesanNamaTidakSah(cek.alasan));
      return;
    }
    setSibuk(true);
    try {
      await simpanProfil(signer, { displayName: cek.nama, visibilitas });
      setNama(cek.nama);
      setPesan("Tersimpan.");
    } catch (e) {
      setPesan(e instanceof ApiError ? profilErrorMessage(e.code) : "Gagal menyimpan. Coba lagi.");
    } finally {
      setSibuk(false);
    }
  }

  const sisa = sisaKarakterNama(nama);

  return (
    <ScrollView
      contentContainerStyle={s.root}
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
    >
      <Text style={s.label}>Nama tampilan</Text>
      <TextInput
        value={nama}
        onChangeText={setNama}
        placeholder="Tanpa nama"
        editable={dimuat && !sibuk}
        autoCorrect={false}
        style={[s.isian, { color: WARNA.teks }]}
        placeholderTextColor={WARNA.placeholder}
      />
      {/* Penghitung code point, bukan maxLength — maxLength menghitung unit UTF-16 dan memotong emoji. */}
      <Text style={[s.penghitung, sisa < 0 && s.lebih]}>{sisa}</Text>
      <Text style={s.catatan}>Nama tidak unik. Alamatmu selalu tampil di sebelahnya.</Text>

      <Text style={s.label}>Visibilitas</Text>
      {MODE.map((m) => (
        <Pressable
          key={m.nilai}
          onPress={() => setVisibilitas(m.nilai)}
          disabled={!dimuat || sibuk}
          style={[s.mode, visibilitas === m.nilai && s.modeDipilih]}
          accessibilityRole="radio"
          accessibilityState={{ selected: visibilitas === m.nilai }}
        >
          <Text style={s.modeJudul}>
            {visibilitas === m.nilai ? "● " : "○ "}
            {m.judul}
          </Text>
          <Text style={s.modePenjelasan}>{kalimatVisibilitas(m.nilai)}</Text>
        </Pressable>
      ))}
      <Text style={s.catatan}>{KALIMAT_BATAS_TERSEMBUNYI}</Text>

      <View style={s.tombol}>
        <Button
          title={labelSimpanProfil(sibuk)}
          onPress={() => void simpan()}
          disabled={!dimuat || sibuk || sisa < 0}
        />
      </View>
      {pesan && <Text style={s.pesan}>{pesan}</Text>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { padding: 16, gap: 10 },
  label: { fontSize: 13, fontWeight: "600", opacity: 0.7, paddingTop: 8 },
  isian: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, padding: 10, fontSize: 16 },
  penghitung: { fontSize: 12, opacity: 0.6, alignSelf: "flex-end" },
  lebih: { color: "#b00", opacity: 1 },
  catatan: { fontSize: 13, lineHeight: 19, opacity: 0.6 },
  mode: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, padding: 12, gap: 4 },
  modeDipilih: { borderWidth: 2 },
  modeJudul: { fontSize: 16, fontWeight: "600" },
  modePenjelasan: { fontSize: 14, lineHeight: 20, opacity: 0.75 },
  tombol: { paddingTop: 8 },
  pesan: { fontSize: 15, lineHeight: 22 },
});
