"use strict";

const fs = require("fs");
const path = require("path");

const { SYNC_TARGETS, PATHS } = require("./notion.config.js");
const syncGate = require("./sync-gate.js");

const TARGET_MAP = {
  sync_log: "sync_log",
  dev_tasks: "dev_task",
};

function listPendingFiles() {
  if (!fs.existsSync(PATHS.pendingDir)) {
    return [];
  }

  return fs.readdirSync(PATHS.pendingDir)
    .filter((name) => name.endsWith("_pending.json"))
    .sort();
}

function resolveTarget(target) {
  const mappedTarget = TARGET_MAP[target];
  if (!mappedTarget) {
    throw new Error(`Unsupported sync target "${target}". Use "sync_log" or "dev_tasks".`);
  }

  const config = SYNC_TARGETS[mappedTarget];
  if (!config || !config.databaseId) {
    throw new Error(`Sync target "${target}" is not enabled in notion.config.js.`);
  }

  return mappedTarget;
}

async function syncEvent(target, data) {
  try {
    const mappedTarget = resolveTarget(target);
    const before = new Set(listPendingFiles());
    const originalConsoleLog = console.log;
    let stagedOutput = null;

    console.log = (...args) => {
      stagedOutput = args.join(" ");
    };

    try {
      syncGate.stageEvent(mappedTarget, JSON.stringify(data));
    } finally {
      console.log = originalConsoleLog;
    }

    const createdFile = listPendingFiles().find((name) => !before.has(name));
    if (createdFile) {
      return { ok: true, file: createdFile };
    }

    if (stagedOutput) {
      try {
        const parsed = JSON.parse(stagedOutput);
        if (parsed.file) {
          return {
            ok: true,
            file: path.basename(String(parsed.file)),
          };
        }
      } catch (_error) {
        // Fall through to the explicit error below if staging output is not JSON.
      }
    }

    return { ok: false, error: "Stage completed but no pending file could be identified." };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

module.exports = { syncEvent };

/*
Usage example:

const sync = require("./sync-module");
await sync.syncEvent("sync_log", {
  session: "S18",
  tool: "Script",
  type: "Validate data",
  status: "Success",
  area: "Automation",
  date: new Date().toISOString().slice(0, 10),
  summary: "Daily validation passed.",
  errors: "",
});
*/
