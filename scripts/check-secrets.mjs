/**
 * `npm run check:secrets` — proves the Anthropic API key cannot reach the browser.
 * Builds the frontend while a recognisable fake key is set in the environment,
 * then searches every built file for it. Exits 1 if found.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const canary = `sk-ant-CANARY-${Date.now()}`;
execSync("npm run build -w client", { stdio: "ignore", env: { ...process.env, ANTHROPIC_API_KEY: canary } });

const dist = path.resolve("client/dist");
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const leaks = walk(dist).filter((f) => {
  const text = fs.readFileSync(f, "utf8");
  return text.includes(canary) || /sk-ant-[A-Za-z0-9_-]{8,}/.test(text);
});

if (leaks.length) {
  console.error("✖ API key found in frontend build:", leaks);
  process.exit(1);
}
console.log(`✓ Built ${walk(dist).length} frontend files with a fake key in the environment — no key found in any of them.`);
