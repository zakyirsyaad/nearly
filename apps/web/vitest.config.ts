import { defineConfig } from "vitest/config";

// Terpisah dari vite.config.ts: tes web hanya menguji fungsi murni di Node,
// tanpa plugin React dan tanpa DOM.
export default defineConfig({
  test: { include: ["test/**/*.test.ts"] },
});
