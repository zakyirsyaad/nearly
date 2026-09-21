import { useCallback, useEffect, useState } from "react";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { periksaNamaTampilan, type Visibilitas } from "@nearly/shared";
import { BatangTrust } from "@/components/batang-trust";
import { KeadaanGalat } from "@/components/keadaan";
import { Lencana } from "@/components/lencana";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { useKabar } from "@/hooks/useKabar";
import { useMuatSaatFokus } from "@/hooks/useMuatSaatFokus";
import { RADIUS, UKURAN } from "@/theme/globals";
import { CONFIG } from "../../../src/config";
import type { NearlySigner } from "../../../src/signer";
import { useNearlySigner } from "../../../src/dompet/konteks-dompet";
import { ApiError, req } from "../../../src/http";
import { useLencana } from "../../../src/lencana/konteks-lencana";
import { sesiPesan } from "../../../src/pesan/sesi";
import { getProfilSaya, simpanProfil } from "../../../src/radar/radar-api";
import {
  KALIMAT_BATAS_TERSEMBUNYI, kalimatVisibilitas, labelSimpanProfil,
  pesanNamaTidakSah, profilErrorMessage, sisaKarakterNama, teksLencana,
} from "../../../src/messages";
import {
  CATATAN_NAMA, LABEL_NAMA_TAMPILAN, LABEL_TERLIHAT, LABEL_TERSEMBUNYI, LABEL_VISIBILITAS,
  PLACEHOLDER_NAMA, TAUTAN_BLOKIR, TAUTAN_DOMPET, TAUTAN_KECOCOKAN, TAUTAN_KONEKSI,
  TEKS_GAGAL_MUAT_PROFIL_SAYA, TEKS_GAGAL_SIMPAN, TEKS_TERSIMPAN,
} from "../../../src/teks-akun";
import { pasanganKoneksi } from "../../../src/teks-profil";
import { fetchTrust, type TrustResponse } from "../../../src/trust-api";

const MODE: { nilai: Visibilitas; judul: string }[] = [
  { nilai: "terlihat", judul: LABEL_TERLIHAT },
  { nilai: "tersembunyi", judul: LABEL_TERSEMBUNYI },
];

export default function ProfilSayaScreen() {
  const signer = useNearlySigner(CONFIG.verifyingContract);
  // Dompet belum siap — mis. sesaat setelah Ganti dompet, selagi layar ini
  // masih di tumpukan. Isi layar tidak dirender, supaya hook di dalamnya tidak
  // pernah berjalan tanpa signer (Ruling D4).
  if (!signer) return null;
  return <ProfilSayaScreenIsi key={signer.address} signer={signer} />;
}

/** Satu baris tautan di daftar bawah, setinggi target sentuh (spec §3.7). */
function BarisTautan({
  label,
  lencana,
  onPress,
}: {
  label: string;
  lencana?: string | null;
  onPress: () => void;
}) {
  const redup = useColor("textMuted");
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={s.tautan}>
      {/* Label panjang ("Address, 12-word recovery phrase, …") membungkus,
          tidak mendorong chevron keluar kartu. */}
      <Text variant="body" style={[s.tebal, s.menyusut]}>{label}</Text>
      <View style={s.ujungTautan}>
        {lencana ? <Lencana varian="teks" teks={lencana} /> : null}
        {/* Tanda baris navigasi (catatan eksekutor B1 E2); dekoratif. */}
        <ChevronRight color={redup} size={20} />
      </View>
    </Pressable>
  );
}

