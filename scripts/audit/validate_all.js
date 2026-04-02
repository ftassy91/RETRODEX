#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const ROOT = path.resolve(__dirname, "..", "..");
const DEFAULT_DB_PATH = path.join(ROOT, "backend", "storage", "retrodex.sqlite");
const HEALTH_THRESHOLDS = {
  minGames: 1000,
  minGenreCoveragePct: 90,
  minSummaryCoveragePct: 20,
  minPriceCoveragePct: 50,
  minCoverCoveragePct: 80,
  maxDuplicateCount: 0,
};

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
  const configured =
    process.env.RETRODEX_SQLITE_PATH ||
    process.env.RETRODEX_DB_PATH ||
    process.env.DB_PATH ||
    env.RETRODEX_SQLITE_PATH ||
    env.RETRODEX_DB_PATH ||
    env.DB_PATH;

  if (!configured) {
    return DEFAULT_DB_PATH;
  }

  return path.isAbsolute(configured)
    ? configured
    : path.resolve(ROOT, configured);
}

function pass(message) {
  console.log(`[PASS] ${message}`);
}

function fail(message) {
  console.log(`[FAIL] ${message}`);
}

function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, "\"\"")}"`;
}

function getTableColumns(db, tableName) {
  const rows = db.prepare(`PRAGMA table_info(${quoteIdentifier(tableName)})`).all();
  return new Set(rows.map((row) => String(row.name || "")));
}

function pickColumn(columns, candidates) {
  return candidates.find((candidate) => columns.has(candidate)) || null;
}

function presenceExpr(columns, candidates) {
  const available = candidates.filter((candidate) => columns.has(candidate));
  if (!available.length) {
    return "0";
  }

  const conditions = available
    .map((candidate) => `${quoteIdentifier(candidate)} IS NOT NULL AND TRIM(CAST(${quoteIdentifier(candidate)} AS TEXT)) <> ''`)
    .join(" OR ");
  return `CASE WHEN ${conditions} THEN 1 ELSE 0 END`;
}

function pricePresenceExpr(columns) {
  const candidate = pickColumn(columns, ["loose_price", "loosePrice"]);
  if (!candidate) {
    return "0";
  }
  return `CASE WHEN ${quoteIdentifier(candidate)} IS NOT NULL AND ${quoteIdentifier(candidate)} <> 0 THEN 1 ELSE 0 END`;
}

function getCoverageMetrics(db) {
  const columns = getTableColumns(db, "games");
  const typeColumn = pickColumn(columns, ["type"]);
  const whereClause = typeColumn ? `WHERE ${quoteIdentifier(typeColumn)} = 'game'` : "";

  const coverage = db.prepare(
    `
      SELECT
        COUNT(*) AS total,
        SUM(${presenceExpr(columns, ["genre"])}) AS genre_present,
        SUM(${presenceExpr(columns, ["summary"])}) AS summary_present,
        SUM(${presenceExpr(columns, ["cover_url", "coverImage"])}) AS cover_present,
        SUM(${pricePresenceExpr(columns)}) AS price_present
      FROM games
      ${whereClause}
    `,
  ).get();

  const duplicates = db.prepare(
    `
      SELECT COUNT(*) AS duplicate_count
      FROM (
        SELECT id
        FROM games
        ${whereClause}
        GROUP BY id
        HAVING COUNT(*) > 1
      )
    `,
  ).get();

  const total = Number(coverage.total || 0);
  const pct = (value) => (total ? Number(((Number(value || 0) / total) * 100).toFixed(2)) : 0);

  return {
    total,
    coverage_genre_pct: pct(coverage.genre_present),
    coverage_summary_pct: pct(coverage.summary_present),
    coverage_cover_pct: pct(coverage.cover_present),
    coverage_price_pct: pct(coverage.price_present),
    duplicate_count: Number(duplicates.duplicate_count || 0),
  };
}

function validateFiles() {
  const files = [
    path.join(ROOT, "CLAUDE.md"),
    path.join(ROOT, "docs", "claude-rule.md"),
    path.join(ROOT, "backend", "scripts", "publish-sandbox-to-supabase.js"),
    path.join(ROOT, "scripts", "data", "build-local-inventory.js"),
    path.join(ROOT, "scripts", "sync", "notion.config.js"),
    path.join(ROOT, "scripts", "sync", "sync-gate.js"),
    path.join(ROOT, "docs", "notion-sync-runbook.md"),
  ];

  const present = files.filter((filePath) => fs.existsSync(filePath) && fs.statSync(filePath).size > 0);
  return {
    files,
    presentCount: present.length,
    missing: files.filter((filePath) => !present.includes(filePath)),
  };
}

