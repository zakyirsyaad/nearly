import { useCallback, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { Radar as IkonRadar } from "lucide-react-native";
import { KartuOrang } from "@/components/kartu-orang";
import { KeadaanGalat, KeadaanKosong, KerangkaDaftar } from "@/components/keadaan";
import { Lencana } from "@/components/lencana";
import { TautanKecil } from "@/components/tautan-kecil";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { MAKS_SKALA_HURUF_KECIL, RADIUS } from "@/theme/globals";
import { CONFIG } from "../../../../src/config";
import type { NearlySigner } from "../../../../src/signer";
import { useNearlySigner } from "../../../../src/dompet/konteks-dompet";
import { ApiError } from "../../../../src/http";
import { getCurrentCell, LocationDeniedError } from "../../../../src/location";
import { sesiPesan, type SesiPesan } from "../../../../src/pesan/sesi";
import { daftarkanPush } from "../../../../src/pesan/push";
import { getRadar, postDetak, type KartuRadarApi } from "../../../../src/radar/radar-api";
import {
  kalimatRadar, keadaanRadarDariDetak, keadaanRadarDariKode, lencanaKartuRadar, type KeadaanRadar,
} from "../../../../src/messages";
import {
  JUDUL_BELUM_DITEMUI, JUDUL_KONEKSI_DI_SINI, keteranganKartuRadar, pasanganTerlihatDiSini,
  PIL_TERLIHAT, pisahKartuRadar, radarBisaDicobaLagi, TEKS_BUKA_PROFIL_SAYA, TEKS_HANDSHAKE_KARTU,
  teksDiperbarui,
} from "../../../../src/teks-radar";
import { tierDariLabel } from "../../../../src/tier";

/** Spec 4b+5 §8.2: detak setiap 60 detik, radar setiap 10 detik, hanya selama fokus. */
const JEDA_DETAK_MS = 60_000;
const JEDA_RADAR_MS = 10_000;

/** Hasil radar terakhir yang berhasil, dengan jam HP saat diterima (spec desain UI §6.4). */
type HasilRadar = { kartu: KartuRadarApi[]; jumlah: number; pada: Date };

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
  const [radar, setRadar] = useState<HasilRadar | null>(null);
  const [keadaan, setKeadaan] = useState<KeadaanRadar | null>(null);
  // "Try again" memasang ulang efek fokus: detak segera, lalu jadwal biasa
  // (Ruling B2-12).
  const [percobaan, setPercobaan] = useState(0);
  const hijau = useColor("verified");

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
        setRadar(null);
      }
    };

    const ambilRadar = async () => {
      if (!sesi || !hadir) return;
      try {
        const r = await getRadar(sesi, eventId);
        if (!aktif) return;
        setRadar({ kartu: r.kartu, jumlah: r.jumlah, pada: new Date() });
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
    // Kehilangan fokus: kedua timer berhenti. Tidak ada detak dari latar
    // belakang (§10.1). Kartu dan keadaan juga dikosongkan (review minor m3):
    // tanpa ini, kartu dan pil "● Visible" lama masih tampil sesaat saat
    // layar difokuskan ulang, walau keadaan sebenarnya sudah berubah (mis.
    // pengguna beralih ke Hidden di tab Profile).
    return () => { aktif = false; clearInterval(tDetak); clearInterval(tRadar); setRadar(null); setKeadaan(null); };
  }, [eventId, signer, percobaan]));

  if (radar === null && keadaan === null) {
    return (
      <View style={s.muat}>
        <KerangkaDaftar />
      </View>
    );
  }

  const kini = new Date();
  const { koneksi, belum } = pisahKartuRadar(radar ? radar.kartu : []);

  return (
    <ScrollView contentContainerStyle={s.root} contentInsetAdjustmentBehavior="automatic">
      {radar ? (
        <View style={s.kepala}>
          {/* Radar hanya tampil bagi pemanggil yang Terlihat (gerbang spec 4b+5). */}
          <View style={[s.pil, { borderColor: hijau }]}>
            <Text variant="label" style={{ color: hijau }} maxFontSizeMultiplier={MAKS_SKALA_HURUF_KECIL}>
              {PIL_TERLIHAT}
            </Text>
          </View>
          {/* Nilai lebih keras dari labelnya (§7.1). */}
          <View style={s.barisNilai}>
            <Text variant="title">{pasanganTerlihatDiSini(radar.jumlah).angka}</Text>
            <Text variant="caption" style={s.menyusut}>{pasanganTerlihatDiSini(radar.jumlah).kata}</Text>
          </View>
          <Text variant="caption">{teksDiperbarui(radar.pada, kini)}</Text>
        </View>
      ) : null}

      {keadaan === "kosong" ? (
        <KeadaanKosong Ikon={IkonRadar} kalimat={kalimatRadar("kosong")} />
      ) : keadaan !== null && radarBisaDicobaLagi(keadaan) ? (
        <KeadaanGalat kalimat={kalimatRadar(keadaan)} onCobaLagi={() => setPercobaan((n) => n + 1)} />
      ) : keadaan !== null ? (
        <Text variant="body">{kalimatRadar(keadaan)}</Text>
      ) : null}

      {keadaan === "tersembunyi" ? (
        <TautanKecil label={TEKS_BUKA_PROFIL_SAYA} onPress={() => router.navigate("/profil-saya")} />
      ) : null}

      {koneksi.length > 0 ? <BagianRadar judul={JUDUL_KONEKSI_DI_SINI} kartu={koneksi} /> : null}
      {belum.length > 0 ? <BagianRadar judul={JUDUL_BELUM_DITEMUI} kartu={belum} /> : null}
    </ScrollView>
  );
}

