import { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import {
  Button, Pressable, StyleSheet, Text, TextInput, View,
} from "react-native";
import type { Address } from "viem";
import { CONFIG } from "../../src/config";
import { createDevSigner } from "../../src/signer";
import { SUGGESTED_TAGS, tierView } from "../../src/tier";
import { fetchTrust, sendReport, sendVouch, type TrustResponse } from "../../src/trust-api";

type Profile = {
  address: string; displayName: string; ens: string | null;
  txCount: number; connectionCount: number;
};

// API tidak (dan sengaja tidak) mengekspos kuota tersisa — spec §11.1 butir 8
// hanya menegakkannya lewat kode "quota_exceeded". Nilai ini sekadar cermin
// dari DAILY_VOUCH_QUOTA di apps/api/src/vouch-gate.ts, untuk tampilan lokal
// per sesi; kuota SEBENARNYA selalu ditegakkan di server.
const DAILY_VOUCH_QUOTA_LOCAL = 3;

export default function ProfileScreen() {
  const { address } = useLocalSearchParams<{ address: string }>();
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
  const [vouchesSentToday, setVouchesSentToday] = useState(0);

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
    fetch(`${CONFIG.apiUrl}/connections/${signer.address}`)
      .then((r) => r.json())
      .then((j: { connections?: { address: string }[] }) => {
        const rows = j.connections ?? [];
        setConnected(rows.some((row) => row.address.toLowerCase() === address.toLowerCase()));
      })
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
      setVouchesSentToday((n) => n + 1);
      setSelectedTags([]);
      setShowVouchPicker(false);
      setVouchMessage("Vouch terkirim.");
      // Muat ulang bukti — tier atau evidenceLine bisa langsung berubah.
      fetchTrust(address as Address).then(setTrust).catch(() => {});
    } catch (e) {
      // "quota_exceeded" adalah kode mentah dari server — pengguna butuh
      // kalimat manusiawi, bukan nama field internal.
      if (e instanceof Error && e.message === "quota_exceeded") {
        setVouchesSentToday(DAILY_VOUCH_QUOTA_LOCAL);
        setVouchMessage("Jatah vouch hari ini sudah habis");
      } else {
        setVouchMessage(e instanceof Error ? e.message : "Vouch gagal terkirim.");
      }
    } finally {
      setVouchBusy(false);
    }
  }

  async function handleReport() {
    if (!signer || !reportReason.trim()) return;
    setReportBusy(true);
    try {
      await sendReport(signer.address, address as Address, reportReason.trim());
      setShowReportForm(false);
      setReportReason("");
      // Kalimat ini bukan hiasan: ia mencegah pengguna mengira tombol Lapor
      // adalah senjata yang menurunkan skor orang lain (spec induk §6).
      setReportMessage(
        "Laporan diterima. Laporan tidak menurunkan skor siapa pun — ia memicu peninjauan.",
      );
    } catch (e) {
      setReportMessage(e instanceof Error ? e.message : "Laporan gagal terkirim.");
    } finally {
      setReportBusy(false);
    }
  }

  if (!p) return <View style={s.root}><Text>Memuat…</Text></View>;

  return (
    <View style={s.root}>
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
            {/* Jatah yang tidak terlihat tidak terasa berharga. */}
            <Text style={s.quota}>
              Sisa kuota hari ini: {Math.max(0, DAILY_VOUCH_QUOTA_LOCAL - vouchesSentToday)}
            </Text>
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
          <Pressable onPress={() => setShowReportForm((v) => !v)}>
            <Text style={s.button}>Lapor</Text>
          </Pressable>

          {showReportForm && (
            <View style={s.reportForm}>
              <TextInput
                style={s.input}
                placeholder="Alasan laporan"
                value={reportReason}
                onChangeText={setReportReason}
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

      <Text style={s.note}>
        Trust Score menyusul di Fase 2. Untuk sekarang yang ditampilkan adalah faktanya saja.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, padding: 24, gap: 8 },
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
  note: { marginTop: 24, fontSize: 13, opacity: 0.5, lineHeight: 19 },
});
