"use strict";

const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const ROOT = path.resolve(__dirname, "..", "..");
const DEFAULT_DB_PATH = path.join(ROOT, "backend", "storage", "retrodex.sqlite");

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
  const configuredPath =
    process.env.RETRODEX_SQLITE_PATH ||
    process.env.RETRODEX_DB_PATH ||
    env.RETRODEX_SQLITE_PATH ||
    env.RETRODEX_DB_PATH ||
    DEFAULT_DB_PATH;

  return path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(ROOT, configuredPath);
}

function openDatabase(options = {}) {
  return new DatabaseSync(getDatabasePath(), options);
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map((value) => value.trim());
}

function parseCsvRows(csvText) {
  const lines = csvText.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length === 0) {
    throw new Error("CSV file is empty.");
  }

  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    return row;
  });

  return { headers, rows };
}

function normalizeText(value) {
  const text = value == null ? "" : String(value).trim();
  return text || null;
}

function normalizeNumber(value) {
  const text = value == null ? "" : String(value).trim();
  if (!text) {
    return null;
  }

  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function requiredColumnsPresent(headers) {
  const required = [
    "id",
    "title",
    "console",
    "year",
    "developer",
    "genre",
    "rarity",
    "loosePrice",
    "cibPrice",
    "mintPrice",
    "summary",
  ];

  const missing = required.filter((column) => !headers.includes(column));
  if (missing.length > 0) {
    throw new Error(`Missing required CSV columns: ${missing.join(", ")}`);
  }
}

function importGamesFromCSV(csvPath) {
  const absolutePath = path.isAbsolute(csvPath) ? csvPath : path.resolve(ROOT, csvPath);
  if (!fs.existsSync(absolutePath)) {
    return { imported: 0, skipped: 0, errors: [`CSV file not found: ${absolutePath}`] };
  }

  const csvText = fs.readFileSync(absolutePath, "utf8");
  const { headers, rows } = parseCsvRows(csvText);
  requiredColumnsPresent(headers);

  const db = openDatabase();
  const now = new Date().toISOString();
  const insert = db.prepare(`
    INSERT OR REPLACE INTO games (
      id, title, console, year, developer, genre, rarity,
      summary, loosePrice, cibPrice, mintPrice, createdAt, updatedAt
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `);

  const result = {
    imported: 0,
    skipped: 0,
    errors: [],
  };

  db.exec("BEGIN");
  try {
    for (const row of rows) {
      const id = normalizeText(row.id);
      const title = normalizeText(row.title);

      if (!id || !title) {
        result.skipped += 1;
        continue;
      }

      try {
        insert.run(
          id,
          title,
          normalizeText(row.console),
          normalizeNumber(row.year),
          normalizeText(row.developer),
          normalizeText(row.genre),
          normalizeText(row.rarity),
          normalizeText(row.summary),
          normalizeNumber(row.loosePrice),
          normalizeNumber(row.cibPrice),
          normalizeNumber(row.mintPrice),
          now,
          now,
        );
        result.imported += 1;
      } catch (error) {
        result.errors.push(`Row ${id}: ${error.message}`);
      }
    }

    if (result.errors.length > 0) {
      db.exec("ROLLBACK");
      return result;
    }

    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    return {
      imported: result.imported,
      skipped: result.skipped,
      errors: [...result.errors, error.message],
    };
  }
}

function validateGames() {
  const db = openDatabase({ readonly: true });

  const total = db.prepare("SELECT COUNT(*) AS count FROM games").get().count;
  const missingTitle = db.prepare("SELECT COUNT(*) AS count FROM games WHERE title IS NULL OR TRIM(title) = ''").get().count;
  const missingGenre = db.prepare("SELECT COUNT(*) AS count FROM games WHERE genre IS NULL OR TRIM(genre) = ''").get().count;
  const missingSummary = db.prepare("SELECT COUNT(*) AS count FROM games WHERE summary IS NULL OR TRIM(summary) = ''").get().count;
  const duplicates = db.prepare(`
    SELECT COUNT(*) AS count
    FROM (
      SELECT id
      FROM games
      GROUP BY id
      HAVING COUNT(*) > 1
    )
  `).get().count;

  return {
    total,
    missing_title: missingTitle,
    missing_genre: missingGenre,
    missing_summary: missingSummary,
    duplicates,
  };
}

function pct(part, total) {
  if (!total) {
    return 0;
  }
  return Number(((part / total) * 100).toFixed(2));
}

function getImportStats() {
  const db = openDatabase({ readonly: true });
  const total = db.prepare("SELECT COUNT(*) AS count FROM games").get().count;

  const genreCount = db.prepare("SELECT COUNT(*) AS count FROM games WHERE genre IS NOT NULL AND TRIM(genre) <> ''").get().count;
  const summaryCount = db.prepare("SELECT COUNT(*) AS count FROM games WHERE summary IS NOT NULL AND TRIM(summary) <> ''").get().count;
  const priceCount = db.prepare(`
    SELECT COUNT(*) AS count
    FROM games
    WHERE loosePrice IS NOT NULL AND loosePrice > 0
      AND cibPrice IS NOT NULL AND cibPrice > 0
      AND mintPrice IS NOT NULL AND mintPrice > 0
  `).get().count;

  return {
    total,
    genre_pct: pct(genreCount, total),
    summary_pct: pct(summaryCount, total),
    price_pct: pct(priceCount, total),
  };
}

module.exports = {
  importGamesFromCSV,
  validateGames,
  getImportStats,
};
