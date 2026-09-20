import { useCallback, useEffect, useState } from "react";
import { encodeQr, makeNonce, qrExpiresAt, QR_TTL_MS } from "@nearly/shared";
import type { NearlySigner } from "../signer";
import { getCurrentCell } from "../location";
import { TEKS_GAGAL_SIAPKAN_QR } from "../teks-salaman";
import { postOffer } from "../api";

/**
 * Menyiapkan QR baru setiap 30 detik. Setiap siklus: ambil lokasi SENDIRI,
 * tanda tangani offer, kirim ke server (beserta lokasi sendiri), lalu tampilkan.
 * Lokasi A tidak pernah dititipkan lewat B.
 */
export function useRotatingQr(signer: NearlySigner) {
  const [value, setValue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(QR_TTL_MS / 1000);

  const refresh = useCallback(async () => {
    try {
      const { cell, atMs } = await getCurrentCell();
      const nonce = makeNonce();
      const expiresAt = qrExpiresAt(Date.now());
      const offer = { initiator: signer.address, nonce, expiresAt };
      const sigOffer = await signer.signOffer(offer);

      await postOffer({
        initiator: signer.address,
        nonce,
        expiresAt: expiresAt.toString(),
        sigOffer,
        cell,
        atMs,
      });

      setValue(encodeQr({ v: 1, initiator: signer.address, nonce, expiresAt, sigOffer }));
      setSecondsLeft(QR_TTL_MS / 1000);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : TEKS_GAGAL_SIAPKAN_QR);
    }
  }, [signer]);

  useEffect(() => {
    void refresh();
    const rotate = setInterval(() => void refresh(), QR_TTL_MS);
    const tick = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => {
      clearInterval(rotate);
      clearInterval(tick);
    };
  }, [refresh]);

  return { value, secondsLeft, error, refresh };
}
