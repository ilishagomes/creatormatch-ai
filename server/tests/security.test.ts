import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { makeTestApp } from "./helpers.js";

/**
 * The Anthropic API key must only ever exist on the server. These checks
 * scan the frontend source so a future change can't accidentally leak it.
 * (scripts/check-secrets.mjs additionally builds the frontend with a fake
 * key and searches the built bundle.)
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const clientSrc = path.join(root, "client/src");

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? files(p) : /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
}
const clientCode = files(clientSrc).map((f) => ({ f: path.relative(root, f), text: fs.readFileSync(f, "utf8") }));

describe("API key stays on the backend", () => {
  it("the frontend never imports the Anthropic SDK", () => {
    for (const { f, text } of clientCode) expect(text, f).not.toMatch(/@anthropic-ai\/sdk/);
  });

  it("the frontend never reads environment variables", () => {
    for (const { f, text } of clientCode) {
      expect(text, f).not.toMatch(/process\.env/);
      expect(text, f).not.toMatch(/import\.meta\.env/);
    }
  });

  it("the frontend never calls the Anthropic API directly", () => {
    for (const { f, text } of clientCode) expect(text, f).not.toMatch(/api\.anthropic\.com/);
  });

  it("the Vite config only loads PORT from .env (never the API key)", () => {
    const vite = fs.readFileSync(path.join(root, "client/vite.config.ts"), "utf8");
    expect(vite).toMatch(/loadEnv\(.*,\s*"PORT"\)/);
    expect(vite).not.toMatch(/ANTHROPIC|define\s*:|envPrefix/);
  });

  it(".env is git-ignored and .env.example contains no key", () => {
    expect(fs.readFileSync(path.join(root, ".gitignore"), "utf8")).toMatch(/^\.env$/m);
    expect(fs.readFileSync(path.join(root, ".env.example"), "utf8")).toMatch(/^ANTHROPIC_API_KEY=\s*$/m);
  });

  it("the health endpoint only reports whether AI is configured", async () => {
    const { app } = makeTestApp();
    const res = await request(app).get("/api/health");
    expect(Object.keys(res.body).sort()).toEqual(["aiConfigured", "status"]);
  });
});
