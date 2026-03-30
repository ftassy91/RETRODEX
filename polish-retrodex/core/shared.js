"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const {
  PROJECT_ROOT,
  SOURCE_DB_PATH,
  resolveBetterSqlite3,
} = require("../pipelines/_shared");

const POLISH_ROOT = path.resolve(__dirname, "..");
const CONFIG_DIR = path.join(POLISH_ROOT, "config");
const OUTPUTS_DIR = path.join(POLISH_ROOT, "outputs");
const LOGS_DIR = path.join(POLISH_ROOT, "logs");
const RUN_REPORTS_DIR = path.join(LOGS_DIR, "run_reports");
const CHECKPOINTS_DIR = path.join(LOGS_DIR, "checkpoints");

const OUTPUT_FILES = {
  source_records: path.join(OUTPUTS_DIR, "source_records.jsonl"),
  normalized_records: path.join(OUTPUTS_DIR, "normalized_records.jsonl"),
  match_candidates: path.join(OUTPUTS_DIR, "match_candidates.jsonl"),
  external_assets: path.join(OUTPUTS_DIR, "external_assets.jsonl"),
  review_queue: path.join(OUTPUTS_DIR, "review_queue.jsonl"),
  ui_payloads: path.join(OUTPUTS_DIR, "ui_payloads.jsonl"),
};

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function ensureBaseDirs() {
  ensureDir(OUTPUTS_DIR);
  ensureDir(LOGS_DIR);
  ensureDir(RUN_REPORTS_DIR);
  ensureDir(CHECKPOINTS_DIR);
}

function nowIso() {
  return new Date().toISOString();
}

function timestampForId(value = nowIso()) {
  return value.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
}

function createRunId(prefix = "prd") {
  return `${prefix}-${timestampForId()}`;
}

function relativeToProject(filePath) {
  return path.relative(PROJECT_ROOT, filePath).split(path.sep).join("/");
}

function readJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, payload) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const content = fs.readFileSync(filePath, "utf8");
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function getLatestRunId(filePath) {
  const rows = readJsonl(filePath);
  const last = rows[rows.length - 1];
  return last?.run_id || null;
}

function appendJsonl(filePath, records) {
  const list = Array.isArray(records) ? records : [records];
  if (!list.length) {
    return;
  }
  ensureDir(path.dirname(filePath));
  const lines = list.map((item) => JSON.stringify(item)).join("\n");
  fs.appendFileSync(filePath, `${lines}\n`, "utf8");
}

function writeReportMarkdown(fileName, content) {
  ensureDir(RUN_REPORTS_DIR);
  const filePath = path.join(RUN_REPORTS_DIR, fileName);
  fs.writeFileSync(filePath, `${content.replace(/\s+$/, "")}\n`, "utf8");
  return filePath;
}

function appendPipelineLog(level, stage, message, extra = null) {
  ensureBaseDirs();
  const payload = {
    at: nowIso(),
    level,
    stage,
    message,
    ...(extra ? { extra } : {}),
  };
  fs.appendFileSync(path.join(LOGS_DIR, "pipeline.log"), `${JSON.stringify(payload)}\n`, "utf8");
  if (level === "error") {
    fs.appendFileSync(path.join(LOGS_DIR, "errors.log"), `${JSON.stringify(payload)}\n`, "utf8");
  }
}

function stableHash(value) {
  return crypto.createHash("sha1").update(String(value)).digest("hex");
}

function buildScopedId(prefix, parts) {
  return `${prefix}_${stableHash(parts.join("::")).slice(0, 16)}`;
}

function parseArgs(argv) {
  const args = {};
  for (const token of argv) {
    if (!token.startsWith("--")) {
      continue;
    }
    const raw = token.slice(2);
    const eqIndex = raw.indexOf("=");
    if (eqIndex === -1) {
      args[raw] = true;
      continue;
    }
    const key = raw.slice(0, eqIndex);
    const value = raw.slice(eqIndex + 1);
    if (Object.prototype.hasOwnProperty.call(args, key)) {
      const existing = args[key];
      args[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
    } else {
      args[key] = value;
    }
  }
  return args;
}

function toArray(value) {
  if (value == null) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => String(item).split(",")).map((item) => item.trim()).filter(Boolean);
  }
  return String(value).split(",").map((item) => item.trim()).filter(Boolean);
}

function loadConfig(name) {
  return readJson(path.join(CONFIG_DIR, name));
}

function getCheckpointPath(stage, sourceName) {
  return path.join(CHECKPOINTS_DIR, `${stage}__${sourceName}.json`);
}

function readCheckpoint(stage, sourceName) {
  return readJson(getCheckpointPath(stage, sourceName), {});
}

function writeCheckpoint(stage, sourceName, payload) {
  const checkpoint = {
    stage,
    source_name: sourceName,
    updated_at: nowIso(),
    ...payload,
  };
  writeJson(getCheckpointPath(stage, sourceName), checkpoint);
  return checkpoint;
}

async function fetchText(url, options = {}) {
  const {
    timeoutMs = 20000,
    headers = {},
    method = "GET",
  } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "user-agent": "RetroDex Polish Pipeline/1.0 (+https://retrodex-beryl.vercel.app)",
        "accept-language": "en-US,en;q=0.9",
        ...headers,
      },
      redirect: "follow",
      signal: controller.signal,
    });

    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      url: response.url,
      text,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function absolutizeUrl(baseUrl, maybeRelative) {
  if (!maybeRelative) {
    return null;
  }
  try {
    return new URL(maybeRelative, baseUrl).toString();
  } catch (_error) {
    return null;
  }
}

function loadCanonicalGames() {
  const exportPath = path.join(PROJECT_ROOT, "data", "exports", "games_export.json");
  const exported = readJson(exportPath, null);

  if (exported) {
    const list = Array.isArray(exported)
      ? exported
      : Array.isArray(exported.games)
        ? exported.games
        : Array.isArray(exported.data)
          ? exported.data
          : [];
    if (list.length) {
      return list;
    }
  }

  const BetterSqlite3 = resolveBetterSqlite3();
  const db = new BetterSqlite3(SOURCE_DB_PATH, { readonly: true });
  try {
    return db.prepare(`
      SELECT id, title, slug, console, type, developer, genre, year
      FROM games
      WHERE COALESCE(type, 'game') != 'console'
    `).all();
  } finally {
    db.close();
  }
}

module.exports = {
  CHECKPOINTS_DIR,
  CONFIG_DIR,
  LOGS_DIR,
  OUTPUT_FILES,
  OUTPUTS_DIR,
  POLISH_ROOT,
  PROJECT_ROOT,
  RUN_REPORTS_DIR,
  SOURCE_DB_PATH,
  absolutizeUrl,
  appendJsonl,
  appendPipelineLog,
  buildScopedId,
  createRunId,
  ensureBaseDirs,
  ensureDir,
  fetchText,
  getLatestRunId,
  loadCanonicalGames,
  loadConfig,
  normalizeWhitespace,
  nowIso,
  parseArgs,
  readCheckpoint,
  readJson,
  readJsonl,
  relativeToProject,
  stableHash,
  timestampForId,
  toArray,
  writeCheckpoint,
  writeJson,
  writeReportMarkdown,
};
