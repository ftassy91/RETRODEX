#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..", "..");
const AUDIT_REPORT_PATH = path.join(ROOT, "logs", "audit", "audit_games_report.json");

function runNodeScript(scriptPath, args = []) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: ROOT,
    encoding: "utf8",
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  if (result.status !== 0) {
    throw new Error(`${path.basename(scriptPath)} exited with code ${result.status}`);
  }
}

function readAuditReport() {
  return JSON.parse(fs.readFileSync(AUDIT_REPORT_PATH, "utf8"));
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function stageSyncEvent(summary) {
  const payload = {
    session: `daily-run-${todayStamp()}`,
    tool: "Script",
    type: "Validate data",
    status: "Success",
    area: "Automation",
    date: todayIso(),
    summary,
    errors: "",
  };

  const result = spawnSync(
    process.execPath,
    [
      path.join(ROOT, "scripts", "sync", "sync-gate.js"),
      "stage",
      "sync_log",
      JSON.stringify(payload),
    ],
    {
      cwd: ROOT,
      encoding: "utf8",
    },
  );

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  if (result.status !== 0) {
    throw new Error(`sync-gate.js stage exited with code ${result.status}`);
  }

  const staged = JSON.parse(result.stdout);
  return staged.file;
}

function main() {
  runNodeScript(path.join(ROOT, "scripts", "audit", "validate_all.js"));
  console.log("[PASS] All checks passed.");

  runNodeScript(path.join(ROOT, "scripts", "audit", "audit_games.js"));
  console.log("[AUDIT] Report written to logs/audit/audit_games_report.json");

  const auditReport = readAuditReport();
  const summary = `Daily validation: genre ${auditReport.summary.coverage_genre_pct}%, summary ${auditReport.summary.coverage_summary_pct}%, price ${auditReport.summary.coverage_price_pct}%, ${auditReport.issues.duplicate_id.length} duplicates.`;
  const stagedFile = stageSyncEvent(summary);
  console.log(`[STAGED] sync event -> ${stagedFile}`);
  console.log("Staged sync event. Run approve manually when ready.");
}

main();
