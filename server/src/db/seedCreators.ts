import { config } from "../config.js";
import { openDatabase } from "./database.js";
import { seedCreators } from "./seed.js";

/**
 * `npm run db:seed` — loads src/data/creators.json into the database WITHOUT
 * deleting campaigns or drafts. Run it after editing the dataset.
 */
const db = openDatabase(config.databasePath);
const { total, removed } = seedCreators(db);
console.log(`Seeded ${total} creators into ${config.databasePath}${removed ? ` (removed ${removed} no longer in the dataset)` : ""}.`);
db.close();
