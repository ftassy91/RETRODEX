'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const POLISH_ROOT = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(POLISH_ROOT, '..');
const DATA_DIR = path.join(POLISH_ROOT, 'data');
const RAW_DIR = path.join(DATA_DIR, 'raw');
const PROCESSED_DIR = path.join(DATA_DIR, 'processed');
const CANONICAL_DIR = path.join(DATA_DIR, 'canonical');
const LOGS_DIR = path.join(POLISH_ROOT, 'logs');
const SOURCE_DB_PATH = path.join(PROJECT_ROOT, 'backend', 'storage', 'retrodex.sqlite');

function resolveBetterSqlite3() {
  return require(path.join(PROJECT_ROOT, 'backend', 'node_modules', 'better-sqlite3'));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function ensureWorkspace() {
  [RAW_DIR, PROCESSED_DIR, CANONICAL_DIR, LOGS_DIR].forEach(ensureDir);
}

function utcDateStamp(date = new Date()) {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

function utcTimestampStamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function writeJson(filePath, payload) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function isNullishValue(value) {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}

function collectFieldNames(rows = []) {
  const fields = new Set();
  rows.forEach((row) => {
    Object.keys(row || {}).forEach((key) => fields.add(key));
  });
  return Array.from(fields).sort((left, right) => left.localeCompare(right));
}

function collectNulls(rows = []) {
  const result = {};
  const fields = collectFieldNames(rows);

  fields.forEach((field) => {
    result[field] = rows.reduce((count, row) => count + (isNullishValue(row?.[field]) ? 1 : 0), 0);
  });

  return result;
}

function buildCompleteness(rows = []) {
  const total = rows.length;
  return collectFieldNames(rows).map((field) => {
    const missing = rows.reduce((count, row) => count + (isNullishValue(row?.[field]) ? 1 : 0), 0);
    const filled = total - missing;
    return {
      field,
      total,
      filled,
      missing,
      completeness_pct: total ? Math.round((filled / total) * 10000) / 100 : 0,
    };
  }).sort((left, right) => {
    if (left.missing !== right.missing) {
      return right.missing - left.missing;
    }
    return left.field.localeCompare(right.field);
  });
}

function resolveLatestRawFile() {
  return resolveLatestMatchingFile(RAW_DIR, /^games_\d{8}\.json$/, 'raw games file');
}

function resolveLatestMatchingFile(dirPath, pattern, description) {
  ensureDir(dirPath);
  const matches = fs.readdirSync(dirPath)
    .filter((fileName) => pattern.test(fileName))
    .sort();

  if (!matches.length) {
    throw new Error(`No ${description} found in ${path.relative(POLISH_ROOT, dirPath).replace(/\\/g, '/')}.`);
  }

  return path.join(dirPath, matches[matches.length - 1]);
}

function resolveLatestProcessedFile(kind = 'games_enriched') {
  return resolveLatestMatchingFile(
    PROCESSED_DIR,
    new RegExp(`^${kind}_\\d{8}\\.json$`),
    `processed ${kind} file`
  );
}

function resolveLatestCanonicalFile(kind) {
  return resolveLatestMatchingFile(
    CANONICAL_DIR,
    new RegExp(`^${kind}_\\d{8}\\.json$`),
    `canonical ${kind} file`
  );
}

function formatOutputPath(filePath) {
  return path.relative(POLISH_ROOT, filePath).replace(/\\/g, '/');
}

module.exports = {
  CANONICAL_DIR,
  DATA_DIR,
  LOGS_DIR,
  POLISH_ROOT,
  PROCESSED_DIR,
  PROJECT_ROOT,
  RAW_DIR,
  SOURCE_DB_PATH,
  buildCompleteness,
  collectFieldNames,
  collectNulls,
  ensureWorkspace,
  formatOutputPath,
  isNullishValue,
  readJson,
  resolveBetterSqlite3,
  resolveLatestCanonicalFile,
  resolveLatestMatchingFile,
  resolveLatestProcessedFile,
  resolveLatestRawFile,
  sha256,
  utcDateStamp,
  utcTimestampStamp,
  writeJson,
};
