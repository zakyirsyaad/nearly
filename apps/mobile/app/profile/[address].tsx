import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  Button, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import type { Address } from "viem";
import { CONFIG } from "../../src/config";
import { pesanGagal } from "../../src/errors";
import { ApiError, req } from "../../src/http";
import { aksiBlokir } from "../../src/blokir-actions";
import { aksiTanda } from "../../src/meet-actions";
import { kueriBuktiProfil } from "../../src/meet-api";
import {
  blokirErrorMessage, blokirTombolLabel,
  meetErrorMessage, meetSuccessMessage, teksInginBertemuCount, tombolTandaLabel,
} from "../../src/messages";
import { createDevSigner } from "../../src/signer";
import { SUGGESTED_TAGS, tierView } from "../../src/tier";
import { fetchTrust, sendReport, sendVouch, type TrustResponse } from "../../src/trust-api";

type Profile = {
  address: string; displayName: string; ens: string | null;
  txCount: number; connectionCount: number;
  /**
   * Angka publik (spec §8) — tidak butuh bukti apa pun. Tapi BENAR-BENAR
   * opsional: server menghilangkan kuncinya kalau store gagal menjawab,
   * justru supaya kegagalan itu tidak menyamar sebagai `0` (lihat GET
   * /profile/:address). Dirender lewat `teksInginBertemuCount`, bukan
   * `?? 0` — "0 orang ingin bertemu dia" adalah klaim faktual tentang orang
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

  // Signer pengembangan, sama seperti layar lain di Fase 1 — wallet sungguhan
  // menyusul setelah alur ini terbukti jalan (lihat catatan di index.tsx).
  const signer = useMemo(
    () => (CONFIG.devPrivateKey
      ? createDevSigner(CONFIG.devPrivateKey, CONFIG.verifyingContract)
      : null),
    [],
  );
  const isOwnProfile = !!signer && !!address
    && signer.address.toLowerCase() === address.toLowerCase();

  const [connected, setConnected] = useState<boolean | null>(null);

  // Pesan sendiri, TERPISAH dari vouchMessage: tombol "Ingin bertemu" tampil
  // untuk siapa pun yang bukti bacanya berhasil, terlepas dari `connected`
  // (dua orang bisa saling menandai lewat feed tanpa pernah terkoneksi).
  // Kalau galatnya ditumpangkan ke vouchMessage, ia hanya dirender di dalam
  // seksi Vouch yang digerbangi `connected` — untuk pasangan yang belum
  // terkoneksi, pesan galatnya tidak akan pernah terlihat sama sekali.
  const [meetMessage, setMeetMessage] = useState<string | null>(null);
  // Sedang menandai/mencabut — dipakai untuk menolak ketukan kedua sebelum
  // yang pertama selesai (finding #5) dan untuk memberi tahu pengguna bahwa
  // ketukannya sudah terdaftar, bukan diam saja.
  const [meetBusy, setMeetBusy] = useState(false);

  // Sama seperti meetMessage/meetBusy di atas, tapi untuk aksi blokir —
  // TERPISAH supaya pesan blokir tidak menimpa pesan tanda atau sebaliknya
  // saat keduanya sempat terjadi berdekatan.
  const [blokirMessage, setBlokirMessage] = useState<string | null>(null);
  const [blokirBusy, setBlokirBusy] = useState(false);

  // Kegagalan MEMUAT profil (bukan kegagalan membuat bukti baca — itu
  // ditangani secara terpisah di bawah dan tidak boleh menutup profil
  // publik). Hanya diisi kalau permintaan profilnya sendiri gagal, supaya
  // layar bisa menampilkan pesan dan tombol "Coba lagi" alih-alih macet di
  // "Memuat…" selamanya (finding #1).
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
    // sudahKutandai/salingMenandai memang absen (bukan false).
    //
    // Kegagalan MEMBUAT buktinya (mis. pengguna menolak permintaan tanda
    // tangan di dompet sungguhan) ditangkap DI SINI, terpisah dari
    // permintaan profilnya sendiri (finding #1) — endpoint ini publik, dan
    // bukti hanya membuka bendera privat tambahan. Profil publik tidak
    // boleh ikut gagal hanya karena tanda tangannya gagal.
    let kueri = "";
    if (signer && address) {
      try {
        kueri = `?${await kueriBuktiProfil(signer, address as Address)}`;
      } catch { /* lanjut sebagai pemanggil tanpa bukti, bukan gagal total */ }
    }
    try {
      // `req` melempar ApiError kalau responsnya bukan 2xx (finding #3) —
      // tanpa ini, badan galat dari server bisa lolos ke `setP` dan
      // dirender seolah-olah itu profil sungguhan.
      setP(await req<Profile>(`/profile/${address}${kueri}`));
    } catch {
      setLoadError("Profil gagal dimuat. Periksa koneksimu, lalu coba lagi.");
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
    fetch(`${CONFIG.apiUrl}/connected/${signer.address}/${address}`)
      .then((r) => r.json())
      .then((j: { connected?: boolean }) => setConnected(!!j.connected))
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
      setVouchMessage("Vouch terkirim.");
      // Muat ulang bukti — tier atau evidenceLine bisa langsung berubah.
      fetchTrust(address as Address).then(setTrust).catch(() => {});
    } catch (e) {
      // Kode kegagalan mentah dari server tidak pernah tampil apa adanya —
      // pesanGagal menerjemahkannya ke kalimat Indonesia yang bisa
      // ditindaklanjuti (termasuk quota_exceeded, already_vouched, dll).
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
      // Kalimat ini bukan hiasan: ia mencegah pengguna mengira tombol Lapor
      // adalah senjata yang menurunkan skor orang lain (spec induk §6).
      setReportMessage(
        "Laporan diterima. Laporan tidak menurunkan skor siapa pun — ia memicu peninjauan.",
      );
    } catch (e) {
      setReportMessage(e instanceof Error ? pesanGagal(e.message) : pesanGagal(""));
    } finally {
      setReportBusy(false);
    }
  }

  async function toggleTanda() {
    if (!signer || !address || meetBusy) return;
    // Dibersihkan di AWAL, bukan setelah `aksiTanda` berhasil (finding #6) —
    // kalau tidak, pesan galat percobaan sebelumnya nongkrong di layar
    // sepanjang percobaan berikutnya, termasuk selama request ini berjalan.
    setMeetMessage(null);
    setMeetBusy(true);
    const akanMencabut = !!p?.sudahKutandai;
    try {
      await aksiTanda(signer, address as Address, akanMencabut);
    } catch (e) {
      setMeetMessage(e instanceof ApiError ? meetErrorMessage(e.code) : "Gagal menandai.");
      setMeetBusy(false);
      return;
    }
    // Tandanya SUDAH tersimpan di server pada titik ini. Kegagalan di bawah
    // (memuat ulang) adalah kegagalan yang BERBEDA dari kegagalan menandai
    // (finding #2) — memakai pesan "Gagal menandai." di sini akan
    // membohongi pengguna tentang aksi yang justru berhasil.
    try {
      const kueri = `?${await kueriBuktiProfil(signer, address as Address)}`;
      setP(await req<Profile>(`/profile/${address}${kueri}`));
      // Kalimat "menandai"-nya SAMA PERSIS dengan yang diucapkan kartu feed
      // untuk aksi yang sama (finding #7) — lihat meetSuccessMessage.
      setMeetMessage(meetSuccessMessage(!akanMencabut));
    } catch {
      setMeetMessage(
        "Tandanya tersimpan, tapi profil gagal dimuat ulang. Muat ulang layar ini untuk melihat angka terbaru.",
      );
    } finally {
      setMeetBusy(false);
    }
  }

  // Mengikuti pola toggleTanda persis: pesan dibersihkan di AWAL, ketukan
  // ganda ditolak lewat blokirBusy, dan kegagalan AKSI dipisahkan dari
  // kegagalan MUAT ULANG sesudahnya — blokirnya sendiri sudah tersimpan di
  // server begitu `aksiBlokir` selesai tanpa lempar, jadi kegagalan reload di
  // bawah TIDAK BOLEH memakai kalimat "gagal memblokir"/"gagal mencabut",
  // yang akan membohongi pengguna tentang aksi yang justru berhasil.
  async function toggleBlokir() {
    if (!signer || !address || blokirBusy) return;
    setBlokirMessage(null);
    setBlokirBusy(true);
    const akanMencabut = !!p?.sudahKublokir;
    try {
      await aksiBlokir(signer, address as Address, akanMencabut);
    } catch (e) {
      setBlokirMessage(e instanceof ApiError
        ? blokirErrorMessage(e.code)
        : (akanMencabut ? "Gagal mencabut blokir." : "Gagal memblokir."));
      setBlokirBusy(false);
      return;
    }
    try {
      const kueri = `?${await kueriBuktiProfil(signer, address as Address)}`;
      setP(await req<Profile>(`/profile/${address}${kueri}`));
    } catch {
      setBlokirMessage(akanMencabut
        ? "Blokir sudah dicabut, tapi profil gagal dimuat ulang. Muat ulang layar ini untuk melihat status terbaru."
        : "Orang ini sudah diblokir, tapi profil gagal dimuat ulang. Muat ulang layar ini untuk melihat status terbaru.");
    } finally {
      setBlokirBusy(false);
    }
  }

  if (!p) {
    // `loadError` hanya terisi kalau permintaan profilnya sendiri gagal
    // (bukan kalau hanya pembuatan buktinya yang gagal) — lihat `muatProfil`.
    // Tanpa cabang ini, kegagalan jaringan/nyata membekukan layar di
    // "Memuat…" selamanya, tanpa pesan dan tanpa jalan keluar (finding #1).
    return (
      <View style={[s.flex, s.root]}>
        <Text>{loadError ?? "Memuat…"}</Text>
        {loadError && <Button title="Coba lagi" onPress={() => void muatProfil()} />}
      </View>
    );
  }

  const teksInginBertemu = teksInginBertemuCount(p.inginBertemuCount);
  const labelTombolTanda = tombolTandaLabel(
    p.sudahKutandai, { milikSendiri: isOwnProfile, sibuk: meetBusy },
  );

  return (
    // Alasan laporan itu multiline, jadi tombol return menyisipkan baris baru
    // dan TIDAK menutup keyboard. iOS juga TIDAK mendukung inputAccessoryViewID
    // pada TextInput multiline (bug RN yang masih terbuka), jadi batang menempel
    // keyboard bukan pilihan. Yang menggantikannya tiga hal:
    //   - automaticallyAdjustKeyboardInsets: konten menyusut, isian tidak tertutup
    //   - gulirKeIsian(): isian dibawa ke tampilan saat form dibuka & difokuskan
    //   - tombol "Selesai" DI ATAS isian, tempat yang tidak tertutup keyboard
    <ScrollView
      ref={scrollRef}
      style={s.flex}
      contentContainerStyle={s.root}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      // iOS menyesuaikan sendiri inset konten terhadap keyboard. Ini
      // menggantikan KeyboardAvoidingView, yang butuh keyboardVerticalOffset
      // setinggi header stack — angka yang harus ditebak dan gampang meleset.
      automaticallyAdjustKeyboardInsets
    >
      {/* Nama boleh apa saja dan TIDAK unik. Alamat SELALU tampil di bawahnya —
          nama bukan identitas, alamat-lah identitasnya (spec §9.2). */}
      <Text style={s.name}>{p.displayName || "Tanpa nama"}</Text>
      <Text style={s.addr} selectable>{p.ens ?? p.address}</Text>
      {p.ens && <Text style={s.addr} selectable>{p.address}</Text>}

      <View style={s.facts}>
        <Text style={s.fact}>{p.connectionCount} koneksi</Text>
        <Text style={s.fact}>{p.txCount} transaksi on-chain</Text>
      </View>

      {/* Tier SELALU tampil bersama buktinya, tidak pernah sebagai angka
          telanjang (spec induk §8). */}
      {trust && (
        <View style={s.tierBox}>
          <Text style={s.tierLabel}>{tierView(trust.tier, trust.evidence).label}</Text>
          <Text style={s.tierEvidence}>
            {tierView(trust.tier, trust.evidence).evidenceLine}
          </Text>
        </View>
      )}

      <View style={s.section}>
        {/*
          Kedua gerbang absen-lawan-nol di layar ini dipindahkan ke fungsi
          murni di src/messages.ts dan diuji di sana (finding #7). Regresi
          keduanya berkelas Critical — angka yang dikarang, dan tombol yang
          menebak keadaan yang tidak diketahui — dan sebagai JSX sebaris
          keduanya tidak bisa diuji tanpa harness render yang belum ada.
        */}
        {teksInginBertemu !== null ? (
          <Text style={s.angka}>{teksInginBertemu}</Text>
        ) : null}
        {p.salingMenandai ? <Text style={s.saling}>Kalian saling ingin bertemu.</Text> : null}
        {labelTombolTanda !== null ? (
          <Button
            title={labelTombolTanda}
            disabled={meetBusy}
            onPress={() => void toggleTanda()}
          />
        ) : null}
        {meetMessage && <Text style={s.message}>{meetMessage}</Text>}
      </View>

      {/*
        `sudahKublokir !== undefined`, BUKAN cek truthiness — absen berarti
        "tidak diketahui" (bukti baca gagal/tidak dikirim), dan melonggarkannya
        ke truthiness diam-diam membuat "tidak diketahui" jadi "belum
        diblokir". Tombol tanda di atas TIDAK ikut disembunyikan oleh
        `sudahKublokir` (R5): mencabut tanda yang sudah ada tetap boleh saat
        terblokir, hanya MEMASANG tanda baru yang ditolak server.
      */}
      {p.sudahKublokir !== undefined && !isOwnProfile && (
        <View style={s.section}>
          <Button
            title={blokirTombolLabel(p.sudahKublokir, blokirBusy)}
            disabled={blokirBusy}
            onPress={() => { void toggleBlokir(); }}
          />
          {p.sudahKublokir && (
            <Text style={s.catatan}>
              Kamu memblokir orang ini. Kalian tidak saling muncul di feed, dan tidak bisa saling menandai.
            </Text>
          )}
          {blokirMessage && <Text style={s.pesan}>{blokirMessage}</Text>}
        </View>
      )}

      {signer && !isOwnProfile && connected && (
        // Hanya untuk koneksi (spec 4c §4). Server tetap menegakkan gerbangnya
        // sendiri — tombol ini kenyamanan, bukan pengaman.
        <View style={s.section}>
          <Button title="Kirim pesan" onPress={() => router.push(`/pesan/${address}`)} />
        </View>
      )}

      {signer && !isOwnProfile && connected && (
        <View style={s.section}>
          <View style={s.row}>
            <Pressable onPress={() => setShowVouchPicker((v) => !v)}>
              <Text style={s.button}>Vouch</Text>
            </Pressable>
            {/* Server-lah satu-satunya yang benar-benar tahu sisa kuota;
                menampilkan angka yang bisa basi (mis. setelah pindah ke profil
                lain) lebih buruk daripada tidak menampilkan angka sama sekali. */}
            <Text style={s.quota}>Maksimal 3 vouch per hari.</Text>
          </View>

          {showVouchPicker && (
            <View style={s.tagPicker}>
              <View style={s.tags}>
                {SUGGESTED_TAGS.map((tag) => (
                  <Pressable key={tag} onPress={() => toggleTag(tag)}>
                    <Text style={[s.tag, selectedTags.includes(tag) && s.tagSelected]}>
                      {tag}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Button
                title={vouchBusy ? "Mengirim…" : "Kirim Vouch"}
                disabled={vouchBusy || selectedTags.length === 0}
                onPress={() => void handleVouch()}
              />
            </View>
          )}

          {vouchMessage && <Text style={s.message}>{vouchMessage}</Text>}
        </View>
      )}

      {signer && !isOwnProfile && (
        <View style={s.section}>
          <Pressable
            onPress={() => {
              setShowReportForm((v) => !v);
              gulirKeIsian();
            }}
          >
            <Text style={s.button}>Lapor</Text>
          </Pressable>

          {showReportForm && (
            <View style={s.reportForm}>
              {/* "Selesai" duduk DI ATAS isian, bukan di bawahnya: yang di
                  bawah akan tertutup keyboard, persis masalah yang mau
                  diselesaikan. iOS juga mendapat batang menempel keyboard. */}
              <View style={s.inputHeader}>
                <Text style={s.inputLabel}>Alasan laporan</Text>
                <Pressable onPress={() => Keyboard.dismiss()} hitSlop={12}>
                  <Text style={s.done}>Selesai</Text>
                </Pressable>
              </View>
              <TextInput
                style={s.input}
                placeholder="Ceritakan apa yang terjadi"
                value={reportReason}
                onChangeText={setReportReason}
                onFocus={gulirKeIsian}
                multiline
              />
              <Button
                title={reportBusy ? "Mengirim…" : "Kirim Laporan"}
                disabled={reportBusy || !reportReason.trim()}
                onPress={() => void handleReport()}
              />
            </View>
          )}

          {reportMessage && <Text style={s.message}>{reportMessage}</Text>}
        </View>
      )}
      </ScrollView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  root: { padding: 24, paddingBottom: 48, gap: 8 },
  inputHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  inputLabel: { fontSize: 14, opacity: 0.7 },
  done: { fontSize: 17, fontWeight: "600" },
  name: { fontSize: 26, fontWeight: "700" },
  addr: { fontFamily: "Courier", fontSize: 12, opacity: 0.6 },
  facts: { marginTop: 20, gap: 6 },
  fact: { fontSize: 16 },
  tierBox: { marginTop: 20, gap: 4 },
  tierLabel: { fontSize: 22, fontWeight: "700" },
  tierEvidence: { fontSize: 14, opacity: 0.7 },
  angka: { fontSize: 14, opacity: 0.7 },
  saling: { fontSize: 14, paddingTop: 2 },
  section: { marginTop: 20, gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  button: {
    fontSize: 16, fontWeight: "600", paddingVertical: 8, paddingHorizontal: 14,
    borderWidth: 1, borderRadius: 8, overflow: "hidden",
  },
  quota: { fontSize: 13, opacity: 0.6 },
  tagPicker: { gap: 10 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: {
    fontSize: 14, paddingVertical: 6, paddingHorizontal: 12,
    borderWidth: 1, borderRadius: 16, overflow: "hidden", opacity: 0.6,
  },
  tagSelected: { opacity: 1, fontWeight: "700" },
  reportForm: { gap: 10 },
  input: {
    borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14, minHeight: 60,
  },
  message: { fontSize: 14, lineHeight: 20, opacity: 0.8 },
  catatan: { fontSize: 13, opacity: 0.7, lineHeight: 19 },
  pesan: { fontSize: 14, lineHeight: 20, opacity: 0.8 },
});
