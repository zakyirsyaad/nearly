import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Pengembangan lokal: API di http://localhost:8787 (pnpm --filter @nearly/api dev).
// Proxy membuat /graf/* satu origin dengan dev server, jadi CORS tidak
// dibutuhkan di lokal — WEB_ORIGINS boleh kosong (spec 6 §4.6).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/graf": "http://localhost:8787" },
  },
});
