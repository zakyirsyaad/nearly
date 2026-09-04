import "../src/polyfills"; // WAJIB baris pertama — lihat catatan di polyfills.ts
import { Stack } from "expo-router";

export default function RootLayout() {
  return <Stack screenOptions={{ headerTitleStyle: { fontWeight: "600" } }} />;
}
