"use strict";

const fs = require("fs");
const path = require("path");

const {
  DATABASES,
  NOTION_API_KEY,
  NOTION_VERSION,
  PATHS,
} = require("./notion.config.js");
const { validatePayload } = require("./validate-payload.js");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function timestampForFile(value) {
  return value.replace(/[:.]/g, "-");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function relativeToRoot(filePath) {
  return path.relative(PATHS.root, filePath).split(path.sep).join("/");
}

function parsePayload(rawPayload) {
  if (rawPayload.startsWith("@")) {
    const filePath = path.resolve(PATHS.root, rawPayload.slice(1));
    if (!fs.existsSync(filePath)) {
      throw new Error(`Payload file not found: ${relativeToRoot(filePath)}`);
    }
    return readJson(filePath);
  }

  try {
    return JSON.parse(rawPayload);
  } catch (error) {
    throw new Error(`Invalid JSON payload: ${error.message}`);
  }
}

function getDatabaseConfig(eventType) {
  const config = DATABASES[eventType];
  if (!config) {
    throw new Error(`Unsupported event type "${eventType}".`);
  }
  return config;
}

function buildExternalWritePlan(eventType, payload) {
  if (eventType === "sync_log") {
    return {
      mode: "single_page_create",
      scope: "session-status-date-area-summary",
      property_mapping: {
        Session: payload.session,
        Status: payload.status,
        Date: payload.date,
        Area: payload.area,
        Summary: payload.summary,
      },
      write_endpoint: "https://api.notion.com/v1/pages",
    };
  }

  return {
    mode: "single_page_create",
    scope: "minimal_task_stub",
    property_mapping: payload,
    write_endpoint: "https://api.notion.com/v1/pages",
  };
}

function createNotionApiError(message, status, body) {
  const error = new Error(message);
  error.notionStatus = status;
  error.notionBody = body;
  return error;
}

function buildStageRecord(eventType, payload) {
  const config = getDatabaseConfig(eventType);
  const validation = validatePayload(eventType, payload);
  if (!validation.ok) {
    const reasons = [...validation.errors, ...validation.legacyReferences.map((item) => `Legacy reference ${item.pattern} at ${item.path}`)];
    throw new Error(reasons.join(" | "));
  }

  const stagedAt = nowIso();
  return {
    schema_version: "retrodex.notion.stage.v1",
    staged_at: stagedAt,
    status: "pending",
    event_type: eventType,
    database: {
      key: config.key,
      label: config.label,
      databaseId: config.databaseId,
    },
    payload,
    validation,
    external_write_plan: buildExternalWritePlan(eventType, payload),
  };
}

function listPending() {
  ensureDir(PATHS.pendingDir);
  const entries = fs.readdirSync(PATHS.pendingDir)
    .filter((name) => name.endsWith("_pending.json"))
    .sort();

  if (entries.length === 0) {
    console.log("No pending staged events.");
    return;
  }

  for (const name of entries) {
    console.log(relativeToRoot(path.join(PATHS.pendingDir, name)));
  }
}

function stageEvent(eventType, rawPayload) {
  ensureDir(PATHS.pendingDir);
  const payload = parsePayload(rawPayload);
  const staged = buildStageRecord(eventType, payload);
  const fileName = `${eventType}_${timestampForFile(staged.staged_at)}_pending.json`;
  const destination = path.join(PATHS.pendingDir, fileName);
  writeJson(destination, staged);
  console.log(JSON.stringify({ staged: true, file: relativeToRoot(destination), databaseId: staged.database.databaseId }, null, 2));
}

function buildDryRun(stageFilePath) {
  const absolutePath = path.resolve(PATHS.root, stageFilePath);
  const staged = readJson(absolutePath);
  return {
    stage_file: relativeToRoot(absolutePath),
    event_type: staged.event_type,
    database: staged.database,
    payload: staged.payload,
    validation: staged.validation,
    minimal_external_write: staged.external_write_plan,
  };
}

function dryRun(stageFilePath) {
  console.log(JSON.stringify(buildDryRun(stageFilePath), null, 2));
}

async function notionRequest(url, options) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${NOTION_API_KEY}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const bodyText = await response.text();
  let body;
  try {
    body = bodyText ? JSON.parse(bodyText) : {};
  } catch (_error) {
    body = { raw: bodyText };
  }

  return {
    ok: response.ok,
    status: response.status,
    body,
  };
}

async function fetchDatabaseSchema(databaseId) {
  const result = await notionRequest(`https://api.notion.com/v1/databases/${databaseId}`, {
    method: "GET",
  });
  console.log(`DATABASE_STATUS: ${result.status}`);

  if (!result.ok) {
    throw createNotionApiError(
      result.body.message || "Failed to read Notion database schema.",
      result.status,
      result.body,
    );
  }

  return result.body;
}

function buildNotionProperties(staged) {
  if (staged.event_type !== "sync_log") {
    throw new Error(`Unsupported approve mapping for event type "${staged.event_type}".`);
  }

  return {
    Session: {
      title: [
        {
          type: "text",
          text: {
            content: staged.payload.session,
          },
        },
      ],
    },
    Status: {
      select: {
        name: staged.payload.status,
      },
    },
    Date: {
      date: {
        start: staged.payload.date,
      },
    },
    Area: {
      rich_text: [
        {
          type: "text",
          text: {
            content: staged.payload.area,
          },
        },
      ],
    },
    Summary: {
      rich_text: [
        {
          type: "text",
          text: {
            content: staged.payload.summary,
          },
        },
      ],
    },
  };
}

