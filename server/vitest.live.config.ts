import { defineConfig } from "vitest/config";

/**
 * LIVE tests call the real Anthropic API and cost a small amount of money.
 * They are NOT part of `npm test`. Run them manually with `npm run test:live`
 * after putting ANTHROPIC_API_KEY in the project's .env file.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests-live/**/*.live.test.ts"],
    testTimeout: 180_000,
    // One request at a time keeps us well inside rate limits.
    fileParallelism: false,
  },
});
