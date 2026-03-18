#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const ROOT = path.resolve(__dirname, "..", "..");
const DEFAULT_SQLITE_PATH = path.join(ROOT, "backend", "storage", "retrodex.sqlite");

function resolveSqlitePath() {
  const configuredPath = process.env.RETRODEX_SQLITE_PATH || DEFAULT_SQLITE_PATH;
  return path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(ROOT, configuredPath);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set to migrate data to PostgreSQL.");
  }

  const sqlitePath = resolveSqlitePath();
  if (!fs.existsSync(sqlitePath)) {
    throw new Error(`SQLite source not found: ${sqlitePath}`);
  }

  const { sequelize } = require("../../backend/src/database");
  const Game = require("../../backend/src/models/Game");
  require("../../backend/src/models/CollectionItem");

  const source = new DatabaseSync(sqlitePath, { readonly: true });
  const rows = source.prepare(`
    SELECT
      id, title, console, year, developer, genre, metascore, rarity,
      summary, loosePrice, cibPrice, mintPrice, createdAt, updatedAt
    FROM games
    ORDER BY title COLLATE NOCASE, id
  `).all();

  await sequelize.authenticate();
  await sequelize.sync();

  let migrated = 0;
  for (const row of rows) {
    await Game.upsert({
      id: row.id,
      title: row.title,
      console: row.console,
      year: row.year,
      developer: row.developer,
      genre: row.genre,
      metascore: row.metascore,
      rarity: row.rarity,
      summary: row.summary,
      loosePrice: row.loosePrice,
      cibPrice: row.cibPrice,
      mintPrice: row.mintPrice,
      createdAt: row.createdAt || new Date(),
      updatedAt: row.updatedAt || new Date(),
    });
    migrated += 1;
  }

  await sequelize.close();

  console.log("RetroDex PostgreSQL Migration");
  console.log(`SQLite source: ${sqlitePath}`);
  console.log("PostgreSQL target: connected via DATABASE_URL");
  console.log(`Migrated ${migrated} games`);
}

main().catch(async (error) => {
  console.error(error.message);
  try {
    const { sequelize } = require("../../backend/src/database");
    await sequelize.close();
  } catch (_error) {
    // Ignore close errors during early boot failures.
  }
  process.exit(1);
});