function archiveApprovedStage(staged, stagePath, createdPage) {
  ensureDir(PATHS.approvedDir);
  const approvedRecord = {
    ...staged,
    status: "approved",
    approved_at: nowIso(),
    notion_result: {
      page_id: createdPage.id,
      url: createdPage.url,
      write_scope: staged.external_write_plan.scope,
    },
  };

  const approvedFileName = path.basename(stagePath).replace("_pending.json", "_approved.json");
  const approvedPath = path.join(PATHS.approvedDir, approvedFileName);
  writeJson(approvedPath, approvedRecord);
}

function archiveRejectedStage(staged, stagePath, reason) {
  ensureDir(PATHS.failedDir);
  const rejectedRecord = {
    ...staged,
    status: "rejected",
    rejected_at: nowIso(),
    rejection_reason: reason || "Rejected manually.",
  };

  const failedFileName = path.basename(stagePath).replace("_pending.json", "_rejected.json");
  const failedPath = path.join(PATHS.failedDir, failedFileName);
  writeJson(failedPath, rejectedRecord);
}

async function approve(stageFilePath) {
  if (!NOTION_API_KEY) {
    throw new Error("NOTION_API_KEY is missing. Populate .env or load it into the process first.");
  }

  try {
    const absolutePath = path.resolve(PATHS.root, stageFilePath);
    const staged = readJson(absolutePath);
    if (!staged.database || !staged.database.databaseId) {
      throw new Error(`No databaseId configured for staged event ${relativeToRoot(absolutePath)}.`);
    }

    await fetchDatabaseSchema(staged.database.databaseId);

    const pagePayload = {
      parent: { database_id: staged.database.databaseId },
      properties: buildNotionProperties(staged),
    };

    const createResult = await notionRequest("https://api.notion.com/v1/pages", {
      method: "POST",
      body: JSON.stringify(pagePayload),
    });
    console.log("STATUS:", createResult.status);

    if (!createResult.ok) {
      throw createNotionApiError(
        createResult.body.message || "Notion page creation failed.",
        createResult.status,
        createResult.body,
      );
    }

    archiveApprovedStage(staged, absolutePath, createResult.body);
    fs.unlinkSync(absolutePath);
    console.log("SUCCESS:", createResult.body.url);
    console.log("Pending file deleted.");
  } catch (error) {
    console.error("ERROR:", error.message);
    if (error.notionBody) {
      console.error(JSON.stringify(error.notionBody, null, 2));
    }
    error.logged = true;
    throw error;
  }
}

function printUsage() {
  console.error("Usage:");
  console.error("  node scripts/sync/sync-gate.js stage <sync_log|dev_task> '<json>'");
  console.error("  node scripts/sync/sync-gate.js stage <sync_log|dev_task> @path/to/payload.json");
  console.error("  node scripts/sync/sync-gate.js list");
  console.error("  node scripts/sync/sync-gate.js dryrun <stage-file>");
  console.error("  node scripts/sync/sync-gate.js approve <stage-file>");
  console.error("  node scripts/sync/sync-gate.js reject <stage-file>");
}

function cmdStage(eventType, rawPayload) {
  if (!eventType || !rawPayload) {
    throw new Error("Usage: node scripts/sync/sync-gate.js stage <sync_log|dev_task> '<json>'");
  }
  stageEvent(eventType, rawPayload);
}

function cmdList() {
  listPending();
}

function cmdDryrun(stageFilePath) {
  if (!stageFilePath) {
    throw new Error("Usage: node scripts/sync/sync-gate.js dryrun <stage-file>");
  }
  dryRun(stageFilePath);
}

async function cmdApprove(stageFilePath) {
  if (!stageFilePath) {
    throw new Error("Usage: node scripts/sync/sync-gate.js approve <stage-file>");
  }
  await approve(stageFilePath);
}

function cmdReject(stageFilePath) {
  if (!stageFilePath) {
    throw new Error("Usage: node scripts/sync/sync-gate.js reject <stage-file>");
  }

  const absolutePath = path.resolve(PATHS.root, stageFilePath);
  const staged = readJson(absolutePath);
  archiveRejectedStage(staged, absolutePath, "Rejected manually.");
  fs.unlinkSync(absolutePath);
  console.log(`REJECTED: ${relativeToRoot(absolutePath)}`);
}

async function main() {
  ensureDir(PATHS.pendingDir);
  ensureDir(PATHS.approvedDir);
  ensureDir(PATHS.failedDir);

  const [, , command, ...args] = process.argv;
  switch (command) {
    case "stage":
      cmdStage(args[0], args[1]);
      break;
    case "list":
      cmdList();
      break;
    case "dryrun":
      cmdDryrun(args[0]);
      break;
    case "approve":
      await cmdApprove(args[0]);
      break;
    case "reject":
      cmdReject(args[0]);
      break;
    default:
      console.log("Usage: node sync-gate.js <stage|list|dryrun|approve|reject>");
  }
}

module.exports = {
  buildDryRun,
  buildNotionProperties,
  cmdApprove,
  cmdDryrun,
  cmdList,
  cmdReject,
  cmdStage,
  approve,
  dryRun,
  getDatabaseConfig,
  listPending,
  main,
  stageEvent,
};

if (require.main === module) {
  main().then(() => process.exit(0)).catch((error) => {
    if (!error.logged) {
      console.error(error.message);
      if (error.notionBody) {
        console.error(JSON.stringify(error.notionBody, null, 2));
      }
    }
    process.exit(1);
  });
}
