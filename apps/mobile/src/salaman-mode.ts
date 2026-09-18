/** Mode layar Salaman (spec desain UI §6.2): "Show QR" (qr) atau "Scan" (pindai). */
export type ModeSalaman = "qr" | "pindai";

/** Label segmen — teks baru spec §7.3. */
export const PILIHAN_MODE_SALAMAN = [
  { nilai: "qr", label: "Show QR" },
  { nilai: "pindai", label: "Scan" },
] as const satisfies readonly { nilai: ModeSalaman; label: string }[];

/** `?mode=pindai` membuka Scan; selainnya Show QR. Parameter expo-router bisa berupa larik. */
export function modeSalamanDariParam(param: string | string[] | undefined): ModeSalaman {
  const nilai = Array.isArray(param) ? param[0] : param;
  return nilai === "pindai" ? "pindai" : "qr";
}
