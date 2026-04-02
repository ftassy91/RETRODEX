'use strict';

const fs = require('fs');
const path = require('path');

const {
  CANONICAL_DIR,
  LOGS_DIR,
  POLISH_ROOT,
  PROJECT_ROOT,
  SOURCE_DB_PATH,
  formatOutputPath,
  isNullishValue,
  readJson,
  resolveBetterSqlite3,
  resolveLatestProcessedFile,
  utcDateStamp,
  utcTimestampStamp,
  writeJson,
} = require('./_shared');

function openSourceDb() {
  const Database = resolveBetterSqlite3();
  return new Database(SOURCE_DB_PATH, { readonly: true });
}

function resolveLatestEnrichedFile() {
  return resolveLatestProcessedFile('games_enriched');
}

function loadEnrichedRows(inputPath = resolveLatestEnrichedFile()) {
  return {
    inputPath,
    rows: readJson(inputPath),
  };
}

function mapEnrichedRows(rows = []) {
  const byId = new Map();
  const bySourceId = new Map();

  rows.forEach((row) => {
    if (row?.id) {
      byId.set(String(row.id), row);
    }
    if (row?.sourceId) {
      bySourceId.set(String(row.sourceId), row);
    }
  });

  return { byId, bySourceId };
}

function normalizeWhitespace(value) {
  if (typeof value !== 'string') {
    return value;
  }
  return value.replace(/\s+/g, ' ').trim();
}

function toStringList(value) {
  if (Array.isArray(value)) {
    return value
      .flatMap((entry) => toStringList(entry))
      .filter(Boolean);
  }

  if (isNullishValue(value)) {
    return [];
  }

  if (typeof value === 'object') {
    if (typeof value.name === 'string') {
      return [normalizeWhitespace(value.name)];
    }
    if (typeof value.title === 'string') {
      return [normalizeWhitespace(value.title)];
    }
    return [];
  }

  if (typeof value !== 'string') {
    return [String(value)];
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
    try {
      return toStringList(JSON.parse(trimmed));
    } catch (error) {
      // Fall through to delimiter parsing.
    }
  }

  return trimmed
    .split(/\r?\n|;|\|/)
    .flatMap((part) => part.split(/\s*,\s*/))
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);
}

function uniqueStrings(values = []) {
  return Array.from(new Set(values.map((value) => normalizeWhitespace(value)).filter(Boolean)));
}

function slugifyValue(value) {
  const base = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return base || null;
}

function confidenceTier(score) {
  if (score >= 0.8) {
    return 'trusted';
  }
  if (score >= 0.65) {
    return 'reviewed';
  }
  if (score >= 0.5) {
    return 'tentative';
  }
  return 'weak';
}

function buildConfidenceMeta(record, fallbackScore, fallbackLabel) {
  const score = Number.isFinite(Number(record?.confidenceLevel))
    ? Number(record.confidenceLevel)
    : Number.isFinite(Number(fallbackScore))
      ? Number(fallbackScore)
      : null;
  const sourceType = record?.sourceType || null;
  const complianceStatus = record?.complianceStatus || null;
  let rule = fallbackLabel || 'fallback_item_confidence';

  if (record) {
    if (complianceStatus === 'approved' && score !== null && score >= 0.8) {
      rule = 'approved_high_confidence';
    } else if ((complianceStatus === 'approved' || complianceStatus === 'approved_with_review') && score !== null && score >= 0.65) {
      rule = 'approved_reviewed';
    } else if (sourceType === 'reference_only') {
      rule = 'reference_only';
    } else if (record.isInferred) {
      rule = 'inferred';
    } else if (complianceStatus) {
      rule = `compliance_${complianceStatus}`;
    }
  }

  return {
    score,
    tier: score === null ? 'unknown' : confidenceTier(score),
    rule,
    sourceName: record?.sourceName || null,
    sourceType,
    complianceStatus,
    sourceUrl: record?.sourceUrl || null,
    verifiedAt: record?.verifiedAt || null,
    isInferred: Boolean(record?.isInferred),
  };
}

function indexFieldProvenance(db, fieldNames = []) {
  if (!fieldNames.length) {
    return new Map();
  }

  const placeholders = fieldNames.map(() => '?').join(', ');
  const rows = db.prepare(`
    SELECT
      fp.entity_id AS entityId,
      fp.field_name AS fieldName,
      fp.confidence_level AS confidenceLevel,
      fp.is_inferred AS isInferred,
      fp.verified_at AS verifiedAt,
      sr.source_name AS sourceName,
      sr.source_type AS sourceType,
      sr.source_url AS sourceUrl,
      sr.compliance_status AS complianceStatus
    FROM field_provenance fp
    LEFT JOIN source_records sr ON sr.id = fp.source_record_id
    WHERE fp.entity_type = 'game'
      AND fp.field_name IN (${placeholders})
  `).all(...fieldNames);

  const index = new Map();

  rows.forEach((row) => {
    if (!index.has(row.entityId)) {
      index.set(row.entityId, {});
    }
    const entry = index.get(row.entityId);
    if (!entry[row.fieldName]) {
      entry[row.fieldName] = [];
    }
    entry[row.fieldName].push(row);
  });

  return index;
}

