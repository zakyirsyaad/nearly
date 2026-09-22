import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Lokasi google-services.json (spec distribusi D7). Berkas ini tidak di-commit:
 * di EAS Build ia datang dari file variable GOOGLE_SERVICES_JSON (EAS menulis
 * berkasnya dan mengisi env dengan path-nya); di mesin pengembang boleh ada
 * salinan lokal yang di-gitignore. Tanpa keduanya tidak dipasang, supaya Expo Go
 * dan `expo export` tetap jalan.
 */
export function berkasGoogleServices(env: string | undefined, adaLokal: boolean): string | undefined {
  if (env) return env;
  return adaLokal ? "./google-services.json" : undefined;
}

export default function konfigurasi({ config }: ConfigContext): ExpoConfig {
  const googleServicesFile = berkasGoogleServices(
    process.env.GOOGLE_SERVICES_JSON,
    existsSync(join(__dirname, "google-services.json")),
  );
  return {
    ...config,
    name: config.name ?? "Nearly",
    slug: config.slug ?? "nearly",
    android: { ...config.android, ...(googleServicesFile ? { googleServicesFile } : {}) },
  };
}
