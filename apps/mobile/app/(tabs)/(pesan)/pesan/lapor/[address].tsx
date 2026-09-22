import { useCallback, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Alert, FlatList, Pressable, StyleSheet, View } from "react-native";
import { MessageCircle, Square, SquareCheck } from "lucide-react-native";
import type { Address } from "viem";
import { KeadaanGalat, KeadaanKosong, KerangkaDaftar } from "@/components/keadaan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { RADIUS, UKURAN } from "@/theme/globals";
import { CONFIG } from "../../../../../src/config";
import type { NearlySigner } from "../../../../../src/signer";
import { useNearlySigner } from "../../../../../src/dompet/konteks-dompet";
import { HindariKeyboard } from "../../../../../src/hindari-keyboard";
import { ApiError } from "../../../../../src/http";
import { aksiBlokir } from "../../../../../src/blokir-actions";
import { sesiPesan } from "../../../../../src/pesan/sesi";
import { getRiwayat } from "../../../../../src/pesan/pesan-api";
import {
  bukaBaris, kunciLawan, laporanSiapDikirim, laporkanPercakapan, MAKS_BUKTI_LAPORAN,
  type PesanTerbuka,
} from "../../../../../src/pesan/pesan-actions";
import { blokirErrorMessage, pesanErrorMessage, petunjukLaporan } from "../../../../../src/messages";
import { labelKirimLaporan } from "../../../../../src/teks-profil";
import {
  ISI_LAPORAN_TERKIRIM, JUDUL_LAPORAN_TERKIRIM, KOSONG_BUKTI, labelPilihBukti,
  PERINGATAN_LAPOR_PESAN, placeholderAlasanLapor, TEKS_BLOKIR, TEKS_GAGAL_KIRIM_LAPORAN,
  TEKS_GAGAL_MUAT_BUKTI, teksLaporanTerkirimGagalBlokir, TEKS_NANTI,
} from "../../../../../src/teks-pesan";

type PesanSah = Extract<PesanTerbuka, { status: "sah" }>;

export default function LaporPesanScreen() {
  const signer = useNearlySigner(CONFIG.verifyingContract);
  // Dompet belum siap — mis. sesaat setelah Ganti dompet, selagi layar ini
  // masih di tumpukan. Isi layar tidak dirender, supaya hook di dalamnya tidak
  // pernah berjalan tanpa signer (Ruling D4).
  if (!signer) return null;
  return <LaporPesanScreenIsi key={signer.address} signer={signer} />;
}