function pickBestProvenance(records = []) {
  if (!records.length) {
    return null;
  }

  return [...records].sort((left, right) => {
    const confidenceDelta = Number(right.confidenceLevel || 0) - Number(left.confidenceLevel || 0);
    if (confidenceDelta !== 0) {
      return confidenceDelta;
    }
    return String(left.sourceName || '').localeCompare(String(right.sourceName || ''));
  })[0];
}

function indexMediaReferences(db) {
  const rows = db.prepare(`
    SELECT
      entity_id AS entityId,
      media_type AS mediaType,
      url,
      provider,
      compliance_status AS complianceStatus,
      storage_mode AS storageMode,
      source_record_id AS sourceRecordId
    FROM media_references
    WHERE entity_type = 'game'
  `).all();

  const index = new Map();
  rows.forEach((row) => {
    if (!index.has(row.entityId)) {
      index.set(row.entityId, {});
    }
    const entry = index.get(row.entityId);
    if (!entry[row.mediaType]) {
      entry[row.mediaType] = [];
    }
    entry[row.mediaType].push(row);
  });
  return index;
}

function indexPeople(db) {
  const rows = db.prepare(`
    SELECT
      id,
      name,
      normalized_name AS normalizedName,
      primary_role AS primaryRole
    FROM people
  `).all();

  const byId = new Map();
  rows.forEach((row) => {
    byId.set(row.id, row);
  });
  return byId;
}

function indexCompanies(db) {
  const rows = db.prepare(`
    SELECT
      id,
      name,
      role,
      country,
      founded_year AS foundedYear
    FROM companies
  `).all();

  const byId = new Map();
  rows.forEach((row) => {
    byId.set(String(row.id), row);
  });
  return byId;
}

function stripStatusPrefix(value) {
  return String(value || '').replace(/^(approved|retry|reject|rejected|pending)__+/i, '');
}

function normalizeAssetKey(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function assetCandidatesForRow(row) {
  const values = new Set();
  const titleSlug = slugifyValue(row?.title);
  const titleConsoleSlug = slugifyValue([row?.title, row?.console].filter(Boolean).join(' '));

  [
    row?.id,
    row?.slug,
    row?.sourceId,
    titleSlug,
    titleConsoleSlug,
  ].forEach((value) => {
    if (!value) {
      return;
    }
    const normalized = normalizeAssetKey(value);
    if (!normalized) {
      return;
    }
    values.add(normalized);
    values.add(normalized.replace(/-/g, '_'));
  });

  return Array.from(values);
}

function scanAssetDirectory(dirPath, allowedExtensions) {
  const results = new Map();
  if (!dirPath || !fs.existsSync(dirPath)) {
    return results;
  }

  const allowed = new Set(allowedExtensions.map((value) => value.toLowerCase()));
  const walk = (currentPath) => {
    fs.readdirSync(currentPath, { withFileTypes: true }).forEach((entry) => {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        return;
      }

      const ext = path.extname(entry.name).toLowerCase();
      if (!allowed.has(ext)) {
        return;
      }

      const key = normalizeAssetKey(stripStatusPrefix(path.basename(entry.name, ext)));
      if (!key) {
        return;
      }

      if (!results.has(key)) {
        results.set(key, []);
      }

      results.get(key).push({
        key,
        fileName: entry.name,
        fullPath,
        relativePath: path.relative(PROJECT_ROOT, fullPath).replace(/\\/g, '/'),
        extension: ext,
      });
    });
  };

  walk(dirPath);
  return results;
}

function matchAssetsForRow(row, assetIndex) {
  const candidates = assetCandidatesForRow(row);
  for (const candidate of candidates) {
    if (assetIndex.has(candidate)) {
      return assetIndex.get(candidate);
    }
  }
  return [];
}

function buildPipelinePaths(baseName, date = new Date()) {
  const dateStamp = utcDateStamp(date);
  const timestampStamp = utcTimestampStamp(date);
  return {
    dateStamp,
    timestampStamp,
    outputPath: path.join(CANONICAL_DIR, `${baseName}_${dateStamp}.json`),
    logPath: path.join(LOGS_DIR, `${baseName}_${dateStamp}_${timestampStamp}.json`),
  };
}

function writePipelineArtifacts(outputPath, payload, logPath, logPayload) {
  writeJson(outputPath, payload);
  writeJson(logPath, logPayload);
}

module.exports = {
  LOGS_DIR,
  POLISH_ROOT,
  PROJECT_ROOT,
  assetCandidatesForRow,
  buildConfidenceMeta,
  buildPipelinePaths,
  indexCompanies,
  indexFieldProvenance,
  indexMediaReferences,
  indexPeople,
  loadEnrichedRows,
  mapEnrichedRows,
  matchAssetsForRow,
  normalizeAssetKey,
  normalizeWhitespace,
  openSourceDb,
  pickBestProvenance,
  resolveLatestEnrichedFile,
  scanAssetDirectory,
  slugifyValue,
  toStringList,
  uniqueStrings,
  writePipelineArtifacts,
  formatOutputPath,
};
