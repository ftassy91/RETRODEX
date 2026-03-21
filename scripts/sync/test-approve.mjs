import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");
const ENV_PATH = fs.existsSync(path.join(ROOT, "backend", ".env"))
  ? path.join(ROOT, "backend", ".env")
  : path.join(ROOT, ".env");
const PENDING_FILE = path.join(
  ROOT,
  "logs",
  "audit",
  "pending",
  "sync_log_2026-03-18T10-37-04-934Z_pending.json",
);
const NOTION_VERSION = "2022-06-28";

function parseEnvFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const env = {};
  for (const rawLine of content.split(/\r?\n/)) {
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

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function createNotionApiError(message, status, body) {
  const error = new Error(message);
  error.notionStatus = status;
  error.notionBody = body;
  return error;
}

function buildProperties(staged) {
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

async function notionRequest(url, options, token) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const bodyText = await response.text();
  let body;
  try {
    body = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    body = { raw: bodyText };
  }

  return {
    ok: response.ok,
    status: response.status,
    body,
  };
}

try {
  const env = parseEnvFile(ENV_PATH);
  if (!env.NOTION_API_KEY) {
    throw new Error("NOTION_API_KEY is missing.");
  }

  if (!fs.existsSync(PENDING_FILE)) {
    throw new Error("Pending file not found.");
  }

  const staged = JSON.parse(fs.readFileSync(PENDING_FILE, "utf8"));
  const schemaResult = await notionRequest(
    `https://api.notion.com/v1/databases/${staged.database.databaseId}`,
    { method: "GET" },
    env.NOTION_API_KEY,
  );
  console.log(`DATABASE_STATUS: ${schemaResult.status}`);

  if (!schemaResult.ok) {
    throw createNotionApiError(
      schemaResult.body.message || "Failed to read Notion database schema.",
      schemaResult.status,
      schemaResult.body,
    );
  }

  const pagePayload = {
    parent: {
      database_id: staged.database.databaseId,
    },
    properties: buildProperties(staged),
  };

  const createResult = await notionRequest(
    "https://api.notion.com/v1/pages",
    {
      method: "POST",
      body: JSON.stringify(pagePayload),
    },
    env.NOTION_API_KEY,
  );
  console.log(`STATUS: ${createResult.status}`);

  if (!createResult.ok) {
    throw createNotionApiError(
      createResult.body.message || "Notion page creation failed.",
      createResult.status,
      createResult.body,
    );
  }

  const approvedDir = path.join(ROOT, "logs", "audit", "approved");
  fs.mkdirSync(approvedDir, { recursive: true });
  const approvedFilePath = path.join(
    approvedDir,
    path.basename(PENDING_FILE).replace("_pending.json", "_approved.json"),
  );
  writeJson(approvedFilePath, {
    ...staged,
    status: "approved",
    approved_at: new Date().toISOString(),
    notion_result: {
      page_id: createResult.body.id,
      url: createResult.body.url,
      write_scope: "session-status-date-area-summary",
    },
  });

  fs.unlinkSync(PENDING_FILE);
  console.log(`SUCCESS: ${createResult.body.url}`);
  console.log("Pending file deleted.");
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  if (error.notionBody) {
    console.error(JSON.stringify(error.notionBody, null, 2));
  }
  process.exitCode = 1;
}
