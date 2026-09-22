import { StackTab } from "@/components/stack-tab";

// Layar akar tab: Radar yang dibuka dari notifikasi punya daftar Acara di
// bawahnya, dan tombol kembali pulang ke sana (spec §4.1, §4.5).
export const unstable_settings = { initialRouteName: "events/index" };

export default function LayoutAcara() {
  return <StackTab grup="(acara)" />;
}
