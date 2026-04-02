'use strict'

const fs = require('fs')
const path = require('path')
const Database = require('better-sqlite3')

const ROOT = path.join(__dirname, '..', '..')
require('dotenv').config({ path: path.join(ROOT, '.env') })

const { DB_PATH } = require('../../src/config/paths')

const SQLITE_PATH = DB_PATH
const AUDIT_DIR = path.join(ROOT, 'data', 'audit')
const TOP1000_DIR = path.join(AUDIT_DIR, 'top1000')
const EXTENSION200_DIR = path.join(AUDIT_DIR, 'extension200')
const TOP1200_DIR = path.join(AUDIT_DIR, 'top1200')

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function latestJsonFile(dirPath, suffix = '.json') {
  if (!fs.existsSync(dirPath)) {
    throw new Error(`Missing directory: ${dirPath}`)
  }

  const candidates = fs.readdirSync(dirPath)
    .filter((entry) => entry.endsWith(suffix))
    .map((entry) => ({
      name: entry,
      path: path.join(dirPath, entry),
      stat: fs.statSync(path.join(dirPath, entry)),
    }))
    .sort((left, right) => right.stat.mtimeMs - left.stat.mtimeMs)

  if (!candidates.length) {
    throw new Error(`No ${suffix} files found in ${dirPath}`)
  }

  return candidates[0].path
}

function parseStringFlag(argv, name, fallback = null) {
  const token = argv.find((value) => String(value).startsWith(`--${name}=`))
  if (!token) return fallback
  const value = String(token).split('=').slice(1).join('=').trim()
  return value || fallback
}

function parseNumberFlag(argv, name, fallback) {
  const token = argv.find((value) => String(value).startsWith(`--${name}=`))
  if (!token) return fallback
  const numeric = Number(String(token).split('=').slice(1).join('='))
  return Number.isFinite(numeric) ? numeric : fallback
}

function uniqueStrings(values = []) {
  return Array.from(new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => String(value || '').trim())
      .filter(Boolean)
  ))
}

function normalizeBandItems(payload) {
  if (Array.isArray(payload)) {
    return payload.map((entry) => ({ entityId: String(entry.entityId || entry.gameId || entry.id || '').trim(), ...entry }))
      .filter((entry) => entry.entityId)
  }

  const candidates = []
  if (Array.isArray(payload?.catalog)) candidates.push(...payload.catalog)
  if (Array.isArray(payload?.items)) candidates.push(...payload.items)
  if (Array.isArray(payload?.buffer)) candidates.push(...payload.buffer)

  return candidates
    .map((entry) => ({ entityId: String(entry.entityId || entry.gameId || entry.id || '').trim(), ...entry }))
    .filter((entry) => entry.entityId)
}

function loadSelectionBand(filePath) {
  const payload = readJson(filePath)
  const items = normalizeBandItems(payload)
  const explicitIds = uniqueStrings(payload?.ids)
  const ids = explicitIds.length ? explicitIds : uniqueStrings(items.map((entry) => entry.entityId))

  return {
    path: filePath,
    generatedAt: payload?.generatedAt || null,
    label: String(payload?.label || payload?.selection?.tier || path.basename(filePath)).trim(),
    ids,
    items,
    payload,
  }
}

function loadCurationMaps() {
  const db = new Database(SQLITE_PATH, { readonly: true })
  try {
    const stateRows = db.prepare(`
      SELECT game_id, status
      FROM game_curation_states
    `).all()

    const publicationRows = db.prepare(`
      SELECT game_id
      FROM console_publication_slots
      WHERE is_active = 1
    `).all()

    return {
      curationStatusById: new Map(stateRows.map((row) => [String(row.game_id), String(row.status || '').trim() || null])),
      publishedIds: new Set(publicationRows.map((row) => String(row.game_id))),
    }
  } finally {
    db.close()
  }
}

function normalizeCatalogEntry(entry, curationStatusById, publishedIds, extra = {}) {
  return {
    entityId: String(entry.entityId),
    title: entry.title,
    platform: entry.platform || null,
    tier: entry.tier || null,
    priorityScore: Number(entry.priorityScore || 0),
    completenessScore: Number(entry.completenessScore || 0),
    confidenceScore: Number(entry.confidenceScore || 0),
    sourceCoverageScore: Number(entry.sourceCoverageScore || 0),
    freshnessScore: Number(entry.freshnessScore || 0),
    missingCriticalFields: Array.isArray(entry.missingCriticalFields) ? entry.missingCriticalFields : [],
    policies: Array.isArray(entry.policies) ? entry.policies : [],
    curationStatus: curationStatusById.get(String(entry.entityId)) || null,
    isPublished: publishedIds.has(String(entry.entityId)),
    ...extra,
  }
}

module.exports = {
  ROOT,
  SQLITE_PATH,
  AUDIT_DIR,
  TOP1000_DIR,
  EXTENSION200_DIR,
  TOP1200_DIR,
  timestamp,
  ensureDir,
  readJson,
  latestJsonFile,
  parseStringFlag,
  parseNumberFlag,
  uniqueStrings,
  loadSelectionBand,
  loadCurationMaps,
  normalizeCatalogEntry,
}
