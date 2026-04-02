'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');
const Database = require('better-sqlite3');
const { Client } = require('pg');

const ROOT = path.resolve(__dirname, '..', '..');
const BACKEND_ROOT = path.join(ROOT, 'backend');
const SQLITE_PATH = path.join(BACKEND_ROOT, 'storage', 'retrodex.sqlite');
const POLISH_CANONICAL_DIR = path.join(ROOT, 'polish-retrodex', 'data', 'canonical');
const POLISH_OUTPUTS_DIR = path.join(ROOT, 'polish-retrodex', 'outputs');

dotenv.config({ path: path.join(BACKEND_ROOT, '.env') });

function parseArgs(argv) {
  return argv.reduce((acc, token) => {
    const [rawKey, ...rest] = String(token || '').split('=');
    const key = rawKey.replace(/^--/, '');
    const value = rest.length ? rest.join('=') : true;
    if (key) {
      acc[key] = value;
    }
    return acc;
  }, {});
}

function parseIdFilter(args = {}) {
  const raw = args.ids;
  if (!raw || raw === true) {
    return null;
  }

  const values = String(raw)
    .split(',')
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  return values.length ? new Set(values) : null;
}

function hasTargetGameId(filterIds, ...values) {
  if (!filterIds || filterIds.size === 0) {
    return true;
  }

  return values.some((value) => value != null && filterIds.has(String(value).trim()));
}

function parseProjectReference() {
  const raw =
    process.env.SUPABASE_URL
    || process.env.SUPABASE_Project_URL
    || process.env.SUPERDATA_Project_URL
    || '';
  const match = String(raw).match(/doipqgkhfzqvmzrdfvuq|([a-z0-9]{20})/i);
  return match ? String(match[0]) : '';
}

function buildRemotePgConfig() {
  const projectReference = parseProjectReference();
  const rawUrl = process.env.SUPABASE_Project_URL || process.env.DATABASE_URL || '';
  const passwordMatch = rawUrl.match(/postgres(?:\.[^:]+)?:\[?([^\]@]+)\]?@/i);
  const password = passwordMatch ? passwordMatch[1] : '';

  if (!projectReference || !password) {
    throw new Error('Missing Supabase pooler configuration. Expected project ref and password in backend/.env.');
  }

  return {
    host: 'aws-1-eu-west-1.pooler.supabase.com',
    port: 6543,
    user: `postgres.${projectReference}`,
    password,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
  };
}

function createRemoteClient() {
  return new Client(buildRemotePgConfig());
}

function openReadonlySqlite() {
  return new Database(SQLITE_PATH, { readonly: true });
}

function normalizeText(value) {
  if (value == null) {
    return null;
  }

  const text = String(value).trim();
  return text || null;
}

function normalizeTimestamp(value) {
  if (value == null || value === '') {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return normalized;
}

function normalizeKeyPart(value) {
  return String(value == null ? '' : value).trim();
}

function parseJsonLike(value, fallback = null) {
  if (value == null || value === '') {
    return fallback;
  }

  if (Array.isArray(value) || typeof value === 'object') {
    return value;
  }

  if (typeof value !== 'string') {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
}

function sortJsonValue(value) {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortJsonValue(value[key]);
        return acc;
      }, {});
  }

  return value;
}

function stringifyJson(value) {
  if (value == null) {
    return null;
  }
  return JSON.stringify(sortJsonValue(value));
}

