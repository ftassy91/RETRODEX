#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const ROOT = path.resolve(__dirname, "..", "..");
const REPORT_PATH = path.join(ROOT, "logs", "audit", "audit_games_report.json");
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

function utcNow() {
  return new Date().toISOString();
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function pct(part, total) {
  if (!total) {
    return 0;
  }
  return Number(((part / total) * 100).toFixed(2));
}

function issueEntry(row, extra = {}) {
  return {
    id: row.id,
    title: row.title,
    console: row.console,
    year: row.year,
    ...extra,
  };
}

function main() {
  const dbPath = getDatabasePath();
  const db = new DatabaseSync(dbPath, { readonly: true });

  const rows = db.prepare(
    `
      SELECT id, title, console, year, developer, genre, summary, loosePrice
      FROM games
      ORDER BY title COLLATE NOCASE, id
    `,
  ).all();

  const duplicateRows = db.prepare(
    `
      SELECT id, COUNT(*) AS count
      FROM games
      GROUP BY id
      HAVING COUNT(*) > 1
      ORDER BY id
    `,
  ).all();

  const duplicateIds = new Set(duplicateRows.map((row) => row.id));

  const issues = {
    missing_title: [],
    missing_platform: [],
    missing_year: [],
    missing_developer: [],
    missing_genre: [],
    missing_summary: [],
    missing_price: [],
    duplicate_id: duplicateRows.map((row) => ({ id: row.id, count: row.count })),
    year_out_of_range: [],
  };

  let genrePresent = 0;
  let summaryPresent = 0;
  let pricePresent = 0;
  let criticalIssueCount = 0;

  for (const row of rows) {
    let hasCriticalIssue = false;

    if (row.title == null || String(row.title).trim() === "") {
      issues.missing_title.push(issueEntry(row));
      hasCriticalIssue = true;
    }
    if (row.console == null || String(row.console).trim() === "") {
      issues.missing_platform.push(issueEntry(row));
      hasCriticalIssue = true;
    }
    if (row.year == null || row.year === 0) {
      issues.missing_year.push(issueEntry(row));
      hasCriticalIssue = true;
    }
    if (row.year != null && row.year !== 0 && (row.year < 1970 || row.year > 2012)) {
      issues.year_out_of_range.push(issueEntry(row, { actual_year: row.year }));
      hasCriticalIssue = true;
    }
    if (row.developer == null || String(row.developer).trim() === "") {
      issues.missing_developer.push(issueEntry(row));
      hasCriticalIssue = true;
    }
    if (row.genre == null || String(row.genre).trim() === "") {
      issues.missing_genre.push(issueEntry(row));
      hasCriticalIssue = true;
    } else {
      genrePresent += 1;
    }
    if (row.summary == null || String(row.summary).trim() === "") {
      issues.missing_summary.push(issueEntry(row));
    } else {
      summaryPresent += 1;
    }
    if (row.loosePrice == null || Number(row.loosePrice) === 0) {
      issues.missing_price.push(issueEntry(row, { loosePrice: row.loosePrice }));
      hasCriticalIssue = true;
    } else {
      pricePresent += 1;
    }
    if (duplicateIds.has(row.id)) {
      hasCriticalIssue = true;
    }

    if (hasCriticalIssue) {
      criticalIssueCount += 1;
    }
  }

  const total = rows.length;
  const report = {
    timestamp: utcNow(),
    total,
    issues,
    summary: {
      games_with_issues: criticalIssueCount,
      games_clean: total - criticalIssueCount,
      coverage_genre_pct: pct(genrePresent, total),
      coverage_summary_pct: pct(summaryPresent, total),
      coverage_price_pct: pct(pricePresent, total),
    },
  };

  ensureParentDir(REPORT_PATH);
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log("RetroDex Games Audit");
  console.log(`Database: ${dbPath}`);
  console.log(`Total games: ${total}`);
  console.log(`Critical issue count: ${report.summary.games_with_issues}`);
  console.log(`Critical clean games: ${report.summary.games_clean}`);
  console.log(`Missing genre: ${issues.missing_genre.length}`);
  console.log(`Missing summary: ${issues.missing_summary.length}`);
  console.log(`Missing loosePrice: ${issues.missing_price.length}`);
  console.log(`Duplicate IDs: ${issues.duplicate_id.length}`);
  console.log(`Year out of range: ${issues.year_out_of_range.length}`);
  console.log(`Genre coverage: ${report.summary.coverage_genre_pct}%`);
  console.log(`Summary coverage: ${report.summary.coverage_summary_pct}%`);
  console.log(`Price coverage: ${report.summary.coverage_price_pct}%`);
  console.log(`Report written to: ${REPORT_PATH}`);
}

main();
