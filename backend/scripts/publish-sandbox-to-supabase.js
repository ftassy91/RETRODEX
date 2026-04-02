#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..", "..");
const REPORT_DIR = path.join(ROOT, "data", "publish");
const LATEST_REPORT_PATH = path.join(REPORT_DIR, "latest-report.json");
const ROOT_ENV_PATH = path.join(ROOT, ".env");
const BACKEND_ENV_PATH = path.join(ROOT, "backend", ".env");

function parseArgs(argv) {
  return argv.reduce((acc, token) => {
    const [rawKey, rawValue] = token.split("=");
    acc[rawKey.replace(/^--/, "")] = rawValue == null ? true : rawValue;
    return acc;
  }, {});
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const env = {};
  const lines = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/);
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
    const value = line.slice(separator + 1).trim().replace(/^"(.*)"$/, "$1");
    if (key) {
      env[key] = value;
    }
  }
  return env;
}

function buildScriptEnv() {
  return {
    ...loadEnvFile(ROOT_ENV_PATH),
    ...loadEnvFile(BACKEND_ENV_PATH),
    ...process.env,
  };
}

function normalizeSupabaseUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  const match = trimmed.match(/db\.([a-z0-9]+)\.supabase\.co/i);
  if (match) {
    return `https://${match[1]}.supabase.co`;
  }

  return trimmed;
}

function resolveSupabaseUrl(env) {
  return normalizeSupabaseUrl(
    env.SUPABASE_URL || env.SUPABASE_Project_URL || env.SUPERDATA_Project_URL || "",
  );
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function getSqlitePath() {
  try {
    const { DB_PATH } = require(path.join(ROOT, "backend", "src", "config", "paths.js"));
    return DB_PATH;
  } catch (_error) {
    return path.join(ROOT, "backend", "storage", "retrodex.sqlite");
  }
}

function buildEnvironmentSummary() {
  const env = buildScriptEnv();
  const supabaseUrl = resolveSupabaseUrl(env);
  return {
    sqlitePath: getSqlitePath(),
    hasSupabaseUrl: Boolean(supabaseUrl),
    hasValidSupabaseUrl: isHttpUrl(supabaseUrl),
    hasSupabaseServiceKey: Boolean(
      env.SUPABASE_SERVICE_KEY
      || env.SUPABASE_SERVICE_ROLE_KEY
      || env.SUPERDATA_SERVICE_KEY
    ),
  };
}

function runCommand(label, command, args) {
  const startedAt = new Date().toISOString();
  const started = Date.now();
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    env: buildScriptEnv(),
  });

  return {
    label,
    command: [command, ...args].join(" "),
    startedAt,
    durationMs: Date.now() - started,
    ok: result.status === 0,
    exitCode: result.status,
    skipped: false,
    stdout: String(result.stdout || "").trim(),
    stderr: String(result.stderr || "").trim(),
  };
}

function skippedStep(label, reason) {
  return {
    label,
    skipped: true,
    ok: true,
    reason,
    command: null,
    exitCode: 0,
    durationMs: 0,
    stdout: "",
    stderr: "",
  };
}

