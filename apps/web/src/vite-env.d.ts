/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Basis API, mis. https://api.<domain>. Kosong = origin yang sama (proxy dev). */
  readonly VITE_API_URL?: string;
  /** Tautan APK Android, mis. https://unduh.<domain>/nearly.apk. Kosong = bagian unduh disembunyikan. */
  readonly VITE_APK_URL?: string;
}

