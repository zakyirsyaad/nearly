import { useCallback, useState } from "react";
import { Link, useFocusEffect, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { CONFIG } from "../../../../src/config";
import type { NearlySigner } from "../../../../src/signer";
import { useNearlySigner } from "../../../../src/dompet/konteks-dompet";
import { ApiError } from "../../../../src/http";
import { getCurrentCell, LocationDeniedError } from "../../../../src/location";
import { sesiPesan, type SesiPesan } from "../../../../src/pesan/sesi";
import { daftarkanPush } from "../../../../src/pesan/push";
import { getRadar, postDetak, type KartuRadarApi } from "../../../../src/radar/radar-api";
import {
  alamatSingkat, kalimatRadar, keadaanRadarDariDetak, keadaanRadarDariKode, lencanaKartuRadar,
  namaKartuRadar, type KeadaanRadar,
} from "../../../../src/messages";

/** Spec 4b+5 §8.2: detak setiap 60 detik, radar setiap 10 detik, hanya selama fokus. */
const JEDA_DETAK_MS = 60_000;
const JEDA_RADAR_MS = 10_000;

export default function RadarScreen() {
  const signer = useNearlySigner(CONFIG.verifyingContract);
  // Dompet belum siap — mis. sesaat setelah Ganti dompet, selagi layar ini
  // masih di tumpukan. Isi layar tidak dirender, supaya hook di dalamnya tidak
  // pernah berjalan tanpa signer (Ruling D4).
  if (!signer) return null;
  return <RadarScreenIsi key={signer.address} signer={signer} />;
}

function RadarScreenIsi({ signer }: { signer: NearlySigner }) {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const [kartu, setKartu] = useState<KartuRadarApi[] | null>(null);
  const [keadaan, setKeadaan] = useState<KeadaanRadar | null>(null);

  useFocusEffect(useCallback(() => {
    // Variabel efek, bukan state: timer yang sudah berjalan harus membaca
    // nilai terbaru tanpa efeknya dipasang ulang.
    let aktif = true;
    let hadir = false;
    let sesi: SesiPesan | null = null;

    const tampilkan = (k: KeadaanRadar) => {
      setKeadaan(k);
      // Galat jaringan tidak menghapus kartu yang sudah tampil; keadaan lain
      // berarti pemanggil memang tidak boleh melihat radar sekarang.
      if (k !== "server_tak_terjangkau") {
        hadir = false;
        setKartu(null);
      }
    };

    const ambilRadar = async () => {
      if (!sesi || !hadir) return;
      try {
        const r = await getRadar(sesi, eventId);
        if (!aktif) return;
        setKartu(r.kartu);
        setKeadaan(r.kartu.length === 0 ? "kosong" : null);
      } catch (e) {
        if (!aktif) return;
        const k = e instanceof ApiError ? keadaanRadarDariKode(e.code) : "gagal";
        if (k !== null) tampilkan(k);
      }
    };

    const kirimDetak = async () => {
      try {
        if (!sesi) {
          sesi = await sesiPesan(signer);
          void daftarkanPush(sesi);
        }
        const { cell } = await getCurrentCell();
        const jawaban = await postDetak(sesi, eventId, cell);
        if (!aktif) return;
        const k = keadaanRadarDariDetak(jawaban);
        if (k !== null) { tampilkan(k); return; }
        hadir = true;
        await ambilRadar();
      } catch (e) {
        if (!aktif) return;
        if (e instanceof LocationDeniedError) { tampilkan("izin_lokasi"); return; }
        const k = e instanceof ApiError ? keadaanRadarDariKode(e.code) : "gagal";
        if (k === null) {
          // terlalu_cepat: kehadiran dari detak sebelumnya masih berlaku.
          hadir = true;
          await ambilRadar();
          return;
        }
        tampilkan(k);
      }
    };

    void kirimDetak();
    const tDetak = setInterval(() => { void kirimDetak(); }, JEDA_DETAK_MS);
    const tRadar = setInterval(() => { void ambilRadar(); }, JEDA_RADAR_MS);
    // Kehilangan fokus: kedua timer berhenti. Tidak ada detak dari latar belakang (§10.1).
    return () => { aktif = false; clearInterval(tDetak); clearInterval(tRadar); };
  }, [eventId, signer]));

  if (kartu === null && keadaan === null) return <ActivityIndicator style={s.tengah} />;

  return (
    <View style={s.root}>
      {keadaan && <Text style={s.keadaan}>{kalimatRadar(keadaan)}</Text>}
      {keadaan === "tersembunyi" && (
        <Link href="/profil-saya" style={s.tautan}>Buka Profil saya</Link>
      )}
      {kartu && kartu.length > 0 && (
        <FlatList
          data={kartu}
          keyExtractor={(k) => k.address}
          renderItem={({ item: k }) => (
            // Bukan peta, tanpa jarak, arah, atau jam detak (spec 4b+5 §3).
            // Tidak ada tombol pesan: pesan tetap hanya lewat koneksi, dari profil.
            <Link href={`/profile/${k.address}`} style={s.kartu}>
              <Text style={s.nama}>{namaKartuRadar(k.displayName)}</Text>
              {"\n"}
              <Text style={s.alamat}>{alamatSingkat(k.address)} · {k.tierLabel}</Text>
              {lencanaKartuRadar(k).map((l) => (
                <Text key={l} style={s.lencana}>{"\n"}{l}</Text>
              ))}
            </Link>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, padding: 16, gap: 12 },
  tengah: { flex: 1 },
  keadaan: { fontSize: 15, lineHeight: 22, opacity: 0.8 },
  tautan: { fontSize: 15, fontWeight: "600", paddingVertical: 6 },
  kartu: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  nama: { fontSize: 16, fontWeight: "600" },
  alamat: { fontFamily: "Courier", fontSize: 12, opacity: 0.6 },
  lencana: { fontSize: 13, fontWeight: "500" },
});
