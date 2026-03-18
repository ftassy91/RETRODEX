#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const ROOT = path.resolve(__dirname, "..", "..");
const OUTPUT_PATH = path.join(ROOT, "data", "market_candidates.json");
const PRICES_PATH = path.join(ROOT, "RETRODEXseedV0", "prototype_v0", "data", "prices.json");
const MARKET_SALES_PATH = path.join(ROOT, "RETRODEXseedV0", "prototype_v0", "data", "market_sales.js");
const MARKET_HISTORY_PATH = path.join(ROOT, "RETRODEXseedV0", "prototype_v0", "data", "market_history.js");
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

function loadWindowObject(filePath, variableName) {
  const source = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "").trim();
  const prefix = `window.${variableName} =`;
  if (!source.startsWith(prefix)) {
    throw new Error(`Unexpected window object format in ${filePath}`);
  }
  return JSON.parse(source.slice(prefix.length).replace(/;\s*$/, "").trim());
}

function loadMarketSourceIds() {
  const prices = JSON.parse(fs.readFileSync(PRICES_PATH, "utf8").replace(/^\uFEFF/, ""));
  const pricedIds = new Set(
    prices
      .map((entry) => (entry && entry.game ? String(entry.game).trim() : ""))
      .filter(Boolean),
  );

  const salesData = loadWindowObject(MARKET_SALES_PATH, "MARKET_SALES_DATA");
  const historyData = loadWindowObject(MARKET_HISTORY_PATH, "MARKET_HISTORY_DATA");
  const verifiedGameIds = new Set([
    ...Object.keys(salesData),
    ...Object.keys(historyData),
  ]);

  return new Set(
    [...verifiedGameIds].filter((gameId) => pricedIds.has(gameId)),
  );
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function main() {
  const dbPath = getDatabasePath();
  const db = new DatabaseSync(dbPath, { readonly: true });
  const verifiedIds = loadMarketSourceIds();

  const rows = db.prepare(
    `
      SELECT id, title, console, rarity, loosePrice, cibPrice, mintPrice
      FROM games
      WHERE mintPrice IS NOT NULL
      ORDER BY mintPrice DESC, title COLLATE NOCASE, id
      LIMIT 50
    `,
  ).all();

  const candidates = rows.map((row, index) => ({
    rank: index + 1,
    id: row.id,
    title: row.title,
    console: row.console,
    rarity: row.rarity,
    loosePrice: row.loosePrice,
    cibPrice: row.cibPrice,
    mintPrice: row.mintPrice,
    alreadyVerified: verifiedIds.has(row.id),
  }));

  const verifiedCount = candidates.filter((entry) => entry.alreadyVerified).length;
  const payload = {
    generated: new Date().toISOString(),
    total: candidates.length,
    candidates,
  };

  ensureParentDir(OUTPUT_PATH);
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log("RetroDex Market Candidate Extension");
  console.log(`Database: ${dbPath}`);
  console.log(`Candidates written: ${candidates.length}`);
  console.log(`Already verified: ${verifiedCount}`);
  console.log(`New candidates: ${candidates.length - verifiedCount}`);
  console.log(`Output: ${OUTPUT_PATH}`);
}

main();
