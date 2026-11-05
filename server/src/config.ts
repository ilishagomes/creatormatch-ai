import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// The .env file lives in the project root (one level above /server).
const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.resolve(serverRoot, "..", ".env"), quiet: true });

/**
 * All environment variables are read in ONE place, so the rest of the
 * code never touches process.env directly. The API key is only ever
 * read on the server — it is never sent to the browser.
 */
export const config = {
  port: Number(process.env.PORT ?? 3001),
  databasePath: path.resolve(serverRoot, process.env.DATABASE_PATH ?? "./data/creatormatch.db"),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY?.trim() || null,
  anthropicModel: process.env.ANTHROPIC_MODEL?.trim() || "claude-opus-5-5",
};