/** Satu bagian: label redup + jumlah kartu yang lebih keras (§7.1), lalu kartunya dalam urutan server. */
function BagianRadar({ judul, kartu }: { judul: string; kartu: KartuRadarApi[] }) {
  return (
    <View style={s.bagian}>
      <View style={s.barisNilai}>
        <Text variant="caption" style={s.menyusut}>{judul}</Text>
        <Text variant="body" style={s.tebal}>{String(kartu.length)}</Text>
      </View>
      {kartu.map((k) => <KartuRadar key={k.address} k={k} />)}
    </View>
  );
}

/**
 * Bukan peta, tanpa jarak, arah, atau jam detak (spec 4b+5 §3). Tidak ada
 * tombol pesan: pesan tetap hanya lewat koneksi, dari profil.
 */
function KartuRadar({ k }: { k: KartuRadarApi }) {
  const saling = lencanaKartuRadar(k);
  return (
    <View style={s.kartu}>
      <KartuOrang
        nama={k.displayName}
        alamat={k.address}
        terverifikasi={k.pernahBertemu}
        lencana={
          k.pernahBertemu || saling ? (
            <View style={s.lencana}>
              {k.pernahBertemu ? <Lencana varian="ringkas" /> : null}
              {saling ? <Lencana varian="teks" teks={saling} /> : null}
            </View>
          ) : undefined
        }
        keterangan={keteranganKartuRadar(k)}
        tier={tierDariLabel(k.tierLabel)}
        onPress={() => router.push(`/profile/${k.address}`)}
      />
      {!k.pernahBertemu ? (
        <TautanKecil label={TEKS_HANDSHAKE_KARTU} onPress={() => router.navigate("/salaman")} />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  muat: { flex: 1, padding: 16 },
  root: { padding: 16, paddingBottom: 32, gap: 24 },
  kepala: { gap: 8 },
  pil: { alignSelf: "flex-start", borderWidth: 1, borderRadius: RADIUS.lencana, paddingHorizontal: 8 },
  barisNilai: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  menyusut: { flexShrink: 1 },
  tebal: { fontWeight: "600" },
  bagian: { gap: 12 },
  kartu: { gap: 4 },
  lencana: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
