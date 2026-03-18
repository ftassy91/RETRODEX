#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const ROOT = path.resolve(__dirname, "..", "..");
const DEFAULT_DB_PATH = path.resolve(
  ROOT,
  "..",
  "RETRODEX VERSION OK",
  "retrodex_v2_checkpoint_20260313_1722",
  "backend",
  "storage",
  "retrodex.sqlite",
);

function loadEnvFile() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) {
    return {};
  }

  const env = {};
  const lines = fs.readFileSync(envPath, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf("=");
    if (separator < 0) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key) {
      env[key] = value.replace(/^"(.*)"$/, "$1");
    }
  }
  return env;
}

function getDatabasePath() {
  const env = loadEnvFile();
  return (
    process.env.RETRODEX_SQLITE_PATH ||
    process.env.RETRODEX_DB_PATH ||
    env.RETRODEX_SQLITE_PATH ||
    env.RETRODEX_DB_PATH ||
    DEFAULT_DB_PATH
  );
}

function main() {
  const dbPath = getDatabasePath();
  const db = new DatabaseSync(dbPath);

  const flaggedCount = db.prepare(
    "SELECT COUNT(*) AS count FROM games WHERE year IS NULL OR year = 0",
  ).get().count;

  const updatedCount = db.prepare(
    "UPDATE games SET year = 0 WHERE year IS NULL",
  ).run().changes;

  console.log("RetroDex Missing Year Fix");
  console.log(`Database: ${dbPath}`);
  console.log(`Rows flagged: ${flaggedCount}`);
  console.log(`Rows updated to sentinel 0: ${updatedCount}`);
}

main();
