import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Button, StyleSheet, Text, View } from "react-native";
import type { Hex } from "viem";
import { isEventLive, lihatEventTypedData, rsvpTypedData } from "@nearly/shared";
import { CONFIG } from "../../src/config";
import { createDevSigner } from "../../src/signer";
import { ApiError } from "../../src/api";
import { getEvent, postRsvp, type EventSummary } from "../../src/events-api";
import { eventErrorMessage } from "../../src/messages";

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const signer = useMemo(
    () => createDevSigner(CONFIG.devPrivateKey!, CONFIG.attendanceRegistry),
    [],
  );

  const [ev, setEv] = useState<EventSummary | null>(null);
  // Diseed dari server (bukan diasumsikan false) — server sudah tahu
  // jawabannya lewat `who`, dan tamu yang RSVP lalu menutup app tidak boleh
  // disuruh RSVP lagi hanya karena state lokal lupa.
  const [sudahRsvp, setSudahRsvp] = useState(false);
  const [sudahCheckIn, setSudahCheckIn] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      // Bendera sudahRsvp/sudahCheckIn hanya keluar untuk pemanggil yang
      // MEMBUKTIKAN dirinya alamat itu — tanpa tanda tangan, `?who=` akan
      // jadi oracle yang bisa ditanya siapa pun tentang siapa pun. Tipe
      // LihatEvent dipakai di sini, BUKAN Rsvp: proof baca ini dikirim lewat
      // query string di setiap pembukaan layar, jadi kalau tipenya sama
      // dengan yang diterima POST /events/:id/rsvp, siapa pun yang membaca
      // URL itu (log, proxy) bisa memutarnya ulang sebagai RSVP sungguhan.
      const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 600);
      const sig = await signer.signTypedData(
        lihatEventTypedData(
          { eventId: id as Hex, who: signer.address, expiresAt },
          CONFIG.attendanceRegistry,
        ),
      );
      const data = await getEvent(id, signer.address, {
        expiresAt: expiresAt.toString(), sig,
      });
      setEv(data);
      setSudahRsvp(data.sudahRsvp === true);
      setSudahCheckIn(data.sudahCheckIn === true);
    } catch (e) {
      setPesan(e instanceof ApiError ? eventErrorMessage(e.code) : "Gagal memuat acara.");
    }
  }, [id, signer]);

  useEffect(() => { void load(); }, [load]);

  async function rsvp() {
    if (busy || !ev) return;
    setBusy(true);
    try {
      const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 600);
      const sig = await signer.signTypedData(
        rsvpTypedData(
          { eventId: ev.eventId, who: signer.address, expiresAt },
          CONFIG.attendanceRegistry,
        ),
      );
      await postRsvp(ev.eventId, {
        eventId: ev.eventId, who: signer.address, expiresAt: expiresAt.toString(), sig,
      });
      setSudahRsvp(true);
      setPesan("RSVP tercatat. Check-in di venue dengan memindai QR host.");
      await load();
    } catch (e) {
      if (e instanceof ApiError && e.code === "already_rsvped") setSudahRsvp(true);
      setPesan(e instanceof ApiError ? eventErrorMessage(e.code, e.reason) : "RSVP gagal.");
    } finally {
      setBusy(false);
    }
  }

  if (!ev) return <View style={s.root}><ActivityIndicator /></View>;

  const berlangsung = isEventLive(BigInt(ev.startsAt), BigInt(ev.endsAt), Date.now());
  const akuHost = ev.host.toLowerCase() === signer.address.toLowerCase();

  // Tombol check-in TIDAK PERNAH gagal diam-diam (spec §2.2): syaratnya
  // terbaca sebelum orang berdiri di depan host, bukan sesudah. Kalau tamu
  // sudah check-in, jangan tawarkan tautan pindai lagi — beri tahu saja.
  const alasanTakBisaCheckIn = sudahCheckIn
    ? eventErrorMessage("already_checked_in")
    : !sudahRsvp
      ? "RSVP dulu untuk bisa check-in."
      : !berlangsung
        ? "Check-in terbuka saat acara berlangsung."
        : null;

  return (
    <View style={s.root}>
      <Text style={s.judul}>{ev.title}</Text>
      {ev.venueLabel ? <Text style={s.meta}>{ev.venueLabel}</Text> : null}
      <Text style={s.meta}>
        {new Date(Number(ev.startsAt) * 1000).toLocaleString("id-ID")}
      </Text>
      <Text style={s.meta}>
        {ev.rsvps ?? 0} RSVP · {ev.checkins ?? 0} hadir · {ev.rsvpBelumHadir ?? 0} belum hadir
      </Text>

      {/*
        `undefined` untuk keduanya adalah keadaan NORMAL, bukan nol — untuk
        orang yang membuka tautan tanpa signer, dan untuk penandaHadir juga
        pada acara yang RSVP-nya belum sampai ambang k-anonimitas (spec).
        Karena itu keduanya diperiksa dengan `!== undefined`, bukan dirender
        dengan `?? 0`.
      */}
      {ev.penandaHadir !== undefined ? (
        <Text style={s.meta}>
          {ev.penandaHadir} orang yang ingin bertemu kamu sudah RSVP.
        </Text>
      ) : null}
      {ev.kutandaiHadir !== undefined ? (
        <Text style={s.meta}>
          {ev.kutandaiHadir} orang yang kamu tandai sudah RSVP.
        </Text>
      ) : null}

      {!sudahRsvp && (
        <Button title={busy ? "Mengirim…" : "RSVP"} onPress={() => void rsvp()} disabled={busy} />
      )}

      {alasanTakBisaCheckIn
        ? <Text style={s.nonaktif}>{alasanTakBisaCheckIn}</Text>
        : <Link href="/scan" style={s.aksi}>Pindai QR host untuk check-in</Link>}

      {akuHost && (
        <Link href={`/events/${ev.eventId}/host-qr`} style={s.aksi}>
          Buka QR check-in (kamu host)
        </Link>
      )}

      {pesan && <Text style={s.p}>{pesan}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, padding: 16, gap: 10 },
  judul: { fontSize: 22, fontWeight: "700" },
  meta: { fontSize: 14, opacity: 0.75 },
  aksi: { fontSize: 16, fontWeight: "600", paddingVertical: 10 },
  nonaktif: { fontSize: 15, opacity: 0.45, paddingVertical: 10 },
  p: { fontSize: 15, lineHeight: 22 },
});
