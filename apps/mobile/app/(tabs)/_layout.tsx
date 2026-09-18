import type { ComponentType } from "react";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeftRight, CalendarDays, CircleUser, House, MessageCircle, type LucideProps,
} from "lucide-react-native";
import { IkonTab } from "@/components/tab/ikon-tab";
import { TombolSalaman } from "@/components/tab/tombol-salaman";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { MAKS_SKALA_HURUF_KECIL, UKURAN } from "@/theme/globals";
import { TAB_BAWAH, type NamaIkonTab } from "../../src/judul-layar";

const IKON: Record<NamaIkonTab, ComponentType<LucideProps>> = {
  House, CalendarDays, ArrowLeftRight, MessageCircle, CircleUser,
};

/**
 * Lima tab bawah (spec desain UI §4.3, keputusan #3). Setiap tab adalah Stack
 * sendiri di grupnya (R2); label, ikon, dan urutan dari TAB_BAWAH.
 */
export default function LayoutTabs() {
  const insets = useSafeAreaInsets();
  const aktif = useColor("primary");
  const redup = useColor("textMuted");
  const latarBar = useColor("input");
  const garis = useColor("border");
  const latar = useColor("background");

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: aktif,
        tabBarInactiveTintColor: redup,
        // Tinggi = isi + inset bawah (home indicator iOS, bilah gestur Android — §3.7).
        tabBarStyle: {
          backgroundColor: latarBar,
          borderTopColor: garis,
          height: UKURAN.tinggiIsiTabBar + insets.bottom,
        },
        sceneStyle: { backgroundColor: latar },
      }}
    >
      {TAB_BAWAH.map((tab) => (
        <Tabs.Screen
          key={tab.grup}
          name={tab.grup}
          options={{
            title: tab.label,
            tabBarAccessibilityLabel: tab.label,
            tabBarLabel: ({ color }) => (
              <Text variant="label" style={{ color }} maxFontSizeMultiplier={MAKS_SKALA_HURUF_KECIL}>
                {tab.label}
              </Text>
            ),
            tabBarIcon: ({ color }) => <IkonTab Ikon={IKON[tab.ikon]} warna={String(color)} />,
            tabBarButton:
              tab.grup === "(salaman)"
                ? (props) => (
                    <TombolSalaman
                      label={tab.label}
                      terpilih={props.accessibilityState?.selected === true}
                      onPress={(e) => props.onPress?.(e)}
                    />
                  )
                : undefined,
          }}
        />
      ))}
    </Tabs>
  );
}
