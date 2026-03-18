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

function formatYear(year) {
  return Number(year) > 0 ? String(year) : "N/A";
}

function formatMetascore(metascore) {
  return Number.isFinite(Number(metascore)) && metascore !== null ? String(metascore) : "N/A";
}

function formatText(value, fallback) {
  const text = value == null ? "" : String(value).trim();
  return text || fallback;
}

function buildSummary(row) {
  const title = formatText(row.title, "Titre inconnu");
  const genre = formatText(row.genre, "inclassable");
  const year = formatYear(row.year);
  const consoleName = formatText(row.console, "plateforme inconnue");
  const developer = formatText(row.developer, "studio inconnu");
  const metascore = formatMetascore(row.metascore);
  const rarity = formatText(row.rarity, "UNKNOWN");

  let summary = `${title} est un jeu ${genre} sorti en ${year} sur ${consoleName}, développé par ${developer}. Metascore : ${metascore} — Rareté : ${rarity}.`;

  if (rarity === "LEGENDARY" || rarity === "EPIC") {
    summary += " Considéré comme un titre rare et recherché par les collectionneurs.";
  }

  if (Number.isFinite(Number(row.metascore)) && Number(row.metascore) >= 90) {
    summary += " Unanimement salué par la critique.";
  }

  return summary;
}

function main() {
  const dbPath = getDatabasePath();
  const db = new DatabaseSync(dbPath);

  const rows = db.prepare(
    `
      SELECT id, title, console, year, developer, genre, metascore, rarity
      FROM games
      WHERE summary IS NULL OR TRIM(summary) = ''
      ORDER BY title COLLATE NOCASE, id
    `,
  ).all();

  const updateStatement = db.prepare("UPDATE games SET summary = ? WHERE id = ?");
  const sample = [];
  let updatedCount = 0;

  db.exec("BEGIN");
  try {
    for (const row of rows) {
      const summary = buildSummary(row);
      updateStatement.run(summary, row.id);
      updatedCount += 1;

      if (sample.length < 3) {
        sample.push({ title: row.title, summary });
      }
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  console.log("RetroDex Summary Enrichment");
  console.log(`Database: ${dbPath}`);
  console.log(`Rows inspected: ${rows.length}`);
  console.log(`Updated: ${updatedCount} games`);
  console.log("Sample:");
  for (const entry of sample) {
    console.log(`  ${entry.title} -> ${entry.summary}`);
  }
}

main();
