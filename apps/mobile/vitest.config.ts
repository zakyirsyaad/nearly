import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Alias yang sama dengan tsconfig "paths" (@/* → akar apps/mobile), supaya
  // tes yang mengimpor modul ber-alias tetap jalan (spec desain UI §3.6).
  resolve: {
    alias: [{ find: /^@\//, replacement: fileURLToPath(new URL("./", import.meta.url)) }],
  },
  test: {
    include: ["test/**/*.test.ts"],
    env: {
      EXPO_PUBLIC_API_URL: "http://localhost:8787",
      EXPO_PUBLIC_CONNECTION_REGISTRY: "0x0000000000000000000000000000000000000001",
      EXPO_PUBLIC_VOUCH_REGISTRY: "0x0000000000000000000000000000000000000002",
      EXPO_PUBLIC_ATTENDANCE_REGISTRY: "0x0000000000000000000000000000000000000003",
    },
  },
});
