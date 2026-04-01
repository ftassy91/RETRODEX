'use strict'

const fs = require('fs')
const path = require('path')

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..')

const DEFAULTS_BY_TYPE = {
  premium: {
    publishDomains: ['records', 'editorial', 'media', 'ui'],
    postChecks: ['records', 'editorial', 'media', 'ui'],
    writeTargets: ['games', 'game_editorial', 'media_references', 'source_records', 'field_provenance'],
  },
  composers: {
    publishDomains: ['records', 'credits_music', 'ui'],
    postChecks: ['records', 'credits_music', 'ui'],
    writeTargets: ['games', 'game_people', 'people', 'source_records', 'field_provenance'],
  },
  summary: {
    publishDomains: ['records', 'editorial', 'ui'],
    postChecks: ['records', 'editorial', 'ui'],
    writeTargets: ['games', 'game_editorial', 'source_records', 'field_provenance'],
  },
  dev_team: {
    publishDomains: ['records', 'credits_music', 'ui'],
    postChecks: ['records', 'credits_music', 'ui'],
    writeTargets: ['games', 'game_people', 'people', 'source_records', 'field_provenance'],
  },
  media: {
    publishDomains: ['media'],
    postChecks: ['media'],
    writeTargets: ['media_references', 'source_records', 'field_provenance'],
  },
}

function resolveManifestPath(inputPath) {
  const resolved = path.isAbsolute(inputPath)
    ? inputPath
    : path.resolve(REPO_ROOT, inputPath)

  if (!fs.existsSync(resolved)) {
    throw new Error(`Batch manifest not found: ${resolved}`)
  }

  return resolved
}

function normalizeBatchType(value, fallback = 'premium') {
  const raw = String(value || fallback).trim().toLowerCase()
  if (raw === 'composer') return 'composers'
  if (raw === 'premium') return 'premium'
  if (raw === 'summary') return 'summary'
  if (raw === 'dev_team' || raw === 'devteam') return 'dev_team'
  if (raw === 'media') return 'media'
  return raw
}

function normalizeIds(payload = [], explicitIds = []) {
  const fromPayload = Array.isArray(payload)
    ? payload.map((entry) => String(entry?.gameId || entry?.id || '')).filter(Boolean)
    : []

  return Array.from(new Set([...(explicitIds || []).map((value) => String(value || '')).filter(Boolean), ...fromPayload]))
}

function normalizeManifestShape(parsed, manifestPath) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Invalid batch manifest: ${manifestPath}`)
  }

  const inferredType = normalizeBatchType(parsed.batchType || parsed.type || (Array.isArray(parsed.payload) ? 'premium' : 'premium'))
  const defaults = DEFAULTS_BY_TYPE[inferredType] || DEFAULTS_BY_TYPE.premium
  const payload = Array.isArray(parsed.payload) ? parsed.payload : []
  const ids = normalizeIds(payload, Array.isArray(parsed.ids) ? parsed.ids : [])

  if (!parsed.batchKey) {
    throw new Error(`Batch manifest missing batchKey: ${manifestPath}`)
  }
  if (!payload.length) {
    throw new Error(`Batch manifest missing payload entries: ${manifestPath}`)
  }

  return {
    manifestPath,
    batchKey: String(parsed.batchKey),
    batchType: inferredType,
    notes: String(parsed.notes || `${inferredType} batch ${parsed.batchKey}`),
    ids,
    payload,
    sources: Array.isArray(parsed.sources) ? parsed.sources : [],
    writeTargets: Array.isArray(parsed.writeTargets) && parsed.writeTargets.length ? parsed.writeTargets : defaults.writeTargets,
    publishDomains: Array.isArray(parsed.publishDomains) && parsed.publishDomains.length ? parsed.publishDomains : defaults.publishDomains,
    postChecks: Array.isArray(parsed.postChecks) && parsed.postChecks.length ? parsed.postChecks : defaults.postChecks,
    generatedFrom: parsed.generatedFrom || null,
    reviewStatus: parsed.reviewStatus || 'ready',
  }
}

function readBatchManifest(inputPath) {
  const manifestPath = resolveManifestPath(inputPath)
  const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  return normalizeManifestShape(parsed, manifestPath)
}

function ensureManifestRunnable(manifest) {
  if (String(manifest.reviewStatus || 'ready').toLowerCase() !== 'ready') {
    throw new Error(`Batch manifest is not runnable yet (reviewStatus=${manifest.reviewStatus})`)
  }
}

module.exports = {
  DEFAULTS_BY_TYPE,
  ensureManifestRunnable,
  normalizeBatchType,
  resolveManifestPath,
  readBatchManifest,
}
