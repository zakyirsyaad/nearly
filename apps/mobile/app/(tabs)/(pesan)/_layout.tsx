import { StackTab } from "@/components/stack-tab";

// Layar akar tab: Percakapan dan Lapor selalu punya daftar Pesan di bawahnya
// (spec §4.1, §4.5).
export const unstable_settings = { initialRouteName: "pesan/index" };

export default function LayoutPesan() {
  return <StackTab grup="(pesan)" />;
}