function ProfilSayaScreenIsi({ signer }: { signer: NearlySigner }) {
  const [nama, setNama] = useState("");
  // Nama yang TERSIMPAN di server, terpisah dari isian (review B1 M4): kepala
  // tidak ikut berubah selagi nama diketik, dan tidak mengaku "Unnamed" saat
  // profilnya gagal dimuat. null = belum diketahui atau kosong.
  const [namaTersimpan, setNamaTersimpan] = useState<string | null>(null);
  const [visibilitas, setVisibilitas] = useState<Visibilitas>("terlihat");
  const [dimuat, setDimuat] = useState(false);
  const [galatMuat, setGalatMuat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const [koneksi, setKoneksi] = useState<number | null>(null);
  const [trust, setTrust] = useState<TrustResponse | null>(null);
  const { kecocokanBaru } = useLencana();
  const kabar = useKabar();
  const merah = useColor("destructive");
  const garis = useColor("border");
  const kuning = useColor("primary");

  // Formulir terbuka HANYA setelah profil tersimpan berhasil dibaca (review B1
  // #I4). Nilai bawaannya (nama kosong, "terlihat") bukan pilihan pengguna:
  // membukanya setelah gagal muat berarti satu Save bisa membuat orang yang
  // memilih Hidden tampil di radar. Tidak dimuat ulang saat fokus — itu akan
  // menimpa nama yang sedang diketik.
  const muatProfil = useCallback(async () => {
    setGalatMuat(null);
    try {
      const p = await getProfilSaya(await sesiPesan(signer));
      setNama(p.displayName);
      setNamaTersimpan(p.displayName.trim() || null);
      setVisibilitas(p.visibilitas);
      setDimuat(true);
    } catch (e) {
      setGalatMuat(e instanceof ApiError ? profilErrorMessage(e.code) : TEKS_GAGAL_MUAT_PROFIL_SAYA);
    }
  }, [signer]);

  useEffect(() => {
    void muatProfil();
  }, [muatProfil]);

  // Kepala: angka publik dan tier sendiri. Gagal sendiri — kepala yang tidak
  // lengkap tidak boleh menutup bagian nama dan visibilitas di bawahnya.
  const muatKepala = useCallback(async () => {
    const [koneksiOk, trustOk] = await Promise.all([
      req<{ connectionCount: number }>(`/profile/${signer.address}`)
        .then((p) => { setKoneksi(p.connectionCount); return true; })
        .catch(() => false),
      fetchTrust(signer.address)
        .then((t) => { setTrust(t); return true; })
        .catch(() => false),
    ]);
    return koneksiOk && trustOk;
  }, [signer.address]);

  // Tab tetap terpasang (expo-router 57): tanpa ini angka koneksi dan tier
  // tidak pernah berubah setelah salaman atau vouch. Dibatasi sekali per 30
  // detik, kecuali data berubah atau muat sebelumnya gagal (spec §4.6, M7).
  useMuatSaatFokus(muatKepala);

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
      setNamaTersimpan(cek.nama.trim() || null);
      setPesan(null);
      // Aksi penting → toast hijau + haptic (spec §7.2).
      kabar.berhasil(TEKS_TERSIMPAN);
    } catch (e) {
      setPesan(e instanceof ApiError ? profilErrorMessage(e.code) : TEKS_GAGAL_SIMPAN);
    } finally {
      setSibuk(false);
    }
  }

  const sisa = sisaKarakterNama(nama);
  const pasangan = koneksi === null ? null : pasanganKoneksi(koneksi);

  return (
    <ScrollView
      contentContainerStyle={s.root}
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
    >
      <View style={s.kepala}>
        {namaTersimpan ? <Text variant="title">{namaTersimpan}</Text> : null}
        {/* Alamat UTUH di layar detail milikmu sendiri (R4). */}
        <Text variant="mono" selectable>{signer.address}</Text>
        {pasangan ? (
          <View style={s.barisNilai}>
            <Text variant="title">{pasangan.angka}</Text>
            <Text variant="caption">{pasangan.kata}</Text>
          </View>
        ) : null}
        {trust ? <BatangTrust tier={trust.tier} denganLabel /> : null}
      </View>

      {galatMuat ? (
        <KeadaanGalat kalimat={galatMuat} onCobaLagi={() => void muatProfil()} />
      ) : (
        <>
          <View style={s.bagian}>
            <Text variant="caption">{LABEL_NAMA_TAMPILAN}</Text>
            <Input
              value={nama}
              onChangeText={setNama}
              placeholder={PLACEHOLDER_NAMA}
              editable={dimuat && !sibuk}
              autoCorrect={false}
            />
            {/* Penghitung code point, bukan maxLength — maxLength menghitung unit UTF-16 dan memotong emoji. */}
            <Text variant="caption" style={[s.penghitung, sisa < 0 ? { color: merah } : null]}>{sisa}</Text>
            <Text variant="caption">{CATATAN_NAMA}</Text>
          </View>

          <View style={s.bagian}>
            <Text variant="caption">{LABEL_VISIBILITAS}</Text>
            {MODE.map((m) => {
              const terpilih = visibilitas === m.nilai;
              return (
                <Pressable
                  key={m.nilai}
                  onPress={() => setVisibilitas(m.nilai)}
                  disabled={!dimuat || sibuk}
                  style={[s.mode, { borderColor: terpilih ? kuning : garis }]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: terpilih }}
                >
                  <Text variant="body" style={s.tebal}>{terpilih ? "● " : "○ "}{m.judul}</Text>
                  <Text variant="caption">{kalimatVisibilitas(m.nilai)}</Text>
                </Pressable>
              );
            })}
            <Text variant="caption">{KALIMAT_BATAS_TERSEMBUNYI}</Text>
            <Button onPress={() => void simpan()} loading={sibuk} disabled={!dimuat || sibuk || sisa < 0}>
              {labelSimpanProfil(sibuk)}
            </Button>
            {pesan ? <Text variant="caption">{pesan}</Text> : null}
          </View>
        </>
      )}

      <Card style={s.daftar}>
        <BarisTautan label={TAUTAN_KONEKSI} onPress={() => router.push("/connections")} />
        <BarisTautan
          label={TAUTAN_KECOCOKAN}
          lencana={teksLencana(kecocokanBaru)}
          onPress={() => router.push("/kecocokan")}
        />
        <BarisTautan label={TAUTAN_DOMPET} onPress={() => router.push("/dompet")} />
        <BarisTautan label={TAUTAN_BLOKIR} onPress={() => router.push("/blokir")} />
      </Card>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { padding: 16, paddingBottom: 32, gap: 24 },
  kepala: { gap: 8 },
  barisNilai: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  bagian: { gap: 8 },
  penghitung: { alignSelf: "flex-end" },
  mode: { borderWidth: 1, borderRadius: RADIUS.kartu, padding: 12, gap: 4 },
  daftar: { gap: 4 },
  tautan: {
    minHeight: UKURAN.sentuh,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  tebal: { fontWeight: "600" },
  menyusut: { flexShrink: 1 },
  ujungTautan: { flexDirection: "row", alignItems: "center", gap: 8 },
});