function LaporPesanScreenIsi({ signer }: { signer: NearlySigner }) {
  const { address } = useLocalSearchParams<{ address: string }>();
  const lawan = address as Address;
  const [masuk, setMasuk] = useState<PesanSah[] | null>(null);
  const [dipilih, setDipilih] = useState<Set<string>>(new Set());
  const [alasan, setAlasan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [percobaan, setPercobaan] = useState(0);
  const spandukLatar = useColor("spandukLatar");
  const spandukGaris = useColor("spandukGaris");
  const kuning = useColor("primary");
  const garis = useColor("border");
  const redup = useColor("textMuted");
  const merah = useColor("destructive");

  const muat = useCallback(async () => {
    const sesi = await sesiPesan(signer);
    const k = await kunciLawan(sesi, lawan);
    const { pesan } = await getRiwayat(sesi, lawan);
    // Hanya pesan MASUK yang terverifikasi yang bisa jadi bukti — server menolak
    // yang lain dengan 422 (spec 4c §8.2).
    setMasuk(pesan.map((b) => bukaBaris(sesi, k, b))
      .filter((p): p is PesanSah => !p.dariAku && p.status === "sah"));
    setGalat(null);
  }, [signer, lawan]);

  useFocusEffect(useCallback(() => {
    let aktif = true;
    muat().catch((e: unknown) => {
      if (!aktif) return;
      // `masuk` dibiarkan null: muat pertama yang gagal tampil sebagai galat
      // + Try again (Ruling B2-12), bukan daftar bukti yang kosong.
      setGalat(e instanceof ApiError ? pesanErrorMessage(e.code) : TEKS_GAGAL_MUAT_BUKTI);
    });
    return () => { aktif = false; };
    // `percobaan` memasang ulang efek ini dari tombol Try again.
  }, [muat, percobaan]));

  function alih(id: string) {
    setDipilih((lama) => {
      const baru = new Set(lama);
      if (baru.has(id)) baru.delete(id);
      else if (baru.size < MAKS_BUKTI_LAPORAN) baru.add(id);
      return baru;
    });
  }

  async function kirim() {
    if (sibuk || !masuk || !laporanSiapDikirim(dipilih.size, alasan)) return;
    setSibuk(true);
    setGalat(null);
    const bukti = masuk.filter((p) => dipilih.has(p.id))
      .map((p) => ({ pesanId: p.id, isi: p.isi, dikirimMs: p.dikirimMs, tanda: p.tanda }));
    try {
      await laporkanPercakapan(signer, lawan, alasan, bukti);
    } catch (e) {
      setGalat(e instanceof ApiError ? pesanErrorMessage(e.code) : TEKS_GAGAL_KIRIM_LAPORAN);
      setSibuk(false);
      return;
    }
    setSibuk(false);
    Alert.alert(JUDUL_LAPORAN_TERKIRIM, ISI_LAPORAN_TERKIRIM, [
      { text: TEKS_NANTI, style: "cancel", onPress: () => router.back() },
      {
        text: TEKS_BLOKIR,
        style: "destructive",
        onPress: () => {
          aksiBlokir(signer, lawan, false)
            .then(() => router.replace("/pesan"))
            // Laporannya SUDAH terkirim — jangan katakan sebaliknya.
            .catch((e: unknown) => setGalat(teksLaporanTerkirimGagalBlokir(
              e instanceof ApiError ? blokirErrorMessage(e.code) : null)));
        },
      },
    ]);
  }

  const petunjuk = petunjukLaporan(dipilih.size, alasan);

  if (masuk === null) {
    return (
      <View style={s.muat}>
        {galat ? (
          <KeadaanGalat kalimat={galat} onCobaLagi={() => setPercobaan((n) => n + 1)} />
        ) : (
          <KerangkaDaftar />
        )}
      </View>
    );
  }

  return (
    <HindariKeyboard>
      <View style={s.root}>
        <View style={[s.spanduk, { backgroundColor: spandukLatar, borderColor: spandukGaris }]}>
          <Text variant="caption" style={{ color: kuning }}>{PERINGATAN_LAPOR_PESAN}</Text>
        </View>
        {galat ? <Text variant="caption" style={{ color: merah }}>{galat}</Text> : null}
        <Text variant="caption" style={s.tebal}>{labelPilihBukti(MAKS_BUKTI_LAPORAN)}</Text>
        <FlatList
          style={s.daftar}
          contentContainerStyle={s.isiDaftar}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          data={masuk}
          keyExtractor={(p) => p.id}
          ListEmptyComponent={<KeadaanKosong Ikon={MessageCircle} kalimat={KOSONG_BUKTI} />}
          renderItem={({ item }) => {
            const dipilihIni = dipilih.has(item.id);
            return (
              <Pressable
                onPress={() => alih(item.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: dipilihIni }}
                style={[s.baris, { borderColor: dipilihIni ? kuning : garis }]}
              >
                {dipilihIni ? <SquareCheck color={kuning} size={20} /> : <Square color={redup} size={20} />}
                <Text variant="body" style={s.menyusut}>{item.isi}</Text>
              </Pressable>
            );
          }}
        />
        <Input
          value={alasan}
          onChangeText={setAlasan}
          placeholder={placeholderAlasanLapor()}
          accessibilityLabel={placeholderAlasanLapor()}
          type="textarea"
          rows={3}
          maxLength={1000}
        />
        {petunjuk ? <Text variant="caption">{petunjuk}</Text> : null}
        <Button
          loading={sibuk}
          disabled={sibuk || !laporanSiapDikirim(dipilih.size, alasan)}
          onPress={() => { void kirim(); }}
        >
          {labelKirimLaporan(sibuk)}
        </Button>
      </View>
    </HindariKeyboard>
  );
}

const s = StyleSheet.create({
  muat: { flex: 1, padding: 16 },
  root: { flex: 1, padding: 16, gap: 12 },
  spanduk: { borderWidth: 1, borderRadius: RADIUS.kartu, padding: 12 },
  tebal: { fontWeight: "600" },
  daftar: { flex: 1 },
  isiDaftar: { gap: 8 },
  baris: {
    minHeight: UKURAN.sentuh,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: RADIUS.kartu,
    padding: 12,
  },
  menyusut: { flex: 1 },
});
