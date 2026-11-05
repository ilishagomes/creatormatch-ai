import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { SCHEMA_SQL, SCHEMA_VERSION } from "./schema.js";

export type DB = Database.Database;

/**
 * Opens (or creates) a SQLite database and makes sure the tables exist.
 * Pass ":memory:" to get a throwaway in-memory database — the tests do this
 * so they never touch your real data.
 */
export function openDatabase(filePath: string): DB {
  if (filePath !== ":memory:") {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  const db = new Database(filePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // SQLite stores a "user_version" number in the file. We use it to detect a
  // database created by an older version of this app, instead of silently
  // running against the wrong columns.
  const version = db.pragma("user_version", { simple: true }) as number;
  const hasTables = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='creators'").get();
  if (hasTables && version !== SCHEMA_VERSION) {
    db.close();
    throw new Error(
      `The database at ${filePath} was created by an older version of CreatorMatch AI. Run "npm run db:reset" to recreate it.`,
    );
  }

  db.exec(SCHEMA_SQL);
  db.pragma(`user_version = ${SCHEMA_VERSION}`);
  return db;
}