function validateCanonicalTables(db) {
  const requiredTables = [
    "games",
    "releases",
    "game_editorial",
    "price_observations",
    "source_records",
    "quality_records",
    "enrichment_runs",
  ];
  const sqliteTables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table'",
  ).all();
  const present = new Set(sqliteTables.map((row) => String(row.name || "")));
  const missing = requiredTables.filter((tableName) => !present.has(tableName));
  return {
    requiredTables,
    missing,
    presentCount: requiredTables.length - missing.length,
  };
}

function validateSyncGate() {
  const syncGate = require(path.join(ROOT, "scripts", "sync", "sync-gate.js"));
  const notionConfig = require(path.join(ROOT, "scripts", "sync", "notion.config.js"));

  const hasTargets = Boolean(
    notionConfig.SYNC_TARGETS
    && notionConfig.SYNC_TARGETS.sync_log
    && notionConfig.SYNC_TARGETS.dev_task,
  );
  const hasConfig = Boolean(notionConfig.CONFIG);
  const broadDisabled = notionConfig.CONFIG && notionConfig.CONFIG.broadAutomationEnabled === false;

  return {
    syncGateLoaded: Boolean(syncGate),
    hasTargets,
    hasConfig,
    broadDisabled,
  };
}

function main() {
  const results = [];
  let db;

  try {
    const dbPath = getDatabasePath();
    db = new DatabaseSync(dbPath, { readonly: true });

    const totalRow = db.prepare("SELECT COUNT(*) AS count FROM games").get();
    const totalGames = Number(totalRow.count || 0);
    if (totalGames >= HEALTH_THRESHOLDS.minGames) {
      pass(`Check 1 - SQLite sandbox reachable (${totalGames} rows in games)`);
      results.push(true);
    } else {
      fail(`Check 1 - SQLite sandbox reachable (${totalGames} rows in games)`);
      results.push(false);
    }

    const coverage = getCoverageMetrics(db);
    const coverageOk =
      coverage.coverage_genre_pct >= HEALTH_THRESHOLDS.minGenreCoveragePct &&
      coverage.coverage_summary_pct >= HEALTH_THRESHOLDS.minSummaryCoveragePct &&
      coverage.coverage_cover_pct >= HEALTH_THRESHOLDS.minCoverCoveragePct &&
      coverage.coverage_price_pct >= HEALTH_THRESHOLDS.minPriceCoveragePct &&
      coverage.duplicate_count <= HEALTH_THRESHOLDS.maxDuplicateCount;

    if (coverageOk) {
      pass(
        `Check 2 - Sandbox health (genre ${coverage.coverage_genre_pct}%, summary ${coverage.coverage_summary_pct}%, cover ${coverage.coverage_cover_pct}%, price ${coverage.coverage_price_pct}%)`,
      );
      results.push(true);
    } else {
      fail(
        `Check 2 - Sandbox health (genre ${coverage.coverage_genre_pct}%, summary ${coverage.coverage_summary_pct}%, cover ${coverage.coverage_cover_pct}%, price ${coverage.coverage_price_pct}%, duplicates ${coverage.duplicate_count})`,
      );
      results.push(false);
    }

    const files = validateFiles();
    if (files.presentCount === files.files.length) {
      pass(`Check 3 - File integrity (${files.presentCount}/${files.files.length} files present)`);
      results.push(true);
    } else {
      fail(`Check 3 - File integrity (${files.presentCount}/${files.files.length} files present)`);
      results.push(false);
    }

    const canonical = validateCanonicalTables(db);
    const syncGate = validateSyncGate();
    if (
      canonical.missing.length === 0 &&
      syncGate.syncGateLoaded &&
      syncGate.hasTargets &&
      syncGate.hasConfig &&
      syncGate.broadDisabled
    ) {
      pass("Check 4 - Canonical sandbox + sync gate");
      results.push(true);
    } else {
      fail(
        `Check 4 - Canonical sandbox + sync gate (missing tables: ${canonical.missing.join(", ") || "none"}, broadAutomationEnabled: ${String(syncGate.broadDisabled)})`,
      );
      results.push(false);
    }

    const passed = results.filter(Boolean).length;
    console.log("");
    if (passed === 4) {
      console.log("RESULT: 4/4 checks passed. Workspace aligned with CLAUDE.md.");
      return;
    }

    console.log(`RESULT: ${passed}/4 checks passed. Fix failures before publication work.`);
    process.exitCode = 1;
  } catch (error) {
    fail(`Validation runtime error (${error.message})`);
    console.log("");
    console.log(`RESULT: ${results.filter(Boolean).length}/4 checks passed. Fix failures before publication work.`);
    process.exitCode = 1;
  } finally {
    if (db) {
      db.close();
    }
  }
}

main();
