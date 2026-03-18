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

function pass(message) {
  console.log(`[PASS] ${message}`);
}

function fail(message) {
  console.log(`[FAIL] ${message}`);
}

function getCoverageMetrics(db) {
  const coverage = db.prepare(
    `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN genre IS NOT NULL AND TRIM(genre) <> '' THEN 1 ELSE 0 END) AS genre_present,
        SUM(CASE WHEN summary IS NOT NULL AND TRIM(summary) <> '' THEN 1 ELSE 0 END) AS summary_present,
        SUM(CASE WHEN loosePrice IS NOT NULL AND loosePrice <> 0 THEN 1 ELSE 0 END) AS price_present
      FROM games
    `,
  ).get();

  const duplicates = db.prepare(
    `
      SELECT COUNT(*) AS duplicate_count
      FROM (
        SELECT id
        FROM games
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
    coverage_price_pct: pct(coverage.price_present),
    duplicate_count: Number(duplicates.duplicate_count || 0),
  };
}

function validateFiles() {
  const files = [
    path.join(ROOT, "data", "market_candidates.json"),
    path.join(ROOT, "logs", "checkpoints", "checkpoint_phase4_data_quality.json"),
    path.join(ROOT, "logs", "checkpoints", "checkpoint_phase5_assets_market.json"),
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

function validateSyncGate() {
  const syncGate = require(path.join(ROOT, "scripts", "sync", "sync-gate.js"));
  const notionConfig = require(path.join(ROOT, "scripts", "sync", "notion.config.js"));

  const hasTargets = Boolean(notionConfig.SYNC_TARGETS && notionConfig.SYNC_TARGETS.sync_log && notionConfig.SYNC_TARGETS.dev_task);
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
    if (totalGames >= 507) {
      pass(`Check 1 — SQLite connectivity (${totalGames} games)`);
      results.push(true);
    } else {
      fail(`Check 1 — SQLite connectivity (${totalGames} games)`);
      results.push(false);
    }

    const coverage = getCoverageMetrics(db);
    const coverageOk =
      coverage.coverage_genre_pct === 100 &&
      coverage.coverage_summary_pct === 100 &&
      coverage.coverage_price_pct === 100 &&
      coverage.duplicate_count === 0;

    if (coverageOk) {
      pass(
        `Check 2 — Data coverage (genre ${coverage.coverage_genre_pct}%, summary ${coverage.coverage_summary_pct}%, price ${coverage.coverage_price_pct}%)`,
      );
      results.push(true);
    } else {
      fail(
        `Check 2 — Data coverage (genre ${coverage.coverage_genre_pct}%, summary ${coverage.coverage_summary_pct}%, price ${coverage.coverage_price_pct}%, duplicates ${coverage.duplicate_count})`,
      );
      results.push(false);
    }

    const files = validateFiles();
    if (files.presentCount === files.files.length) {
      pass(`Check 3 — File integrity (${files.presentCount}/${files.files.length} files present)`);
      results.push(true);
    } else {
      fail(`Check 3 — File integrity (${files.presentCount}/${files.files.length} files present)`);
      results.push(false);
    }

    const syncGate = validateSyncGate();
    if (syncGate.syncGateLoaded && syncGate.hasTargets && syncGate.hasConfig && syncGate.broadDisabled) {
      pass("Check 4 — Sync gate (broadAutomationEnabled: false)");
      results.push(true);
    } else {
      fail("Check 4 — Sync gate (broadAutomationEnabled: false)");
      results.push(false);
    }

    const passed = results.filter(Boolean).length;
    if (passed === 4) {
      console.log("");
      console.log("RESULT: 4/4 checks passed. System ready.");
      return;
    }

    console.log("");
    console.log(`RESULT: ${passed}/4 checks passed. Fix failures before proceeding.`);
    process.exitCode = 1;
  } catch (error) {
    fail(`Validation runtime error (${error.message})`);
    console.log("");
    console.log(`RESULT: ${results.filter(Boolean).length}/4 checks passed. Fix failures before proceeding.`);
    process.exitCode = 1;
  } finally {
    if (db) {
      db.close();
    }
  }
}

main();
