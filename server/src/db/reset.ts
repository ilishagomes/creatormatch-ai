import fs from "node:fs";
import { config } from "../config.js";
import { openDatabase } from "./database.js";
import { seedCreators } from "./seed.js";

/**
 * `npm run db:reset` — deletes the database file, recreates tables, seeds creators.
 *
 * A running server keeps the OLD database file open, so resetting underneath
 * it would leave the app showing stale data. We check for that first.
 */
async function serverIsRunning(): Promise<boolean> {
  try {
    const res = await fetch(`http://localhost:${config.port}/api/health`, { signal: AbortSignal.timeout(1000) });
    return res.ok;
  } catch {
    return false;
  }
}

if (await serverIsRunning()) {
  console.error(`The API server is running on port ${config.port}. Stop "npm run dev" first, then run "npm run db:reset" again.`);
  process.exit(1);
}

for (const suffix of ["", "-wal", "-shm"]) {
  fs.rmSync(config.databasePath + suffix, { force: true });
}
const db = openDatabase(config.databasePath);
const { total } = seedCreators(db);
console.log(`Database recreated at ${config.databasePath} with ${total} creators.`);
db.close();
