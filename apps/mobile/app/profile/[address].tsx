import { useCallback, useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Keyboard, Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { Address } from "viem";
import { Avatar } from "@/components/avatar";
import { BatangTrust } from "@/components/batang-trust";
import { KeadaanGalat, KerangkaDaftar } from "@/components/keadaan";
import { Lencana } from "@/components/lencana";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { useKabar } from "@/hooks/useKabar";
import { RADIUS, UKURAN } from "@/theme/globals";
import { CONFIG } from "../../src/config";
import { pesanGagal } from "../../src/errors";
import { ApiError, req } from "../../src/http";
import { aksiBlokir } from "../../src/blokir-actions";
import { aksiTanda } from "../../src/meet-actions";
import { kueriBuktiProfil } from "../../src/meet-api";
import {
  blokirErrorMessage, blokirTombolLabel, meetErrorMessage, meetSuccessMessage, namaKartuRadar,
  teksInginBertemuCount, tombolTandaLabel,
} from "../../src/messages";
import {
  barisAcaraBersama, barisSalaman, ekorLencanaPertemuan, JUDUL_ONCHAIN, JUDUL_PERTEMUAN,
  JUDUL_TRUST, labelKirimLaporan, labelKirimVouch, pasanganKoneksi, pasanganTransaksi,
  teksBlokirTersimpanGagalMuat, teksDijaminKenalan, teksGagalBlokir, TEKS_CATATAN_DIBLOKIR,
  TEKS_GAGAL_MENANDAI, TEKS_GAGAL_MUAT_PROFIL, TEKS_KIRIM_PESAN, TEKS_KUOTA_VOUCH,
  TEKS_LABEL_ALASAN, TEKS_LAPOR, TEKS_LAPORAN_DITERIMA, TEKS_PLACEHOLDER_ALASAN,
  TEKS_SALING_INGIN_BERTEMU, TEKS_SELESAI, TEKS_TANDA_TERSIMPAN_GAGAL_MUAT, TEKS_VOUCH,
  TEKS_VOUCH_TERKIRIM, type Pertemuan,
} from "../../src/teks-profil";
import { labelAksesTrust, SUGGESTED_TAGS, tierView } from "../../src/tier";
import { fetchTrust, sendReport, sendVouch, type TrustResponse } from "../../src/trust-api";
import { useNearlySigner } from "../../src/dompet/konteks-dompet";

type Profile = {
  address: string; displayName: string; ens: string | null;
  txCount: number; connectionCount: number;
  /**
   * Angka publik (spec §8) — tidak butuh bukti apa pun. Tapi BENAR-BENAR
   * opsional: server menghilangkan kuncinya kalau store gagal menjawab,
   * justru supaya kegagalan itu tidak menyamar sebagai `0` (lihat GET
   * /profile/:address). Dirender lewat `teksInginBertemuCount`, bukan
   * `?? 0` — "0 people want to meet them" adalah klaim faktual tentang orang
   * lain, dan mengarangnya dari store yang mati adalah bohong.
   */
  inginBertemuCount?: number;
  /**
   * ABSEN (bukan `false`) kalau bukti baca gagal atau tidak dikirim — server
   * hanya menyertakan bendera ini untuk pemanggil yang membuktikan dirinya
   * (lihat GET /profile/:address). Absen berarti "tidak diketahui", BUKAN
   * "belum kamu tandai" — dua hal itu tidak sama, dan menyamakannya membuat
   * layar ini berbohong.
   */
  sudahKutandai?: boolean;
  salingMenandai?: boolean;
  /**
   * ABSEN (bukan `false`) untuk alasan yang sama persis dengan
   * `sudahKutandai`: siapa memblokir siapa bukan informasi publik, jadi
   * server hanya menyertakannya untuk pemanggil yang bukti bacanya berhasil.
   * Absen berarti "tidak diketahui" — layar ini WAJIB memeriksa
   * `!== undefined`, bukan truthiness, atau "tidak diketahui" akan diam-diam
   * dibaca sebagai "belum diblokir".
   */
  sudahKublokir?: boolean;
  /**
   * Riwayat pertemuan (spec desain UI §8.1). `null` = pemanggil dan orang ini
   * tidak terkoneksi, atau ini profil sendiri. Kunci ABSEN = store gagal;
   * keduanya berarti tidak ada kartu Meetings dan tidak ada lencana.
   */
  pertemuan?: Pertemuan | null;
  /** Penjamin yang juga koneksimu (spec §8.2). Absen = store gagal, bukan nol. */
  dijaminKenalan?: number;
};

export default function ProfileScreen() {
  const { address } = useLocalSearchParams<{ address: string }>();
  const scrollRef = useRef<ScrollView>(null);

  /**
   * Menggulirkan isian ke atas keyboard.
   *
   * Tanpa ini, membuka form laporan meninggalkan kotak isiannya di belakang
   * keyboard dan tidak ada yang memindahkannya — pengguna mengetik ke sesuatu
   * yang tidak bisa dilihatnya. Jeda 150 ms menunggu animasi keyboard selesai;
   * dipanggil lebih awal, viewport belum menyusut dan gulirannya berhenti di
   * posisi lama.
   */
  const gulirKeIsian = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
  };
  const [p, setP] = useState<Profile | null>(null);
  const [trust, setTrust] = useState<TrustResponse | null>(null);
  const kabar = useKabar();
  const kuning = useColor("primary");
  const garis = useColor("border");

  // Null sesaat setelah Ganti dompet; layar ini memang sudah menangani signer
  // null, jadi tidak perlu dipecah seperti layar lain (Ruling D4).
  const signer = useNearlySigner(CONFIG.verifyingContract);
  const isOwnProfile = !!signer && !!address
    && signer.address.toLowerCase() === address.toLowerCase();

  const [connected, setConnected] = useState<boolean | null>(null);

  // Pesan sendiri, TERPISAH dari vouchMessage: tombol "Want to meet" tampil
  // untuk siapa pun yang bukti bacanya berhasil, terlepas dari `connected`
  // (dua orang bisa saling menandai lewat feed tanpa pernah terkoneksi).
  const [meetMessage, setMeetMessage] = useState<string | null>(null);
  // Sedang menandai/mencabut — dipakai untuk menolak ketukan kedua sebelum
  // yang pertama selesai dan untuk memberi tahu pengguna bahwa ketukannya
  // sudah terdaftar, bukan diam saja.
  const [meetBusy, setMeetBusy] = useState(false);

  // Sama seperti meetMessage/meetBusy di atas, tapi untuk aksi blokir —
  // TERPISAH supaya pesan blokir tidak menimpa pesan tanda atau sebaliknya.
  const [blokirMessage, setBlokirMessage] = useState<string | null>(null);
  const [blokirBusy, setBlokirBusy] = useState(false);

  // Kegagalan MEMUAT profil (bukan kegagalan membuat bukti baca — itu
  // ditangani secara terpisah di bawah dan tidak boleh menutup profil publik).
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showVouchPicker, setShowVouchPicker] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [vouchBusy, setVouchBusy] = useState(false);
  const [vouchMessage, setVouchMessage] = useState<string | null>(null);

  const [showReportForm, setShowReportForm] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportMessage, setReportMessage] = useState<string | null>(null);

  const muatProfil = useCallback(async () => {
    setLoadError(null);
    // Bukti baca (LihatProfil) hanya disertakan kalau ada signer — tanpa
    // itu server tetap membalas dengan angka publiknya saja, dan bendera
    // sudahKutandai/salingMenandai/pertemuan/dijaminKenalan memang absen.
    //
    // Kegagalan MEMBUAT buktinya ditangkap DI SINI, terpisah dari permintaan
    // profilnya sendiri — endpoint ini publik, dan bukti hanya membuka
    // bendera privat tambahan.
    let kueri = "";
    if (signer && address) {
      try {
        kueri = `?${await kueriBuktiProfil(signer, address as Address)}`;
      } catch { /* lanjut sebagai pemanggil tanpa bukti, bukan gagal total */ }
    }
    try {
      // `req` melempar ApiError kalau responsnya bukan 2xx — tanpa ini, badan
      // galat dari server bisa lolos ke `setP` dan dirender seolah profil.
      setP(await req<Profile>(`/profile/${address}${kueri}`));
    } catch {
      setLoadError(TEKS_GAGAL_MUAT_PROFIL);
    }
  }, [address, signer]);

  useEffect(() => { void muatProfil(); }, [muatProfil]);

  useEffect(() => {
    if (!address) return;
    fetchTrust(address as Address).then(setTrust).catch(() => {});
  }, [address]);

  useEffect(() => {
    if (!signer || !address || isOwnProfile) { setConnected(null); return; }
    // Endpoint khusus ya/tidak, BUKAN menarik daftar koneksi — daftar itu
    // dibatasi 100 terbaru dan akan salah untuk pasangan yang koneksinya
    // lebih lama dari itu (lihat GET /connected/:a/:b di apps/api).
    req<{ connected?: boolean }>(`/connected/${signer.address}/${address}`)
      .then((j) => setConnected(!!j.connected))
      .catch(() => setConnected(false));
  }, [signer, address, isOwnProfile]);

  function toggleTag(tag: string) {
    setSelectedTags((prev) => (
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    ));
  }

  async function handleVouch() {
    if (!signer || selectedTags.length === 0) return;
    setVouchBusy(true);
    setVouchMessage(null);
    try {
      await sendVouch(signer, address as Address, selectedTags);
      setSelectedTags([]);
      setShowVouchPicker(false);
      // Aksi penting → toast hijau + haptic (spec §7.2), bukan teks di layar.
      kabar.berhasil(TEKS_VOUCH_TERKIRIM);
      // Muat ulang bukti — tier atau evidenceLine bisa langsung berubah.
      fetchTrust(address as Address).then(setTrust).catch(() => {});
    } catch (e) {
      // Kode kegagalan mentah dari server tidak pernah tampil apa adanya.
      setVouchMessage(e instanceof Error ? pesanGagal(e.message) : pesanGagal(""));
    } finally {
      setVouchBusy(false);
    }
  }

  async function handleReport() {
    if (!signer || !reportReason.trim()) return;
    setReportBusy(true);
    try {
      await sendReport(signer, address as Address, reportReason.trim());
      Keyboard.dismiss();
      setShowReportForm(false);
      setReportReason("");
      setReportMessage(null);
      // Kalimat ini bukan hiasan: ia mencegah pengguna mengira Report adalah
      // senjata yang menurunkan skor orang lain (spec induk §6).
      kabar.berhasil(TEKS_LAPORAN_DITERIMA);
    } catch (e) {
      setReportMessage(e instanceof Error ? pesanGagal(e.message) : pesanGagal(""));
    } finally {
      setReportBusy(false);
    }
  }

  async function toggleTanda() {
    if (!signer || !address || meetBusy) return;
    // Dibersihkan di AWAL, bukan setelah `aksiTanda` berhasil — kalau tidak,
    // pesan galat percobaan sebelumnya nongkrong di layar sepanjang percobaan
    // berikutnya, termasuk selama request ini berjalan.
    setMeetMessage(null);
    setMeetBusy(true);
    const akanMencabut = !!p?.sudahKutandai;
    try {
      await aksiTanda(signer, address as Address, akanMencabut);
    } catch (e) {
      setMeetMessage(e instanceof ApiError ? meetErrorMessage(e.code) : TEKS_GAGAL_MENANDAI);
      setMeetBusy(false);
      return;
    }
    // Tandanya SUDAH tersimpan di server pada titik ini. Kegagalan di bawah
    // (memuat ulang) adalah kegagalan yang BERBEDA dari kegagalan menandai —
    // memakai kalimat "gagal menandai" di sini akan membohongi pengguna
    // tentang aksi yang justru berhasil.
    try {
      const kueri = `?${await kueriBuktiProfil(signer, address as Address)}`;
      setP(await req<Profile>(`/profile/${address}${kueri}`));
      // Kalimat "menandai"-nya SAMA PERSIS dengan yang diucapkan kartu feed
      // untuk aksi yang sama — lihat meetSuccessMessage.
      setMeetMessage(meetSuccessMessage(!akanMencabut));
    } catch {
      setMeetMessage(TEKS_TANDA_TERSIMPAN_GAGAL_MUAT);
    } finally {
      setMeetBusy(false);
    }
  }

  // Mengikuti pola toggleTanda persis: pesan dibersihkan di AWAL, ketukan
  // ganda ditolak lewat blokirBusy, dan kegagalan AKSI dipisahkan dari
  // kegagalan MUAT ULANG sesudahnya.
  async function toggleBlokir() {
    if (!signer || !address || blokirBusy) return;
    setBlokirMessage(null);
    setBlokirBusy(true);
    const akanMencabut = !!p?.sudahKublokir;
    try {
      await aksiBlokir(signer, address as Address, akanMencabut);
    } catch (e) {
      setBlokirMessage(e instanceof ApiError ? blokirErrorMessage(e.code) : teksGagalBlokir(akanMencabut));
      setBlokirBusy(false);
      return;
    }
    try {
      const kueri = `?${await kueriBuktiProfil(signer, address as Address)}`;
      setP(await req<Profile>(`/profile/${address}${kueri}`));
    } catch {
      setBlokirMessage(teksBlokirTersimpanGagalMuat(akanMencabut));
    } finally {
      setBlokirBusy(false);
    }
  }

  if (!p) {
    // `loadError` hanya terisi kalau permintaan profilnya sendiri gagal (bukan
    // kalau hanya pembuatan buktinya yang gagal) — lihat `muatProfil`. Tanpa
    // cabang ini, kegagalan jaringan membekukan layar di keadaan memuat
    // selamanya, tanpa pesan dan tanpa jalan keluar.
    return (
      <View style={s.memuat}>
        {loadError
          ? <KeadaanGalat kalimat={loadError} onCobaLagi={() => void muatProfil()} />
          : <KerangkaDaftar baris={4} />}
      </View>
    );
  }

  const teksInginBertemu = teksInginBertemuCount(p.inginBertemuCount);
  const labelTombolTanda = tombolTandaLabel(
    p.sudahKutandai, { milikSendiri: isOwnProfile, sibuk: meetBusy },
  );
  // Hanya untuk koneksi (spec 4c §4). Server tetap menegakkan gerbangnya
  // sendiri — tombol ini kenyamanan, bukan pengaman.
  const bolehKirimPesan = !!signer && !isOwnProfile && connected === true;
  const adaBarisAksi = bolehKirimPesan || labelTombolTanda !== null;
  const penjamin = teksDijaminKenalan(p.dijaminKenalan);
  const kini = new Date();

  return (
    // Alasan laporan itu multiline, jadi tombol return menyisipkan baris baru
    // dan TIDAK menutup keyboard. iOS juga TIDAK mendukung inputAccessoryViewID
    // pada isian multiline, jadi batang menempel keyboard bukan pilihan. Yang
    // menggantikannya tiga hal: automaticallyAdjustKeyboardInsets,
    // gulirKeIsian(), dan tombol "Done" DI ATAS isian.
    <ScrollView
      ref={scrollRef}
      style={s.flex}
      contentContainerStyle={s.root}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <View style={s.kepala}>
        <Avatar
          nama={p.displayName || null}
          alamat={p.address}
          ukuran={UKURAN.avatarKepala}
          cincin={p.pertemuan ? "verified" : "avatarAwal"}
        />
        {/* Nama boleh apa saja dan TIDAK unik. Alamat SELALU tampil di
            bawahnya — nama bukan identitas, alamat-lah identitasnya (§9.2). */}
        <Text variant="heading">{namaKartuRadar(p.displayName)}</Text>
        <Text variant="mono" selectable>{p.ens ?? p.address}</Text>
        {p.ens ? <Text variant="mono" selectable>{p.address}</Text> : null}
        {p.pertemuan ? <Lencana varian="terverifikasi" ekor={ekorLencanaPertemuan(p.pertemuan)} /> : null}
      </View>

      {/* #16A: aksi yang paling mungkin diambil terlihat tanpa menggulir. */}
      {adaBarisAksi ? (
        <View style={s.bagian}>
          <View style={s.barisAksi}>
            {bolehKirimPesan ? (
              <Button style={s.tombolAksi} onPress={() => router.navigate(`/pesan/${address}`)}>
                {TEKS_KIRIM_PESAN}
              </Button>
            ) : null}
            {labelTombolTanda !== null ? (
              <Button
                variant="secondary"
                style={s.tombolAksi}
                disabled={meetBusy}
                onPress={() => void toggleTanda()}
              >
                {labelTombolTanda}
              </Button>
            ) : null}
          </View>
          {teksInginBertemu !== null ? <Text variant="caption">{teksInginBertemu}</Text> : null}
          {p.salingMenandai ? <Text variant="caption">{TEKS_SALING_INGIN_BERTEMU}</Text> : null}
          {meetMessage ? <Text variant="caption">{meetMessage}</Text> : null}
        </View>
      ) : null}

      {/* Tier SELALU tampil bersama buktinya, tidak pernah sebagai angka
          telanjang (spec induk §8); nilainya dominan atas labelnya (#16A). */}
      {trust ? (
        <Card style={s.kartu}>
          <View accessible accessibilityLabel={labelAksesTrust(trust.tier)} style={s.grupTrust}>
            <Text variant="caption">{JUDUL_TRUST}</Text>
            <Text variant="title">{tierView(trust.tier, trust.evidence).label}</Text>
            <BatangTrust tier={trust.tier} />
          </View>
          <Text variant="caption">{tierView(trust.tier, trust.evidence).evidenceLine}</Text>
          {penjamin ? <Text variant="caption">{penjamin}</Text> : null}
        </Card>
      ) : null}

      {p.pertemuan ? (
        <Card style={s.kartu}>
          <Text variant="caption">{JUDUL_PERTEMUAN}</Text>
          <View style={s.barisNilai}>
            <Text variant="body" style={s.tebal}>{barisSalaman(p.pertemuan, kini).judul}</Text>
            <Text variant="caption">{barisSalaman(p.pertemuan, kini).tanggal}</Text>
          </View>
          {p.pertemuan.acaraBersama.map((a) => (
            <Text key={a.eventId} variant="caption">{barisAcaraBersama(a, kini)}</Text>
          ))}
        </Card>
      ) : null}

      <Card style={s.kartu}>
        <Text variant="caption">{JUDUL_ONCHAIN}</Text>
        <View style={s.barisNilai}>
          <Text variant="title">{pasanganKoneksi(p.connectionCount).angka}</Text>
          <Text variant="caption">{pasanganKoneksi(p.connectionCount).kata}</Text>
        </View>
        <View style={s.barisNilai}>
          <Text variant="title">{pasanganTransaksi(p.txCount).angka}</Text>
          <Text variant="caption">{pasanganTransaksi(p.txCount).kata}</Text>
        </View>
      </Card>

      {signer && !isOwnProfile && connected ? (
        <View style={s.bagian}>
          <View style={s.barisNilai}>
            <Button variant="outline" onPress={() => setShowVouchPicker((v) => !v)}>{TEKS_VOUCH}</Button>
            {/* Server-lah satu-satunya yang benar-benar tahu sisa kuota;
                angka yang bisa basi lebih buruk daripada tanpa angka. */}
            <Text variant="caption">{TEKS_KUOTA_VOUCH}</Text>
          </View>

          {showVouchPicker ? (
            <View style={s.bagian}>
              <View style={s.tag}>
                {SUGGESTED_TAGS.map((tag) => {
                  const dipilih = selectedTags.includes(tag);
                  return (
                    <Pressable
                      key={tag}
                      onPress={() => toggleTag(tag)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: dipilih }}
                      style={[s.pil, { borderColor: dipilih ? kuning : garis }]}
                    >
                      <Text variant="caption" style={dipilih ? { color: kuning } : undefined}>{tag}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Button
                disabled={vouchBusy || selectedTags.length === 0}
                loading={vouchBusy}
                onPress={() => void handleVouch()}
              >
                {labelKirimVouch(vouchBusy)}
              </Button>
            </View>
          ) : null}

          {vouchMessage ? <Text variant="caption">{vouchMessage}</Text> : null}
        </View>
      ) : null}

      {signer && !isOwnProfile ? (
        <View style={s.bagian}>
          <Button
            variant="outline"
            onPress={() => {
              setShowReportForm((v) => !v);
              gulirKeIsian();
            }}
          >
            {TEKS_LAPOR}
          </Button>

          {showReportForm ? (
            <View style={s.bagian}>
              {/* "Done" duduk DI ATAS isian, bukan di bawahnya: yang di bawah
                  akan tertutup keyboard, persis masalah yang mau diselesaikan. */}
              <View style={s.barisNilai}>
                <Text variant="caption">{TEKS_LABEL_ALASAN}</Text>
                <Pressable onPress={() => Keyboard.dismiss()} hitSlop={12} accessibilityRole="button">
                  <Text variant="label" style={{ color: kuning }}>{TEKS_SELESAI}</Text>
                </Pressable>
              </View>
              <Input
                placeholder={TEKS_PLACEHOLDER_ALASAN}
                value={reportReason}
                onChangeText={setReportReason}
                onFocus={gulirKeIsian}
                type="textarea"
              />
              <Button
                disabled={reportBusy || !reportReason.trim()}
                loading={reportBusy}
                onPress={() => void handleReport()}
              >
                {labelKirimLaporan(reportBusy)}
              </Button>
            </View>
          ) : null}

          {reportMessage ? <Text variant="caption">{reportMessage}</Text> : null}
        </View>
      ) : null}

      {/*
        `sudahKublokir !== undefined`, BUKAN cek truthiness — absen berarti
        "tidak diketahui" (bukti baca gagal/tidak dikirim), dan melonggarkannya
        ke truthiness diam-diam membuat "tidak diketahui" jadi "belum
        diblokir". Tombol tanda di atas TIDAK ikut disembunyikan: mencabut
        tanda yang sudah ada tetap boleh saat terblokir, hanya MEMASANG tanda
        baru yang ditolak server.
      */}
      {p.sudahKublokir !== undefined && !isOwnProfile ? (
        <View style={s.bagian}>
          <Button variant="destructive" disabled={blokirBusy} onPress={() => { void toggleBlokir(); }}>
            {blokirTombolLabel(p.sudahKublokir, blokirBusy)}
          </Button>
          {p.sudahKublokir ? <Text variant="caption">{TEKS_CATATAN_DIBLOKIR}</Text> : null}
          {blokirMessage ? <Text variant="caption">{blokirMessage}</Text> : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  root: { padding: 16, paddingBottom: 32, gap: 24 },
  memuat: { flex: 1, padding: 16 },
  kepala: { alignItems: "center", gap: 8 },
  bagian: { gap: 12 },
  barisAksi: { flexDirection: "row", gap: 8 },
  tombolAksi: { flex: 1 },
  kartu: { gap: 8 },
  grupTrust: { gap: 8 },
  barisNilai: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
  tag: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pil: {
    borderWidth: 1,
    borderRadius: RADIUS.lencana,
    paddingHorizontal: 12,
    minHeight: UKURAN.sentuh,
    justifyContent: "center",
  },
  tebal: { fontWeight: "600" },
});
