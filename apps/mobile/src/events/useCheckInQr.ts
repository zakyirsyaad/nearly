import { useCallback, useEffect, useState } from "react";
import type { Hex } from "viem";
import {
  checkInOfferTypedData, encodeCheckInQr, makeNonce, qrExpiresAt, QR_TTL_MS,
} from "@nearly/shared";
import { CONFIG } from "../config";
import type { NearlySigner } from "../signer";
import { getCurrentCell } from "../location";
import { postCheckInOffer } from "../events-api";
import { ApiError } from "../api";
import { eventErrorMessage } from "../messages";

/**
 * Cermin useRotatingQr Fase 1: tiap 30 detik ambil lokasi SENDIRI, tanda
 * tangani tawaran, kirim ke server beserta lokasi sendiri, lalu tampilkan.
 * Lokasi host tidak pernah dititipkan lewat tamu.
 */
export function useCheckInQr(signer: NearlySigner, eventId: Hex) {
  const [value, setValue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(QR_TTL_MS / 1000);
  // Kegagalan permanen menghentikan rotasi; kegagalan sementara tidak.
  const [berhenti, setBerhenti] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { cell, atMs } = await getCurrentCell();
      const nonce = makeNonce();
      const expiresAt = qrExpiresAt(Date.now());
      const sigHost = await signer.signTypedData(
        checkInOfferTypedData({ eventId, nonce, expiresAt }, CONFIG.attendanceRegistry),
      );

      await postCheckInOffer(eventId, {
        eventId, nonce, host: signer.address,
        expiresAt: expiresAt.toString(), sigHost, cell, atMs,
      });

      setValue(encodeCheckInQr({ v: 1, k: "checkin", eventId, nonce, expiresAt, sigHost }));
      setSecondsLeft(QR_TTL_MS / 1000);
      setError(null);
      setBerhenti(false);
    } catch (e) {
      // ApiError membawa KODE mesin di message-nya, bukan kalimat untuk orang.
      // Layar ini menampilkan error sebagai satu-satunya isinya, jadi kodenya
      // harus diterjemahkan dulu — sama seperti di layar discovery.
      setError(
        e instanceof ApiError
          ? eventErrorMessage(e.code, e.reason)
          : e instanceof Error
            ? e.message
            : "Gagal menyiapkan QR check-in.",
      );
      // Penolakan 4xx (mis. not_host, event_not_found) tidak akan pernah
      // berubah kalau tawaran yang sama dikirim ulang 30 detik lagi — hentikan
      // rotasinya. Galat lain (jaringan putus, server sedang sibuk) memang bisa
      // pulih sendiri, jadi rotasi tetap jalan.
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) setBerhenti(true);
    }
  }, [signer, eventId]);

  useEffect(() => {
    if (berhenti) return;
    void refresh();
    const rotate = setInterval(() => void refresh(), QR_TTL_MS);
    const tick = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => {
      clearInterval(rotate);
      clearInterval(tick);
    };
  }, [refresh, berhenti]);

  return { value, secondsLeft, error, refresh };
}
