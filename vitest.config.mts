import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const serverOnlyStub = fileURLToPath(new URL("./src/server/testing/server-only-stub.ts", import.meta.url));

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    alias: { "server-only": serverOnlyStub },
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/server/**", "src/client/**"],
      exclude: ["**/*.test.{ts,tsx}"],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
});