function normalizeJsonForDiff(value) {
  if (value == null || value === '') {
    return null;
  }

  if (typeof value === 'string') {
    const normalized = String(value).trim();
    if (!normalized) {
      return null;
    }

    if (/^[\[{"]/.test(normalized)) {
      try {
        return stringifyJson(JSON.parse(normalized));
      } catch (_error) {
        return JSON.stringify(normalized);
      }
    }

    return JSON.stringify(normalized);
  }

  if (Array.isArray(value) || typeof value === 'object') {
    return stringifyJson(value);
  }

  return String(value);
}

function normalizeBooleanForDiff(value) {
  const normalized = coerceBoolean(value);
  return normalized == null ? null : normalized;
}

function normalizeNumberForDiff(value) {
  return coerceNumber(value);
}

function rowsDiffer(fields, remoteRow, localRow, normalizers = {}) {
  return fields.some((field) => {
    const normalize = normalizers[field] || ((value) => value ?? null);
    return normalize(remoteRow?.[field]) !== normalize(localRow?.[field]);
  });
}

function slugifyAscii(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function shortStableHash(value) {
  return crypto.createHash('sha1').update(String(value || ''), 'utf8').digest('hex').slice(0, 10);
}

function buildCanonicalPersonId(name, options = {}) {
  const rawName = normalizeText(name);
  const fallbackSeed = normalizeText(options.fallbackSeed);

  if (!rawName && !fallbackSeed) {
    return null;
  }

  const slug = slugifyAscii(rawName);
  if (slug) {
    return `person:${slug}`;
  }

  const seed = rawName || fallbackSeed;
  if (!seed) {
    return null;
  }

  return `person:unnamed-${shortStableHash(seed)}`;
}

function isValidPersonId(value) {
  return /^person:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(value || '').trim());
}

function coerceBoolean(value) {
  if (value == null || value === '') {
    return null;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }

  const normalized = String(value).trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (['1', 'true', 'yes'].includes(normalized)) return true;
  if (['0', 'false', 'no'].includes(normalized)) return false;
  return null;
}

function coerceNumber(value) {
  if (value == null || value === '') {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function readJsonIfExists(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJsonLines(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  return fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function findLatestFile(directory, prefix, extension = '.json') {
  if (!fs.existsSync(directory)) {
    return null;
  }

  const candidates = fs.readdirSync(directory)
    .filter((fileName) => fileName.startsWith(prefix) && fileName.endsWith(extension))
    .map((fileName) => {
      const fullPath = path.join(directory, fileName);
      return {
        fileName,
        fullPath,
        mtimeMs: fs.statSync(fullPath).mtimeMs,
      };
    })
    .sort((left, right) => right.mtimeMs - left.mtimeMs);

  return candidates[0] || null;
}

function readLatestCanonicalJson(prefix) {
  const latest = findLatestFile(POLISH_CANONICAL_DIR, prefix, '.json');
  if (!latest) {
    return null;
  }
  return {
    path: latest.fullPath,
    payload: JSON.parse(fs.readFileSync(latest.fullPath, 'utf8')),
  };
}

async function tableExists(client, tableName) {
  const { rows } = await client.query(
    `SELECT to_regclass($1) AS relation_name`,
    [`public.${tableName}`]
  );
  return Boolean(rows[0]?.relation_name);
}

async function getColumnSet(client, tableName) {
  const { rows } = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1
     ORDER BY ordinal_position ASC`,
    [tableName]
  );

  return new Set(rows.map((row) => String(row.column_name)));
}

function buildSourceRecordKey(row) {
  return [
    normalizeKeyPart(row.entity_type),
    normalizeKeyPart(row.entity_id),
    normalizeKeyPart(row.field_name),
    normalizeKeyPart(row.source_name),
    normalizeKeyPart(row.source_type),
  ].join('::');
}

function buildFieldProvenanceKey(row) {
  return [
    normalizeKeyPart(row.entity_type),
    normalizeKeyPart(row.entity_id),
    normalizeKeyPart(row.field_name),
  ].join('::');
}

function buildQualityRecordKey(row) {
  return [
    normalizeKeyPart(row.entity_type),
    normalizeKeyPart(row.entity_id),
  ].join('::');
}

function buildPersonKey(row) {
  return normalizeKeyPart(row.id || row.person_id || row.normalized_name || row.name);
}

function buildGamePeopleKey(row) {
  return [
    normalizeKeyPart(row.game_id),
    normalizeKeyPart(row.person_id),
    normalizeKeyPart(row.role),
  ].join('::');
}

function buildOstKey(row) {
  return normalizeKeyPart(row.id);
}

function buildOstTrackKey(row) {
  return [
    normalizeKeyPart(row.ost_id),
    normalizeKeyPart(row.track_number),
    normalizeKeyPart(row.track_title),
  ].join('::');
}

function buildOstReleaseKey(row) {
  return [
    normalizeKeyPart(row.ost_id),
    normalizeKeyPart(row.region_code),
    normalizeKeyPart(row.release_date),
    normalizeKeyPart(row.catalog_number),
    normalizeKeyPart(row.label),
  ].join('::');
}

function buildMediaKey(row) {
  return [
    normalizeKeyPart(row.entity_type),
    normalizeKeyPart(row.entity_id),
    normalizeKeyPart(row.media_type),
    normalizeKeyPart(row.url),
  ].join('::');
}

function mapBy(rows, keyBuilder) {
  return new Map((rows || []).map((row) => [keyBuilder(row), row]));
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueBy(items, keyBuilder) {
  const seen = new Set();
  const next = [];
  for (const item of items || []) {
    const key = keyBuilder(item);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    next.push(item);
  }
  return next;
}

async function fetchRemoteSourceRecords(client) {
  const exists = await tableExists(client, 'source_records');
  if (!exists) {
    return [];
  }
  const { rows } = await client.query(`
    SELECT id, entity_type, entity_id, field_name, source_name, source_type,
           source_url, source_license, compliance_status, ingested_at,
           last_verified_at, confidence_level, notes
    FROM public.source_records
  `);
  return rows;
}

function buildLocalSourceRecordIndex(rows) {
  const byId = new Map();
  const byKey = new Map();

  for (const row of rows || []) {
    const key = buildSourceRecordKey(row);
    if (row.id != null) {
      byId.set(Number(row.id), row);
    }
    byKey.set(key, row);
  }

  return { byId, byKey };
}

function buildRemoteSourceRecordIndex(rows) {
  return mapBy(rows, buildSourceRecordKey);
}

module.exports = {
  ROOT,
  BACKEND_ROOT,
  SQLITE_PATH,
  POLISH_CANONICAL_DIR,
  POLISH_OUTPUTS_DIR,
  parseArgs,
  parseIdFilter,
  hasTargetGameId,
  parseProjectReference,
  buildRemotePgConfig,
  createRemoteClient,
  openReadonlySqlite,
  normalizeText,
  normalizeTimestamp,
  normalizeKeyPart,
  parseJsonLike,
  stringifyJson,
  normalizeJsonForDiff,
  normalizeBooleanForDiff,
  normalizeNumberForDiff,
  rowsDiffer,
  coerceBoolean,
  coerceNumber,
  slugifyAscii,
  buildCanonicalPersonId,
  isValidPersonId,
  readJsonIfExists,
  readJsonLines,
  findLatestFile,
  readLatestCanonicalJson,
  tableExists,
  getColumnSet,
  buildSourceRecordKey,
  buildFieldProvenanceKey,
  buildQualityRecordKey,
  buildPersonKey,
  buildGamePeopleKey,
  buildOstKey,
  buildOstTrackKey,
  buildOstReleaseKey,
  buildMediaKey,
  mapBy,
  toArray,
  uniqueBy,
  fetchRemoteSourceRecords,
  buildLocalSourceRecordIndex,
  buildRemoteSourceRecordIndex,
};
