import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Semua tes berbagi satu database Postgres dev.
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 300_000,
  },
});
