import { useState } from "react";
import { CameraView, useCameraPermissions } from "expo-camera";
import { StyleSheet, View } from "react-native";
import { checkInAcceptTypedData, decodeCheckInQr, decodeQr, isQrExpired } from "@nearly/shared";
import { SheetBertemu, type HasilSalaman } from "@/components/salaman/sheet-bertemu";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { useKabar } from "@/hooks/useKabar";
import { RADIUS } from "@/theme/globals";
import { CONFIG } from "../../src/config";
import type { NearlySigner } from "../../src/signer";
import { getCurrentCell } from "../../src/location";
import { ApiError, postAccept } from "../../src/api";
import { eventErrorMessage, handshakeErrorMessage } from "../../src/messages";
import { postCheckIn } from "../../src/events-api";
import {
  teksCheckInBerhasil, TEKS_BUKAN_QR_NEARLY, TEKS_GAGAL_CHECK_IN, TEKS_GAGAL_SALAMAN,
  TEKS_IZIN_KAMERA, TEKS_PINDAI_LAGI, TEKS_QR_SENDIRI, TEKS_TOMBOL_IZIN_KAMERA,
} from "../../src/teks-salaman";

/**
 * Mode "Scan" layar Salaman (spec desain UI §6.2). Dua domain EIP-712:
 * check-in terikat AttendanceRegistry (`signerHadir`), salaman terikat
 * ConnectionRegistry (`signerSalaman`); keduanya diambil pembungkus layar —
 * hook tidak boleh dipanggil di dalam callback pemindai. Dipasang hanya saat
 * tab Salaman fokus, jadi kamera dilepas saat pindah tab (R10).
 *
 * Salaman berhasil membuka sheet "You met …" (#16D) dan TIDAK berpindah layar;
 * check-in berhasil tetap teks hasil + "Scan again", ditambah toast dan haptic.
 */
export function ModePindai({ signerHadir, signerSalaman }: { signerHadir: NearlySigner; signerSalaman: NearlySigner }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [hasil, setHasil] = useState<HasilSalaman | null>(null);
  const kabar = useKabar();
  const garis = useColor("border");

  if (!permission?.granted) {
    return (
      <View style={s.root}>
        <Text variant="body" style={s.rata}>{TEKS_IZIN_KAMERA}</Text>
        <Button onPress={() => void requestPermission()}>{TEKS_TOMBOL_IZIN_KAMERA}</Button>
      </View>
    );
  }

  async function onScan(data: string) {
    // Penjaga sheet (§6.2 butir 8): selama sheet terbuka kamera masih
    // menangkap QR yang sama, dan pindaian kedua akan memicu
    // already_connected untuk pasangan yang barusan berhasil.
    if (busy || hasil) return;
    setBusy(true);
    try {
      // QR check-in dicoba LEBIH DULU. Keduanya JSON, dan hanya yang ini
      // membawa penanda k:"checkin" — jadi urutannya tidak ambigu, tapi
      // menaruhnya belakangan akan membuat alur yang salah berjalan duluan.
      const checkin = decodeCheckInQr(data);
      if (checkin) {
        try {
          if (Date.now() > Number(checkin.expiresAt) * 1000) {
            setResult(eventErrorMessage("expired"));
            return;
          }
          const signer = signerHadir;
          const { cell, atMs } = await getCurrentCell();
          const sigAttendee = await signer.signTypedData(
            checkInAcceptTypedData(
              {
                eventId: checkin.eventId, nonce: checkin.nonce,
                attendee: signer.address, expiresAt: checkin.expiresAt,
              },
              CONFIG.attendanceRegistry,
            ),
          );
          const { txHash } = await postCheckIn(checkin.eventId, {
            eventId: checkin.eventId, nonce: checkin.nonce, attendee: signer.address,
            expiresAt: checkin.expiresAt.toString(), sigAttendee, cell, atMs,
          });
          setResult(teksCheckInBerhasil(txHash));
          kabar.berhasil(teksCheckInBerhasil(txHash));
        } catch (e) {
          setResult(
            e instanceof ApiError
              ? eventErrorMessage(e.code, e.reason)
              : e instanceof Error ? e.message : TEKS_GAGAL_CHECK_IN,
          );
        }
        return;
      }

      const payload = decodeQr(data);
      if (!payload) {
        setResult(TEKS_BUKAN_QR_NEARLY);
        return;
      }
      if (isQrExpired(payload, Date.now())) {
        setResult(handshakeErrorMessage("expired"));
        return;
      }

      const signer = signerSalaman;
      if (signer.address.toLowerCase() === payload.initiator.toLowerCase()) {
        setResult(TEKS_QR_SENDIRI);
        return;
      }

      const { cell, atMs } = await getCurrentCell();
      const accept = {
        initiator: payload.initiator,
        counterparty: signer.address,
        nonce: payload.nonce,
        expiresAt: payload.expiresAt,
      };
      const sigAccept = await signer.signAccept(accept);

      const { txHash } = await postAccept({
        initiator: payload.initiator,
        counterparty: signer.address,
        nonce: payload.nonce,
        expiresAt: payload.expiresAt.toString(),
        sigAccept,
        cell,
        atMs,
      });
      // Momen puncak: sheet, bukan teks hasil dan bukan pindah layar (#16D).
      // Hasil pindai sebelumnya dibersihkan supaya tidak ikut terbaca di balik sheet.
      setResult(null);
      setHasil({ initiator: payload.initiator, txHash });
    } catch (e) {
      setResult(
        e instanceof ApiError
          ? handshakeErrorMessage(e.code, e.reason)
          : e instanceof Error ? e.message : TEKS_GAGAL_SALAMAN,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={s.root}>
      {/* Persegi, bukan flex: isi layar berada di dalam ScrollView supaya
          judul besar iOS memberi ruang yang benar (spec §4.7). */}
      <View style={[s.jendela, { borderColor: garis }]}>
        <CameraView
          style={s.cam}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={({ data }) => void onScan(data)}
        />
      </View>
      {result ? <Text variant="body" style={s.rata}>{result}</Text> : null}
      {result ? (
        <Button variant="outline" onPress={() => setResult(null)}>{TEKS_PINDAI_LAGI}</Button>
      ) : null}
      {hasil ? (
        <SheetBertemu
          hasil={hasil}
          alamatSendiri={signerSalaman.address}
          onTutup={() => setHasil(null)}
        />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: 16, paddingVertical: 16 },
  jendela: { width: "100%", aspectRatio: 1, borderWidth: 1, borderRadius: RADIUS.kartu, overflow: "hidden" },
  cam: { flex: 1 },
  rata: { textAlign: "center" },
});
