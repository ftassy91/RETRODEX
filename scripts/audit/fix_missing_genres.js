#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
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
const UTILS_PATH = path.join(ROOT, "RETRODEXseedV0", "prototype_v0", "js", "utils.js");

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

function loadGetGenre() {
  const source = fs.readFileSync(UTILS_PATH, "utf8");
  const sandbox = {
    Intl,
    console,
    result: null,
  };
  vm.createContext(sandbox);
  vm.runInContext(`${source}\nresult = getGenre;`, sandbox, { filename: UTILS_PATH });
  if (typeof sandbox.result !== "function") {
    throw new Error(`Unable to load getGenre() from ${UTILS_PATH}`);
  }
  return sandbox.result;
}

function main() {
  const dbPath = getDatabasePath();
  const db = new DatabaseSync(dbPath);
  const getGenre = loadGetGenre();

  const rows = db.prepare(
    `
      SELECT id, title, console
      FROM games
      WHERE genre IS NULL OR TRIM(genre) = ''
      ORDER BY title COLLATE NOCASE, id
    `,
  ).all();

  const updateStatement = db.prepare("UPDATE games SET genre = ? WHERE id = ?");
  let updatedCount = 0;

  db.exec("BEGIN");
  try {
    for (const row of rows) {
      const derivedGenre = String(
        getGenre({
          id: row.id,
          title: row.title,
          console: row.console,
        }) || "",
      ).trim();

      if (!derivedGenre) {
        continue;
      }

      updateStatement.run(derivedGenre, row.id);
      updatedCount += 1;
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  console.log("RetroDex Missing Genre Fix");
  console.log(`Database: ${dbPath}`);
  console.log(`Rows inspected: ${rows.length}`);
  console.log(`Rows updated: ${updatedCount}`);
}

main();
