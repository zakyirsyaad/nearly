import { useCallback } from "react";
import * as Haptics from "expo-haptics";
import { useToast } from "@/components/ui/toast";

/**
 * Keadaan "berhasil" yang seragam (spec desain UI §7.2): toast hijau +
 * haptic. Dipusatkan supaya tidak ada layar yang lupa haptiknya, dan supaya
 * "Address copied" memakai impact ringan (#16C) — bukan haptic Success yang
 * dipakai aksi penting.
 */
export function useKabar() {
  const { success } = useToast();

  /** Aksi penting: check-in, vouch terkirim, profil disimpan, laporan terkirim. */
  const berhasil = useCallback(
    (judul: string) => {
      success(judul);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    },
    [success],
  );

  /** Menyalin alamat (#16C): toast yang sama, getar ringan. */
  const disalin = useCallback(
    (judul: string) => {
      success(judul);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    },
    [success],
  );

  return { berhasil, disalin };
}
