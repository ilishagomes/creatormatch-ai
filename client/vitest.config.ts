import { defineConfig } from "vitest/config";

// Unit tests for frontend logic (no browser needed). UI flows are covered by e2e/.
export default defineConfig({ test: { environment: "node", include: ["src/**/*.test.ts"] } });
