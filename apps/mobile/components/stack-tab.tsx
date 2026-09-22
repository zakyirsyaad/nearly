import { Stack } from "expo-router";
import { OPSI_STACK, opsiTampilan } from "@/theme/navigasi";
import { layarDalam, type GrupTab } from "../src/judul-layar";

/**
 * Stack satu tab (spec desain UI §4.1, R2, Ruling A5). Judul setiap layar
 * didaftarkan dari layarDalam — alasannya di src/judul-layar.ts.
 */
export function StackTab({ grup }: { grup: GrupTab }) {
  const induk = `(tabs)/${grup}`;
  return (
    <Stack screenOptions={OPSI_STACK}>
      {layarDalam(induk).map(([name, title]) => (
        <Stack.Screen key={name} name={name} options={{ title, ...opsiTampilan(`${induk}/${name}`) }} />
      ))}
    </Stack>
  );
}
