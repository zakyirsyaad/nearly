/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Basis API, mis. https://api.<domain>. Kosong = origin yang sama (proxy dev). */
  readonly VITE_API_URL?: string;
}
