"use strict";

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function findLegacyReferences(value, pathPrefix = "$") {
  const hits = [];
  const legacyPatterns = [
    { regex: /prototype_v2/i, label: "prototype_v2" },
    { regex: /RETRODEX VERSION OK/i, label: "RETRODEX VERSION OK" },
    { regex: /file:\/\//i, label: "file://" },
  ];

  if (typeof value === "string") {
    for (const pattern of legacyPatterns) {
      if (pattern.regex.test(value)) {
        hits.push({ path: pathPrefix, pattern: pattern.label, value });
      }
    }
    return hits;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      hits.push(...findLegacyReferences(item, `${pathPrefix}[${index}]`));
    });
    return hits;
  }

  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      hits.push(...findLegacyReferences(item, `${pathPrefix}.${key}`));
    }
  }

  return hits;
}

function validateSyncLog(payload) {
  const errors = [];
  const requiredFields = ["session", "tool", "type", "status", "area", "date", "summary", "errors"];

  for (const field of requiredFields) {
    if (!isNonEmptyString(payload[field]) && !(field === "errors" && payload[field] === "")) {
      errors.push(`Field "${field}" must be a string.`);
    }
  }

  if (isNonEmptyString(payload.date) && !/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) {
    errors.push('Field "date" must use YYYY-MM-DD.');
  }

  return errors;
}

function validateDevTask(payload) {
  const errors = [];
  const requiredFields = ["title", "status", "area", "summary"];
  for (const field of requiredFields) {
    if (!isNonEmptyString(payload[field])) {
      errors.push(`Field "${field}" must be a non-empty string.`);
    }
  }

  if (payload.due_date && !/^\d{4}-\d{2}-\d{2}$/.test(payload.due_date)) {
    errors.push('Field "due_date" must use YYYY-MM-DD when provided.');
  }

  return errors;
}

function validatePayload(eventType, payload) {
  const errors = [];

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    errors.push("Payload must be a JSON object.");
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
      warnings: [],
      legacyReferences: [],
    };
  }

  if (eventType === "sync_log") {
    errors.push(...validateSyncLog(payload));
  } else if (eventType === "dev_task") {
    errors.push(...validateDevTask(payload));
  } else {
    errors.push(`Unsupported event type "${eventType}".`);
  }

  const legacyReferences = findLegacyReferences(payload);

  return {
    ok: errors.length === 0 && legacyReferences.length === 0,
    errors,
    warnings: [],
    legacyReferences,
  };
}

function main() {
  const [, , eventType, rawPayload] = process.argv;
  if (!eventType || !rawPayload) {
    console.error("Usage: node scripts/sync/validate-payload.js <sync_log|dev_task> '<json>'");
    process.exit(1);
  }

  let payload;
  try {
    payload = JSON.parse(rawPayload);
  } catch (error) {
    console.error(JSON.stringify({ ok: false, errors: [error.message] }, null, 2));
    process.exit(1);
  }

  const result = validatePayload(eventType, payload);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = {
  validatePayload,
  findLegacyReferences,
};
