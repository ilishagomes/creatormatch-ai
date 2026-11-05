import { createApp } from "./app.js";
import { config } from "./config.js";
import { openDatabase, type DB } from "./db/database.js";
import { seedCreators } from "./db/seed.js";
import { createCreatorRepository } from "./repositories/creatorRepository.js";

/** Prints a clear, actionable message instead of a stack trace, then exits. */
function fail(message: string): never {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

let db: DB;
try {
  db = openDatabase(config.databasePath);
  // First run: if the creators table is empty, seed it automatically.
  if (createCreatorRepository(db).count() === 0) {
    console.log(`Seeded ${seedCreators(db).total} creators.`);
  }
} catch (err) {
  fail((err as Error).message);
}

const app = createApp(db);

// Express 5 passes startup errors (e.g. port already in use) to this callback.
const server = app.listen(config.port, (err?: Error) => {
  if (err) {
    const code = (err as NodeJS.ErrnoException).code;
    fail(code === "EADDRINUSE"
      ? `Port ${config.port} is already in use — another CreatorMatch server is probably still running. Stop it (Ctrl+C in its terminal) or set PORT in .env.`
      : `Could not start the API server: ${err.message}`);
  }
  console.log(`CreatorMatch API running on http://localhost:${config.port}`);
  console.log(`AI model: ${config.anthropicModel}`);
  if (!config.anthropicApiKey) {
    console.warn("ANTHROPIC_API_KEY is not set — outreach generation will return a clear error.");
  }
});

// Close the database cleanly on Ctrl+C.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => server.close(() => (db.close(), process.exit(0))));
}
