#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..", "..");
const BACKEND_ROOT = path.join(ROOT, "backend");
const REPORT_DIR = path.join(ROOT, "data", "publish");
const LATEST_REPORT_PATH = path.join(REPORT_DIR, "latest-report.json");
const AUDIT_DIRS = [
  path.join(BACKEND_ROOT, "data", "audit"),
  path.join(ROOT, "data", "audit"),
];
const ROOT_ENV_PATH = path.join(ROOT, ".env");
const BACKEND_ENV_PATH = path.join(BACKEND_ROOT, ".env");
const NPM_COMMAND = process.platform === "win32" ? "npm.cmd" : "npm";

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const LONG_TIMEOUT_MS = 20 * 60 * 1000;

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
    const { DB_PATH } = require(path.join(BACKEND_ROOT, "src", "config", "paths.js"));
    return DB_PATH;
  } catch (_error) {
    return path.join(BACKEND_ROOT, "storage", "retrodex.sqlite");
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

function truncate(value, limit = 1200) {
  const text = String(value || "");
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit)}\n...[truncated]`;
}

function parseJsonOutput(value) {
  const text = String(value || "").trim();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (_error) {
    return null;
  }
}

function killProcessTree(pid) {
  if (!pid) {
    return;
  }
  try {
    spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
  } catch (_error) {
    // ignore
  }
}

async function runCommand(step) {
  const startedAt = new Date().toISOString();
  const started = Date.now();
  const env = buildScriptEnv();
  const cwd = step.cwd || ROOT;
  const timeoutMs = step.timeoutMs || DEFAULT_TIMEOUT_MS;
  const shouldUseCmdShell = process.platform === "win32" && /\.cmd$/i.test(String(step.command || ""));

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;

    let child;
    try {
      child = spawn(
        shouldUseCmdShell ? (process.env.ComSpec || "cmd.exe") : step.command,
        shouldUseCmdShell ? ["/d", "/s", "/c", step.command, ...step.args] : step.args,
        {
          cwd,
          env,
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
        },
      );
    } catch (error) {
      finalize({
        ok: false,
        exitCode: 1,
        skipped: false,
        error: error.message,
      });
      return;
    }

    const finalize = (payload) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve({
        label: step.label,
        command: [step.command, ...step.args].join(" "),
        startedAt,
        durationMs: Date.now() - started,
        timedOut,
        ...payload,
        stdout,
        stderr,
        parsedSummary: parseJsonOutput(stdout),
      });
    };

    const timer = setTimeout(() => {
      timedOut = true;
      killProcessTree(child.pid);
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      finalize({
        ok: false,
        exitCode: 1,
        skipped: false,
        error: error.message,
      });
    });

    child.on("close", (code) => {
      finalize({
        ok: !timedOut && code === 0,
        exitCode: timedOut ? null : code,
        skipped: false,
      });
    });
  });
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
    timedOut: false,
    stdout: "",
    stderr: "",
    parsedSummary: null,
  };
}

function findLatestAuditSummary() {
  const candidates = AUDIT_DIRS
    .filter((auditDir) => fs.existsSync(auditDir))
    .flatMap((auditDir) => fs.readdirSync(auditDir)
      .filter((fileName) => (
        fileName.endsWith("_summary.json")
        && !fileName.endsWith("_curation_summary.json")
      ))
      .map((fileName) => {
        const fullPath = path.join(auditDir, fileName);
        return {
          fileName,
          fullPath,
          mtimeMs: fs.statSync(fullPath).mtimeMs,
        };
      }))
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

function summarizePostVerify(label, parsedSummary) {
  if (!parsedSummary || typeof parsedSummary !== "object") {
    return { pendingRows: null, invalidRows: null, sampleInvalid: [] };
  }

  if (label === "publish-records") {
    const pendingRows = Number(parsedSummary.records?.pendingRows || 0)
      + Number(parsedSummary.fieldProvenance?.pendingRows || 0)
      + Number(parsedSummary.quality?.pendingRows || 0);
    const invalidRows = Number(parsedSummary.records?.invalidRows || 0)
      + Number(parsedSummary.fieldProvenance?.invalidRows || 0)
      + Number(parsedSummary.quality?.invalidRows || 0);
    const sampleInvalid = [
      ...(parsedSummary.sampleInvalid?.source_records || []),
      ...(parsedSummary.sampleInvalid?.field_provenance || []),
      ...(parsedSummary.sampleInvalid?.quality_records || []),
    ];
    return { pendingRows, invalidRows, sampleInvalid };
  }

  if (label === "publish-credits-music") {
    const pendingRows = Number(parsedSummary.people?.pendingRows || 0)
      + Number(parsedSummary.game_people?.pendingRows || 0)
      + Number(parsedSummary.ost?.pendingRows || 0)
      + Number(parsedSummary.ost_tracks?.pendingRows || 0)
      + Number(parsedSummary.ost_releases?.pendingRows || 0);
    const invalidRows = Number(parsedSummary.people?.invalidRows || 0)
      + Number(parsedSummary.game_people?.invalidRows || 0)
      + Number(parsedSummary.ost?.invalidRows || 0)
      + Number(parsedSummary.ost_tracks?.invalidRows || 0)
      + Number(parsedSummary.ost_releases?.invalidRows || 0);
    const sampleInvalid = [
      ...(parsedSummary.sampleInvalid?.people || []),
      ...(parsedSummary.sampleInvalid?.game_people || []),
      ...(parsedSummary.sampleInvalid?.ost || []),
      ...(parsedSummary.sampleInvalid?.ost_tracks || []),
    ];
    return { pendingRows, invalidRows, sampleInvalid };
  }

  if (label === "publish-media") {
    return {
      pendingRows: Number(parsedSummary.media?.pendingRows || 0),
      invalidRows: Number(parsedSummary.media?.invalidRows || 0),
      sampleInvalid: parsedSummary.media?.sampleInvalid || [],
    };
  }

  if (label === "publish-curation") {
    const pendingRows = Number(parsedSummary.profiles?.pendingRows || 0)
      + Number(parsedSummary.states?.pendingRows || 0)
      + Number(parsedSummary.events?.pendingRows || 0)
      + Number(parsedSummary.slots?.pendingRows || 0);
    const invalidRows = Number(parsedSummary.profiles?.invalidRows || 0)
      + Number(parsedSummary.states?.invalidRows || 0)
      + Number(parsedSummary.events?.invalidRows || 0)
      + Number(parsedSummary.slots?.invalidRows || 0);
    const sampleInvalid = [
      ...(parsedSummary.sampleInvalid?.profiles || []),
      ...(parsedSummary.sampleInvalid?.states || []),
      ...(parsedSummary.sampleInvalid?.events || []),
      ...(parsedSummary.sampleInvalid?.slots || []),
    ];
    return { pendingRows, invalidRows, sampleInvalid };
  }

  return { pendingRows: null, invalidRows: null, sampleInvalid: [] };
}

function buildCanonicalSteps({ dryRun, skipAudit, withLegacyMigration }) {
  const steps = [
    {
      label: "inventory",
      command: process.execPath,
      args: [path.join(ROOT, "scripts", "data", "build-local-inventory.js")],
      timeoutMs: DEFAULT_TIMEOUT_MS,
    },
    {
      label: "backfill-canonical",
      command: process.execPath,
      args: [
        path.join(ROOT, "backend", "scripts", "backfill-canonical.js"),
        `--dry-run=${dryRun ? "true" : "false"}`,
      ],
      timeoutMs: DEFAULT_TIMEOUT_MS,
    },
  ];

  if (!skipAudit) {
    steps.push({
      label: "run-audit",
      command: process.execPath,
      args: [path.join(ROOT, "backend", "scripts", "run-audit.js")],
      timeoutMs: LONG_TIMEOUT_MS,
    });
  }

  steps.push({
    label: "curation-pass1",
    command: process.execPath,
    args: [
      path.join(ROOT, "backend", "scripts", "run-pass1-curation.js"),
      ...(!dryRun ? ["--apply"] : []),
    ],
    timeoutMs: DEFAULT_TIMEOUT_MS,
  });

  if (withLegacyMigration) {
    steps.push({
      label: "publish-legacy-migration",
      command: process.execPath,
      args: [
        path.join(ROOT, "scripts", "migrate", "sqlite_to_supabase.js"),
        ...(dryRun ? ["--dry-run"] : []),
      ],
      timeoutMs: LONG_TIMEOUT_MS,
    });
  }

  const publisherFlag = dryRun ? [] : ["--apply"];
  return steps.concat([
    {
      label: "publish-structural",
      command: process.execPath,
      args: [path.join(ROOT, "backend", "scripts", "publish-structural-supabase.js"), ...publisherFlag],
      timeoutMs: DEFAULT_TIMEOUT_MS,
    },
    {
      label: "publish-records",
      command: process.execPath,
      args: [path.join(ROOT, "backend", "scripts", "publish-records-supabase.js"), ...publisherFlag],
      timeoutMs: LONG_TIMEOUT_MS,
    },
    {
      label: "publish-editorial",
      command: process.execPath,
      args: [path.join(ROOT, "backend", "scripts", "publish-editorial-supabase.js"), ...publisherFlag],
      timeoutMs: DEFAULT_TIMEOUT_MS,
    },
    {
      label: "publish-credits-music",
      command: process.execPath,
      args: [path.join(ROOT, "backend", "scripts", "publish-credits-music-supabase.js"), ...publisherFlag],
      timeoutMs: DEFAULT_TIMEOUT_MS,
    },
    {
      label: "publish-external-assets",
      command: process.execPath,
      args: [path.join(ROOT, "backend", "scripts", "publish-external-assets-supabase.js"), ...publisherFlag],
      timeoutMs: DEFAULT_TIMEOUT_MS,
    },
    {
      label: "publish-media",
      command: process.execPath,
      args: [path.join(ROOT, "backend", "scripts", "publish-media-references-supabase.js"), ...publisherFlag],
      timeoutMs: DEFAULT_TIMEOUT_MS,
    },
    {
      label: "publish-curation",
      command: process.execPath,
      args: [path.join(ROOT, "backend", "scripts", "publish-curation-supabase.js"), ...publisherFlag],
      timeoutMs: DEFAULT_TIMEOUT_MS,
    },
  ]);
}

function buildPostVerifySteps() {
  return [
    {
      label: "publish-records",
      command: process.execPath,
      args: [path.join(ROOT, "backend", "scripts", "publish-records-supabase.js")],
      timeoutMs: LONG_TIMEOUT_MS,
    },
    {
      label: "publish-credits-music",
      command: process.execPath,
      args: [path.join(ROOT, "backend", "scripts", "publish-credits-music-supabase.js")],
      timeoutMs: DEFAULT_TIMEOUT_MS,
    },
    {
      label: "publish-media",
      command: process.execPath,
      args: [path.join(ROOT, "backend", "scripts", "publish-media-references-supabase.js")],
      timeoutMs: DEFAULT_TIMEOUT_MS,
    },
    {
      label: "publish-curation",
      command: process.execPath,
      args: [path.join(ROOT, "backend", "scripts", "publish-curation-supabase.js")],
      timeoutMs: DEFAULT_TIMEOUT_MS,
    },
    {
      label: "smoke",
      command: NPM_COMMAND,
      args: ["run", "smoke"],
      timeoutMs: DEFAULT_TIMEOUT_MS,
    },
    {
      label: "backend-tests",
      command: NPM_COMMAND,
      args: ["test", "--", "--runInBand"],
      cwd: BACKEND_ROOT,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    },
  ];
}

async function runStepSequence(steps) {
  const results = [];
  for (const step of steps) {
    const result = await runCommand(step);
    results.push(result);
    if (!result.ok) {
      break;
    }
  }
  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = args.write !== true;
  const skipAudit = args["skip-audit"] === true;
  const noPostVerify = args["no-post-verify"] === true;
  const withLegacyMigration = args["with-legacy-migration"] === true;
  const env = buildEnvironmentSummary();

  let steps = [];
  let postVerify = { steps: [], enabled: !dryRun && !noPostVerify };

  if (!env.hasSupabaseUrl || !env.hasSupabaseServiceKey) {
    steps = [
      skippedStep("publish-canonical", "Missing SUPABASE_URL or service key in the current environment."),
    ];
  } else if (!env.hasValidSupabaseUrl) {
    steps = [
      skippedStep("publish-canonical", "Supabase URL is configured but is not an HTTP(S) REST URL."),
    ];
  } else {
    steps = await runStepSequence(buildCanonicalSteps({ dryRun, skipAudit, withLegacyMigration }));
    const failedStep = steps.find((step) => !step.skipped && !step.ok);

    if (!dryRun && !noPostVerify && !failedStep) {
      postVerify.steps = await runStepSequence(buildPostVerifySteps());
    }
  }

  const auditSummary = findLatestAuditSummary();
  const criticalVerifySteps = postVerify.steps
    .filter((step) => ["publish-records", "publish-credits-music", "publish-media", "publish-curation"].includes(step.label))
    .map((step) => ({
      label: step.label,
      ok: step.ok,
      timedOut: step.timedOut,
      ...summarizePostVerify(step.label, step.parsedSummary),
    }));

  const criticalPending = criticalVerifySteps
    .filter((step) => Number(step.pendingRows || 0) > 0)
    .map((step) => ({ label: step.label, pendingRows: step.pendingRows }));
  const criticalInvalid = criticalVerifySteps
    .filter((step) => Number(step.invalidRows || 0) > 0 || (step.sampleInvalid || []).length > 0)
    .map((step) => ({
      label: step.label,
      invalidRows: step.invalidRows,
      sampleInvalid: (step.sampleInvalid || []).slice(0, 5),
    }));

  const failedStep = steps.find((step) => !step.skipped && !step.ok);
  const failedPostVerifyStep = postVerify.steps.find((step) => !step.skipped && !step.ok);
  const anyTimeout = Boolean(
    [...steps, ...postVerify.steps].find((step) => step.timedOut === true)
  );

  let status = "ok";
  let validated = false;
  let converged = false;
  let decisionReason = "Dry-run only.";

  if (anyTimeout) {
    status = "timed_out";
    decisionReason = "A write or verification step exceeded its timeout.";
  } else if (failedStep || failedPostVerifyStep) {
    status = "failed";
    decisionReason = "At least one write or verification step failed.";
  } else if (dryRun) {
    status = "ok";
    decisionReason = "Dry-run completed successfully.";
  } else if (noPostVerify) {
    status = "not_validated";
    decisionReason = "Write completed but post-verify was disabled.";
  } else if (criticalPending.length || criticalInvalid.length) {
    status = "not_validated";
    decisionReason = "Write completed but post-verify still reports pending or invalid critical publishers.";
  } else {
    status = "ok";
    validated = true;
    converged = true;
    decisionReason = "Write and post-verify completed successfully with zero critical pending rows.";
  }

  if (!dryRun && !noPostVerify && !failedStep && !failedPostVerifyStep) {
    converged = criticalPending.length === 0 && criticalInvalid.length === 0;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: dryRun ? "dry-run" : "write",
    environment: env,
    auditSummary,
    status,
    validated,
    converged,
    criticalPending,
    criticalInvalid,
    decision: {
      reason: decisionReason,
    },
    steps: steps.map((step) => ({
      ...step,
      stdout: truncate(step.stdout),
      stderr: truncate(step.stderr),
    })),
    postVerify: {
      enabled: !dryRun && !noPostVerify,
      steps: postVerify.steps.map((step) => ({
        ...step,
        stdout: truncate(step.stdout),
        stderr: truncate(step.stderr),
        summary: summarizePostVerify(step.label, step.parsedSummary),
      })),
    },
  };

  const reportPaths = writeReport(report);

  console.log("\nRetroDex sandbox -> Supabase");
  console.log("============================");
  console.log(`Mode        : ${report.mode}`);
  console.log(`SQLite      : ${env.sqlitePath}`);
  console.log(`Supabase    : ${env.hasSupabaseUrl ? (env.hasValidSupabaseUrl ? "configured" : "invalid url") : "not configured"}`);
  console.log(`Legacy path : ${withLegacyMigration ? "enabled" : "disabled"}`);
  console.log(`Validated   : ${validated ? "yes" : "no"}`);
  console.log(`Converged   : ${converged ? "yes" : "no"}`);
  console.log("");

  for (const step of steps) {
    if (step.skipped) {
      console.log(`- ${step.label}: skipped (${step.reason})`);
      continue;
    }
    console.log(`- ${step.label}: ${step.ok ? "ok" : (step.timedOut ? "timed out" : "failed")} (${step.durationMs} ms)`);
  }

  if (postVerify.steps.length) {
    console.log("");
    console.log("Post-verify");
    console.log("-----------");
    for (const step of postVerify.steps) {
      console.log(`- ${step.label}: ${step.ok ? "ok" : (step.timedOut ? "timed out" : "failed")} (${step.durationMs} ms)`);
    }
  }

  console.log("");
  console.log(`Decision    : ${decisionReason}`);
  console.log(`Report      : ${reportPaths.stampedPath}`);
  console.log(`Latest      : ${reportPaths.latestPath}`);

  if (status !== "ok") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[publish-sandbox-to-supabase]", error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
