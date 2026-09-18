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
import { CONFIG } from "../../src/config";
import type { NearlySigner } from "../../src/signer";
import { useNearlySigner } from "../../src/dompet/konteks-dompet";
import { TAB_BAWAH, type NamaIkonTab } from "../../src/judul-layar";
import { PenyediaLencana, useLencanaTab } from "../../src/lencana/konteks-lencana";
import { teksLencana } from "../../src/messages";

const IKON: Record<NamaIkonTab, ComponentType<LucideProps>> = {
  House, CalendarDays, ArrowLeftRight, MessageCircle, CircleUser,
};

export default function LayoutTabs() {
  const signer = useNearlySigner(CONFIG.verifyingContract);
  // Dompet belum siap — mis. sesaat setelah Ganti dompet, sebelum penjaga
  // melepas (tabs). Isi tidak dirender, supaya useLencanaTab tidak pernah
  // berjalan tanpa signer (Ruling D4 spec dompet, spec desain UI §4.2).
  if (!signer) return null;
  return <LayoutTabsIsi key={signer.address} signer={signer} />;
}

/**
 * Lima tab bawah (spec desain UI §4.3, keputusan #3). Setiap tab adalah Stack
 * sendiri di grupnya (R2); label, ikon, dan urutan dari TAB_BAWAH. Lencana
 * Pesan dan titik Profil dari useLencanaTab (§4.4).
 */
function LayoutTabsIsi({ signer }: { signer: NearlySigner }) {
  const lencana = useLencanaTab(signer);
  const insets = useSafeAreaInsets();
  const aktif = useColor("primary");
  const redup = useColor("textMuted");
  const latarBar = useColor("input");
  const garis = useColor("border");
  const latar = useColor("background");

  return (
    <PenyediaLencana nilai={lencana}>
      <Tabs
        screenListeners={{ focus: () => lencana.muatBilaPerlu() }}
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
              tabBarIcon: ({ color }) => (
                <IkonTab
                  Ikon={IKON[tab.ikon]}
                  warna={String(color)}
                  lencana={tab.grup === "(pesan)" ? teksLencana(lencana.belumDibaca) : null}
                  titik={tab.grup === "(profil)" && lencana.kecocokanBaru > 0}
                />
              ),
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
    </PenyediaLencana>
  );
}
