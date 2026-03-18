"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const ENV_PATH = path.join(ROOT, ".env");
const EXAMPLE_ENV_PATH = path.join(ROOT, ".env.example");
const PATHS = {
  root: ROOT,
  pendingDir: path.join(ROOT, "logs", "audit", "pending"),
  approvedDir: path.join(ROOT, "logs", "audit", "approved"),
  failedDir: path.join(ROOT, "logs", "audit", "failed"),
};

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const env = {};
  const content = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    env[key] = value.replace(/^"(.*)"$/, "$1");
  }
  return env;
}

const fileEnv = parseEnvFile(ENV_PATH);

function readEnv(name, fallback = "") {
  if (process.env[name] && String(process.env[name]).trim()) {
    return String(process.env[name]).trim();
  }
  if (fileEnv[name] && String(fileEnv[name]).trim()) {
    return String(fileEnv[name]).trim();
  }
  return fallback;
}

const DATABASES = {
  sync_log: {
    key: "sync_log",
    label: "Codex Sync Log",
    envKey: "NOTION_DB_SYNC_LOG",
    databaseId: readEnv("NOTION_DB_SYNC_LOG"),
  },
  dev_task: {
    key: "dev_task",
    label: "RetroDex Dev Tasks",
    envKey: "NOTION_DB_DEV_TASKS",
    databaseId: readEnv("NOTION_DB_DEV_TASKS"),
  },
};

function buildTitle(eventType, payload) {
  if (eventType === "sync_log") {
    return `[Sync] ${payload.date} - ${payload.session}`;
  }
  return `[Task] ${payload.status} - ${payload.title}`;
}

module.exports = {
  ROOT,
  ENV_PATH,
  EXAMPLE_ENV_PATH,
  PATHS,
  DATABASES,
  NOTION_API_KEY: readEnv("NOTION_API_KEY"),
  NOTION_VERSION: "2022-06-28",
  buildTitle,
  readEnv,
};
