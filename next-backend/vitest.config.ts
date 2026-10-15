import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    fileParallelism: false,
    testTimeout: 45000,
    hookTimeout: 45000,
    environment: "node",
  },
});
