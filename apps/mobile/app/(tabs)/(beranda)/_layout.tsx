import { StackTab } from "@/components/stack-tab";

// Layar akar tab: tautan dalam (notifikasi, router.push lintas tab) tetap
// punya layar ini di bawahnya dan tombol kembali pulang ke sana (spec §4.1).
export const unstable_settings = { initialRouteName: "index" };

export default function LayoutBeranda() {
  return <StackTab grup="(beranda)" />;
}
