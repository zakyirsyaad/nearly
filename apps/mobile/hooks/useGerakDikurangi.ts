import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * Reduce Motion OS (spec desain UI §3.7). `false` sampai OS menjawab, lalu
 * mengikuti perubahan lewat `reduceMotionChanged`. Dipakai salinan BNA
 * `skeleton` dan `toast`, dan (Rencana B) sheet salaman.
 */
export function useGerakDikurangi(): boolean {
  const [dikurangi, setDikurangi] = useState(false);

  useEffect(() => {
    let aktif = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((nilai) => { if (aktif) setDikurangi(nilai); })
      .catch(() => {});
    const langganan = AccessibilityInfo.addEventListener("reduceMotionChanged", setDikurangi);
    return () => {
      aktif = false;
      langganan.remove();
    };
  }, []);

  return dikurangi;
}
