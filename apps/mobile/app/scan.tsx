import { useState } from "react";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Button, StyleSheet, Text, View } from "react-native";
import { checkInAcceptTypedData, decodeCheckInQr, decodeQr, isQrExpired } from "@nearly/shared";
import { CONFIG } from "../src/config";
import type { NearlySigner } from "../src/signer";
import { useNearlySigner } from "../src/dompet/konteks-dompet";
import { getCurrentCell } from "../src/location";
import { ApiError, postAccept } from "../src/api";
import { eventErrorMessage, handshakeErrorMessage } from "../src/messages";
import { postCheckIn } from "../src/events-api";

export default function ScanScreen() {
  // Dua domain EIP-712: check-in terikat AttendanceRegistry, salaman terikat
  // ConnectionRegistry. Keduanya diambil di tingkat komponen — hook tidak boleh
  // dipanggil di dalam callback pemindai.
  const signerHadir = useNearlySigner(CONFIG.attendanceRegistry);
  const signerSalaman = useNearlySigner(CONFIG.verifyingContract);
  // Dompet belum siap — mis. sesaat setelah Ganti dompet, selagi layar ini
  // masih di tumpukan. Isi layar tidak dirender, supaya hook di dalamnya tidak
  // pernah berjalan tanpa signer (Ruling D4).
  if (!signerHadir || !signerSalaman) return null;
  return <ScanIsi key={signerSalaman.address} signerHadir={signerHadir} signerSalaman={signerSalaman} />;
}

function ScanIsi({ signerHadir, signerSalaman }: { signerHadir: NearlySigner; signerSalaman: NearlySigner }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  if (!permission?.granted) {
    return (
      <View style={s.root}>
        <Text style={s.p}>Nearly butuh kamera untuk memindai QR orang yang kamu temui.</Text>
        <Button title="Izinkan kamera" onPress={requestPermission} />
      </View>
    );
  }

  async function onScan(data: string) {
    if (busy) return;
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
          setResult(`Check-in berhasil. ${txHash.slice(0, 10)}…`);
        } catch (e) {
          setResult(
            e instanceof ApiError
              ? eventErrorMessage(e.code, e.reason)
              : e instanceof Error ? e.message : "Check-in gagal.",
          );
        }
        return;
      }

      const payload = decodeQr(data);
      if (!payload) {
        setResult("QR ini bukan QR Nearly.");
        return;
      }
      if (isQrExpired(payload, Date.now())) {
        setResult(handshakeErrorMessage("expired"));
        return;
      }

      const signer = signerSalaman;
      if (signer.address.toLowerCase() === payload.initiator.toLowerCase()) {
        setResult("Itu QR-mu sendiri.");
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
      setResult(`Terkoneksi. ${txHash.slice(0, 10)}…`);
    } catch (e) {
      setResult(
        e instanceof ApiError
          ? handshakeErrorMessage(e.code, e.reason)
          : e instanceof Error ? e.message : "Handshake gagal.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={s.root}>
      <CameraView
        style={s.cam}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={({ data }) => void onScan(data)}
      />
      {result && <Text style={s.p}>{result}</Text>}
      {result && <Button title="Pindai lagi" onPress={() => setResult(null)} />}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, gap: 16, padding: 16 },
  cam: { flex: 1, borderRadius: 16, overflow: "hidden" },
  p: { fontSize: 15, lineHeight: 22, textAlign: "center" },
});
