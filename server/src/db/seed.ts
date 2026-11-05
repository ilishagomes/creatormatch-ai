import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DB } from "./database.js";
import { createCreatorRepository } from "../repositories/creatorRepository.js";
import { creatorSeedSchema, type CreatorSeed } from "../validation/creator.js";

export const DATA_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data/creators.json");

export function loadCreatorFile(file = DATA_FILE): unknown[] {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/**
 * Validates every creator. If ANY creator is invalid, nothing is written and
 * the error names the creator and the field.
 */
export function validateCreators(raw: unknown[]): CreatorSeed[] {
  const seen = new Set<string>();
  return raw.map((item, index) => {
    const result = creatorSeedSchema.safeParse(item);
    const name = (item as { name?: string })?.name ?? `#${index}`;
    if (!result.success) {
      const problems = result.error.issues.map((i) => `${i.path.join(".") || "creator"}: ${i.message}`).join("; ");
      throw new Error(`Invalid creator "${name}": ${problems}`);
    }
    const key = `${result.data.primaryPlatform}:${result.data.handle.toLowerCase()}`;
    if (seen.has(key)) throw new Error(`Duplicate creator "${name}" (${key})`);
    seen.add(key);
    return result.data;
  });
}

export interface SeedResult {
  total: number;
  removed: number;
}

/**
 * Upserts every creator from the dataset and removes creators that are no
 * longer in it — all inside one transaction, so it's all-or-nothing.
 * Existing creators keep their ids, so saved drafts are preserved.
 */
export function seedCreators(db: DB, raw: unknown[] = loadCreatorFile()): SeedResult {
  const creators = validateCreators(raw);
  const repo = createCreatorRepository(db);
  return db.transaction(() => {
    const ids = creators.map((c) => repo.upsert(c));
    const removed = repo.deleteAllExcept(ids);
    return { total: ids.length, removed };
  })();
}
