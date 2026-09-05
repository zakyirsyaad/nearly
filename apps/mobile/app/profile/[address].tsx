import { useEffect, useMemo, useRef, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import {
  Button, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import type { Address } from "viem";
import { CONFIG } from "../../src/config";
import { pesanGagal } from "../../src/errors";
import { createDevSigner } from "../../src/signer";
import { SUGGESTED_TAGS, tierView } from "../../src/tier";
import { fetchTrust, sendReport, sendVouch, type TrustResponse } from "../../src/trust-api";

type Profile = {
  address: string; displayName: string; ens: string | null;
  txCount: number; connectionCount: number;
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

  const [showVouchPicker, setShowVouchPicker] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [vouchBusy, setVouchBusy] = useState(false);
  const [vouchMessage, setVouchMessage] = useState<string | null>(null);

  const [showReportForm, setShowReportForm] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportMessage, setReportMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${CONFIG.apiUrl}/profile/${address}`).then((r) => r.json()).then(setP).catch(() => {});
  }, [address]);

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

  if (!p) return <View style={[s.flex, s.root]}><Text>Memuat…</Text></View>;

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
});
