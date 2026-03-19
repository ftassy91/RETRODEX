#!/usr/bin/env node
"use strict";

const path = require("path");

const dbPath = path.resolve(path.join(__dirname, "../storage/retrodex.sqlite"));
process.env.RETRODEX_SQLITE_PATH = process.env.RETRODEX_SQLITE_PATH || dbPath;

console.log(`Using DB: ${dbPath}`);

const { loadPrototypeData } = require("../src/loadPrototypeData");
const { syncGamesFromPrototype } = require("../src/syncGames");

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");
  const force = args.has("--force");

  if (dryRun) {
    const games = loadPrototypeData();
    console.log(`[dry-run] Prototype source: ${path.resolve(__dirname, "../../frontend/data")}`);
    console.log(`[dry-run] Games ready to seed: ${games.length}`);
    console.log("[dry-run] No database changes were made.");
    return;
  }

  const result = await syncGamesFromPrototype({ force });
  console.log("[seed] Completed.");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error("[seed] Failed:", error);
  process.exitCode = 1;
});
