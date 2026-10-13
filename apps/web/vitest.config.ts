import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@staff": path.resolve(import.meta.dirname, "../../staff"),
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  test: { include: ["src/**/*.test.ts"] },
});