function truncate(value, limit = 1200) {
  const text = String(value || "");
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit)}\n...[truncated]`;
}

function findLatestAuditSummary() {
  const auditDir = path.join(ROOT, "data", "audit");
  if (!fs.existsSync(auditDir)) {
    return null;
  }

  const candidates = fs.readdirSync(auditDir)
    .filter((fileName) => fileName.endsWith("_summary.json"))
    .map((fileName) => {
      const fullPath = path.join(auditDir, fileName);
      return {
        fileName,
        fullPath,
        mtimeMs: fs.statSync(fullPath).mtimeMs,
      };
    })
    .sort((left, right) => right.mtimeMs - left.mtimeMs);

  if (!candidates.length) {
    return null;
  }

  const latest = candidates[0];
  return {
    path: path.relative(ROOT, latest.fullPath),
    payload: JSON.parse(fs.readFileSync(latest.fullPath, "utf8")),
  };
}

function writeReport(report) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const timestamp = report.generatedAt.replace(/[:.]/g, "-");
  const stampedPath = path.join(REPORT_DIR, `${timestamp}-report.json`);
  const body = `${JSON.stringify(report, null, 2)}\n`;
  fs.writeFileSync(stampedPath, body);
  fs.writeFileSync(LATEST_REPORT_PATH, body);
  return {
    stampedPath,
    latestPath: LATEST_REPORT_PATH,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = args.write !== true;
  const env = buildEnvironmentSummary();
  const steps = [];

  steps.push(runCommand(
    "inventory",
    process.execPath,
    [path.join(ROOT, "scripts", "data", "build-local-inventory.js")],
  ));

  steps.push(runCommand(
    "backfill-canonical",
    process.execPath,
    [
      path.join(ROOT, "backend", "scripts", "backfill-canonical.js"),
      `--dry-run=${dryRun ? "true" : "false"}`,
    ],
  ));

  steps.push(runCommand(
    "run-audit",
    process.execPath,
    [path.join(ROOT, "backend", "scripts", "run-audit.js")],
  ));

  const curationArgs = [path.join(ROOT, "backend", "scripts", "run-pass1-curation.js")];
  if (!dryRun) {
    curationArgs.push("--apply");
  }
  steps.push(runCommand("curation-pass1", process.execPath, curationArgs));

  if (!env.hasSupabaseUrl || !env.hasSupabaseServiceKey) {
    steps.push(skippedStep(
      "publish-supabase",
      "Missing SUPABASE_URL or service key in the current environment.",
    ));
    steps.push(skippedStep(
      "publish-structural",
      "Missing SUPABASE_URL or service key in the current environment.",
    ));
    steps.push(skippedStep(
      "publish-media",
      "Missing SUPABASE_URL or service key in the current environment.",
    ));
    steps.push(skippedStep(
      "publish-records",
      "Missing SUPABASE_URL or service key in the current environment.",
    ));
    steps.push(skippedStep(
      "publish-editorial",
      "Missing SUPABASE_URL or service key in the current environment.",
    ));
    steps.push(skippedStep(
      "publish-credits-music",
      "Missing SUPABASE_URL or service key in the current environment.",
    ));
    steps.push(skippedStep(
      "publish-external-assets",
      "Missing SUPABASE_URL or service key in the current environment.",
    ));
    steps.push(skippedStep(
      "publish-curation",
      "Missing SUPABASE_URL or service key in the current environment.",
    ));
  } else if (!env.hasValidSupabaseUrl) {
    steps.push(skippedStep(
      "publish-supabase",
      "Supabase URL is configured but is not an HTTP(S) REST URL.",
    ));
    steps.push(skippedStep(
      "publish-structural",
      "Supabase URL is configured but is not an HTTP(S) REST URL.",
    ));
    steps.push(skippedStep(
      "publish-media",
      "Supabase URL is configured but is not an HTTP(S) REST URL.",
    ));
    steps.push(skippedStep(
      "publish-records",
      "Supabase URL is configured but is not an HTTP(S) REST URL.",
    ));
    steps.push(skippedStep(
      "publish-editorial",
      "Supabase URL is configured but is not an HTTP(S) REST URL.",
    ));
    steps.push(skippedStep(
      "publish-credits-music",
      "Supabase URL is configured but is not an HTTP(S) REST URL.",
    ));
    steps.push(skippedStep(
      "publish-external-assets",
      "Supabase URL is configured but is not an HTTP(S) REST URL.",
    ));
    steps.push(skippedStep(
      "publish-curation",
      "Supabase URL is configured but is not an HTTP(S) REST URL.",
    ));
  } else {
    const publishArgs = [path.join(ROOT, "scripts", "migrate", "sqlite_to_supabase.js")];
    if (dryRun) {
      publishArgs.push("--dry-run");
    }
    steps.push(runCommand("publish-supabase", process.execPath, publishArgs));

    const structuralArgs = [path.join(ROOT, "backend", "scripts", "publish-structural-supabase.js")];
    if (!dryRun) {
      structuralArgs.push("--apply");
    }
    steps.push(runCommand("publish-structural", process.execPath, structuralArgs));

    const mediaArgs = [path.join(ROOT, "backend", "scripts", "publish-media-references-supabase.js")];
    if (!dryRun) {
      mediaArgs.push("--apply");
    }
    steps.push(runCommand("publish-media", process.execPath, mediaArgs));

    const recordsArgs = [path.join(ROOT, "backend", "scripts", "publish-records-supabase.js")];
    if (!dryRun) {
      recordsArgs.push("--apply");
    }
    steps.push(runCommand("publish-records", process.execPath, recordsArgs));

    const editorialArgs = [path.join(ROOT, "backend", "scripts", "publish-editorial-supabase.js")];
    if (!dryRun) {
      editorialArgs.push("--apply");
    }
    steps.push(runCommand("publish-editorial", process.execPath, editorialArgs));

    const creditsMusicArgs = [path.join(ROOT, "backend", "scripts", "publish-credits-music-supabase.js")];
    if (!dryRun) {
      creditsMusicArgs.push("--apply");
    }
    steps.push(runCommand("publish-credits-music", process.execPath, creditsMusicArgs));

    const externalAssetsArgs = [path.join(ROOT, "backend", "scripts", "publish-external-assets-supabase.js")];
    if (!dryRun) {
      externalAssetsArgs.push("--apply");
    }
    steps.push(runCommand("publish-external-assets", process.execPath, externalAssetsArgs));

    const curationPublishArgs = [path.join(ROOT, "backend", "scripts", "publish-curation-supabase.js")];
    if (!dryRun) {
      curationPublishArgs.push("--apply");
    }
    steps.push(runCommand("publish-curation", process.execPath, curationPublishArgs));
  }

  const auditSummary = findLatestAuditSummary();
  const report = {
    generatedAt: new Date().toISOString(),
    mode: dryRun ? "dry-run" : "write",
    precedence: "CLAUDE.md",
    environment: env,
    auditSummary,
    steps: steps.map((step) => ({
      ...step,
      stdout: truncate(step.stdout),
      stderr: truncate(step.stderr),
    })),
  };

  const reportPaths = writeReport(report);
  const failed = steps.filter((step) => !step.skipped && !step.ok);

  console.log("\nRetroDex sandbox -> Supabase");
  console.log("============================");
  console.log(`Mode        : ${report.mode}`);
  console.log(`SQLite      : ${env.sqlitePath}`);
  console.log(`Supabase    : ${
    env.hasSupabaseUrl
      ? (env.hasValidSupabaseUrl ? "configured" : "invalid url")
      : "not configured"
  }`);
  console.log("");

  for (const step of steps) {
    if (step.skipped) {
      console.log(`- ${step.label}: skipped (${step.reason})`);
      continue;
    }
    console.log(`- ${step.label}: ${step.ok ? "ok" : "failed"} (${step.durationMs} ms)`);
  }

  console.log("");
  console.log(`Report      : ${reportPaths.stampedPath}`);
  console.log(`Latest      : ${reportPaths.latestPath}`);

  if (failed.length) {
    process.exitCode = 1;
  }
}

main();
