import { useEffect, useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { router, useIsFocused, useLocalSearchParams } from "expo-router";
import { ModePindai } from "@/components/salaman/mode-pindai";
import { ModeQr } from "@/components/salaman/mode-qr";
import { Segmen } from "@/components/segmen";
import { CONFIG } from "../../../src/config";
import type { NearlySigner } from "../../../src/signer";
import { useNearlySigner } from "../../../src/dompet/konteks-dompet";
import { modeSalamanDariParam, PILIHAN_MODE_SALAMAN, type ModeSalaman } from "../../../src/salaman-mode";

export default function SalamanScreen() {
  // Dua domain EIP-712: check-in terikat AttendanceRegistry, salaman terikat
  // ConnectionRegistry. Keduanya diambil di tingkat komponen — hook tidak boleh
  // dipanggil di dalam callback pemindai.
  const signerHadir = useNearlySigner(CONFIG.attendanceRegistry);
  const signerSalaman = useNearlySigner(CONFIG.verifyingContract);
  // Dompet belum siap — mis. sesaat setelah Ganti dompet, selagi tab ini masih
  // terpasang. Isi layar tidak dirender, supaya hook di dalamnya tidak pernah
  // berjalan tanpa signer (Ruling D4 spec dompet).
  if (!signerHadir || !signerSalaman) return null;
  return <SalamanIsi key={signerSalaman.address} signerHadir={signerHadir} signerSalaman={signerSalaman} />;
}

function SalamanIsi({ signerHadir, signerSalaman }: { signerHadir: NearlySigner; signerSalaman: NearlySigner }) {
  const { mode: modeParam } = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<ModeSalaman>(() => modeSalamanDariParam(modeParam));
  // Tab tetap terpasang saat berpindah tab: tautan "/salaman?mode=pindai"
  // berikutnya (Detail acara) mengganti mode lewat parameternya. Parameternya
  // dikosongkan setelah dipakai — kalau tidak, tautan yang SAMA sesudah
  // pengguna menggeser segmen tidak mengubah apa pun, karena nilainya tidak
  // berubah dan efek ini tidak berjalan (review Rencana A #3).
  useEffect(() => {
    if (modeParam === undefined) return;
    setMode(modeSalamanDariParam(modeParam));
    router.setParams({ mode: undefined });
  }, [modeParam]);
  // R10: QR berputar dan kamera hanya berjalan saat tab ini fokus (spec §4.6).
  const fokus = useIsFocused();

  return (
    // Judul besar iOS hanya memberi ruang yang benar bila isinya ScrollView
    // dengan penyesuaian inset otomatis (spec §4.7, amandemen 2026-09-19).
    <ScrollView
      style={s.flex}
      contentContainerStyle={s.root}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <Segmen pilihan={PILIHAN_MODE_SALAMAN} nilai={mode} onGanti={setMode} />
      {fokus && (mode === "qr"
        ? <ModeQr signerSalaman={signerSalaman} />
        : <ModePindai signerHadir={signerHadir} signerSalaman={signerSalaman} />)}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  root: { padding: 16, gap: 16 },
});
