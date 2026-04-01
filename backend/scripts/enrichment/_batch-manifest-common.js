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

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeString(value, fallback = '') {
  if (value === null || value === undefined) return fallback
  return String(value).trim()
}

function normalizeNullableString(value) {
  const normalized = normalizeString(value, '')
  return normalized || null
}

function normalizeStringList(values, { sort = false } = {}) {
  const unique = Array.from(new Set((Array.isArray(values) ? values : [])
    .map((value) => normalizeString(value, ''))
    .filter(Boolean)))

  if (sort) {
    unique.sort((left, right) => left.localeCompare(right))
  }

  return unique
}

function normalizeNumeric(value) {
  if (value === null || value === undefined || value === '') return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function inferBatchKey(manifestPath, batchType) {
  const base = normalizeString(path.basename(String(manifestPath || ''), path.extname(String(manifestPath || ''))), '')
  return base || `${batchType}_batch`
}

function isEmptyValue(value) {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return !value.trim()
  if (Array.isArray(value)) return value.length === 0
  if (isPlainObject(value)) return Object.keys(value).length === 0
  return false
}

function normalizeContext(value) {
  return isPlainObject(value) ? { ...value } : {}
}

function normalizePeopleList(values, fallbackRole) {
  const seen = new Set()
  const normalized = []

  for (const rawEntry of Array.isArray(values) ? values : []) {
    let entry = rawEntry
    if (typeof rawEntry === 'string') {
      entry = { name: rawEntry, role: fallbackRole }
    }
    if (!isPlainObject(entry)) continue

    const name = normalizeString(entry.name, '')
    if (!name) continue

    const role = normalizeString(entry.role, fallbackRole) || fallbackRole
    const dedupeKey = `${name.toLowerCase()}::${role.toLowerCase()}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)

    const normalizedEntry = {
      ...entry,
      name,
      role,
    }

    const billingOrder = normalizeNumeric(entry.billingOrder)
    if (billingOrder !== null) normalizedEntry.billingOrder = billingOrder
    else delete normalizedEntry.billingOrder

    const confidence = normalizeNumeric(entry.confidence)
    if (confidence !== null) normalizedEntry.confidence = confidence
    else delete normalizedEntry.confidence

    normalized.push(normalizedEntry)
  }

  return normalized
}

function normalizePremiumPayloadEntry(entry) {
  return {
    ...entry,
    gameId: normalizeString(entry?.gameId || entry?.id, ''),
    title: normalizeString(entry?.title, ''),
    summary: normalizeString(entry?.summary, ''),
    synopsis: normalizeString(entry?.synopsis, ''),
    media: Array.isArray(entry?.media) ? entry.media.map((item) => (isPlainObject(item) ? { ...item } : item)).filter(Boolean) : [],
    ostTracks: Array.isArray(entry?.ostTracks) ? entry.ostTracks.map((item) => (isPlainObject(item) ? { ...item } : item)).filter(Boolean) : [],
    candidateContext: normalizeContext(entry?.candidateContext),
  }
}

function normalizeSummaryPayloadEntry(entry) {
  return {
    ...entry,
    gameId: normalizeString(entry?.gameId || entry?.id, ''),
    title: normalizeString(entry?.title, ''),
    summary: normalizeString(entry?.summary, ''),
    sourceName: normalizeString(entry?.sourceName, ''),
    sourceType: normalizeString(entry?.sourceType, ''),
    sourceUrl: normalizeNullableString(entry?.sourceUrl),
    notes: normalizeString(entry?.notes, ''),
    candidateContext: normalizeContext(entry?.candidateContext),
  }
}

function normalizeDevTeamPayloadEntry(entry) {
  return {
    ...entry,
    gameId: normalizeString(entry?.gameId || entry?.id, ''),
    title: normalizeString(entry?.title, ''),
    devTeam: normalizePeopleList(entry?.devTeam, 'developer'),
    sourceName: normalizeString(entry?.sourceName, ''),
    sourceType: normalizeString(entry?.sourceType, ''),
    sourceUrl: normalizeNullableString(entry?.sourceUrl),
    confidenceLevel: normalizeNumeric(entry?.confidenceLevel),
    notes: normalizeString(entry?.notes, ''),
    candidateContext: normalizeContext(entry?.candidateContext),
  }
}

function normalizeComposerPayloadEntry(entry) {
  return {
    ...entry,
    gameId: normalizeString(entry?.gameId || entry?.id, ''),
    title: normalizeString(entry?.title, ''),
    ostComposers: normalizePeopleList(entry?.ostComposers, 'composer'),
    sourceName: normalizeString(entry?.sourceName, ''),
    sourceType: normalizeString(entry?.sourceType, ''),
    sourceUrl: normalizeNullableString(entry?.sourceUrl),
    confidenceLevel: normalizeNumeric(entry?.confidenceLevel),
    notes: normalizeString(entry?.notes, ''),
    candidateContext: normalizeContext(entry?.candidateContext),
  }
}

function normalizeMediaPayloadEntry(entry) {
  return {
    ...entry,
    gameId: normalizeString(entry?.gameId || entry?.id, ''),
    title: normalizeString(entry?.title, ''),
    mediaType: normalizeString(entry?.mediaType, ''),
    sourceField: normalizeString(entry?.sourceField, ''),
    provider: normalizeString(entry?.provider, ''),
    url: normalizeString(entry?.url, ''),
    sourceName: normalizeString(entry?.sourceName, ''),
    sourceType: normalizeString(entry?.sourceType, ''),
    sourceUrl: normalizeNullableString(entry?.sourceUrl),
    notes: normalizeString(entry?.notes, ''),
    candidateContext: normalizeContext(entry?.candidateContext),
  }
}

function normalizePayloadEntry(batchType, entry) {
  if (batchType === 'premium') return normalizePremiumPayloadEntry(entry)
  if (batchType === 'summary') return normalizeSummaryPayloadEntry(entry)
  if (batchType === 'dev_team') return normalizeDevTeamPayloadEntry(entry)
  if (batchType === 'composers') return normalizeComposerPayloadEntry(entry)
  if (batchType === 'media') return normalizeMediaPayloadEntry(entry)
  return isPlainObject(entry) ? { ...entry } : entry
}

function mergeObjects(primary, secondary) {
  const merged = { ...(isPlainObject(primary) ? primary : {}) }
  if (!isPlainObject(secondary)) return merged

  for (const [key, value] of Object.entries(secondary)) {
    if (!(key in merged) || isEmptyValue(merged[key])) {
      merged[key] = value
      continue
    }
    if (isPlainObject(merged[key]) && isPlainObject(value)) {
      merged[key] = mergeObjects(merged[key], value)
    }
  }

  return merged
}

function mergePayloadEntries(existing, incoming) {
  const merged = { ...existing }

  for (const [key, value] of Object.entries(incoming)) {
    if (!(key in merged) || isEmptyValue(merged[key])) {
      merged[key] = value
      continue
    }

    if (Array.isArray(merged[key]) && Array.isArray(value)) {
      if (!merged[key].length && value.length) merged[key] = value
      continue
    }

    if (isPlainObject(merged[key]) && isPlainObject(value)) {
      merged[key] = mergeObjects(merged[key], value)
    }
  }

  return merged
}

function normalizePayload(batchType, payload) {
  const deduped = new Map()
  const passthrough = []

  for (const rawEntry of Array.isArray(payload) ? payload : []) {
    const entry = normalizePayloadEntry(batchType, rawEntry)
    const key = normalizeString(entry?.gameId, '')

    if (!key) {
      passthrough.push(entry)
      continue
    }

    const existing = deduped.get(key)
    deduped.set(key, existing ? mergePayloadEntries(existing, entry) : entry)
  }

  const keyedEntries = Array.from(deduped.values()).sort((left, right) => {
    const leftKey = normalizeString(left?.gameId, '')
    const rightKey = normalizeString(right?.gameId, '')
    return leftKey.localeCompare(rightKey)
  })

  return [...keyedEntries, ...passthrough]
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

function normalizeManifestShape(parsed, manifestPath, options = {}) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Invalid batch manifest: ${manifestPath}`)
  }

  const allowIncomplete = options.allowIncomplete === true
  const inferredType = normalizeBatchType(parsed.batchType || parsed.type || (Array.isArray(parsed.payload) ? 'premium' : 'premium'))
  const defaults = DEFAULTS_BY_TYPE[inferredType] || DEFAULTS_BY_TYPE.premium
  const payload = normalizePayload(inferredType, Array.isArray(parsed.payload) ? parsed.payload : [])
  const ids = normalizeStringList(normalizeIds(payload, Array.isArray(parsed.ids) ? parsed.ids : []), { sort: true })
  const batchKey = normalizeString(parsed.batchKey, '') || inferBatchKey(manifestPath, inferredType)

  if (!allowIncomplete && !payload.length) {
    throw new Error(`Batch manifest missing payload entries: ${manifestPath}`)
  }

  return {
    manifestPath,
    batchKey,
    batchType: inferredType,
    generatedAt: normalizeString(parsed.generatedAt || parsed.generatedFrom?.generatedAt, '') || new Date().toISOString(),
    notes: normalizeString(parsed.notes, '') || `${inferredType} batch ${batchKey}`,
    ids,
    payload,
    sources: normalizeStringList(Array.isArray(parsed.sources) ? parsed.sources : []),
    writeTargets: Array.isArray(parsed.writeTargets) && parsed.writeTargets.length ? parsed.writeTargets : defaults.writeTargets,
    publishDomains: Array.isArray(parsed.publishDomains) && parsed.publishDomains.length ? parsed.publishDomains : defaults.publishDomains,
    postChecks: Array.isArray(parsed.postChecks) && parsed.postChecks.length ? parsed.postChecks : defaults.postChecks,
    generatedFrom: isPlainObject(parsed.generatedFrom) ? { ...parsed.generatedFrom } : null,
    reviewStatus: normalizeString(parsed.reviewStatus, '') || 'ready',
  }
}

function readBatchManifest(inputPath) {
  const manifestPath = resolveManifestPath(inputPath)
  const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  return normalizeManifestShape(parsed, manifestPath)
}

function addIssue(issues, scope, message) {
  issues.push({ scope, message })
}

function inspectPremiumPayload(manifest, issues) {
  manifest.payload.forEach((entry, index) => {
    const scope = `payload[${index}]`
    const hasWork = Boolean(
      (typeof entry.summary === 'string' && entry.summary.trim())
      || (typeof entry.synopsis === 'string' && entry.synopsis.trim())
      || (Array.isArray(entry.media) && entry.media.length)
      || (Array.isArray(entry.ostTracks) && entry.ostTracks.length)
    )
    if (!entry.gameId) addIssue(issues, scope, 'missing gameId')
    if (!hasWork) addIssue(issues, scope, 'premium payload has no actionable content')
  })
}

function inspectSummaryPayload(manifest, issues) {
  manifest.payload.forEach((entry, index) => {
    const scope = `payload[${index}]`
    if (!entry.gameId) addIssue(issues, scope, 'missing gameId')
    if (!normalizeString(entry.summary, '')) addIssue(issues, scope, 'missing summary text')
    if (!normalizeString(entry.sourceName, '')) addIssue(issues, scope, 'missing sourceName')
  })
}

function inspectDevTeamPayload(manifest, issues) {
  manifest.payload.forEach((entry, index) => {
    const scope = `payload[${index}]`
    if (!entry.gameId) addIssue(issues, scope, 'missing gameId')
    if (!Array.isArray(entry.devTeam) || !entry.devTeam.length) addIssue(issues, scope, 'missing devTeam members')
    if (!normalizeString(entry.sourceName, '')) addIssue(issues, scope, 'missing sourceName')
  })
}

function inspectComposerPayload(manifest, issues) {
  manifest.payload.forEach((entry, index) => {
    const scope = `payload[${index}]`
    if (!entry.gameId) addIssue(issues, scope, 'missing gameId')
    if (!Array.isArray(entry.ostComposers) || !entry.ostComposers.length) addIssue(issues, scope, 'missing composer members')
    if (!normalizeString(entry.sourceName, '')) addIssue(issues, scope, 'missing sourceName')
    if (!normalizeString(entry.sourceType, '')) addIssue(issues, scope, 'missing sourceType')
  })
}

function inspectMediaPayload(manifest, issues) {
  manifest.payload.forEach((entry, index) => {
    const scope = `payload[${index}]`
    if (!entry.gameId) addIssue(issues, scope, 'missing gameId')
    if (!normalizeString(entry.mediaType, '')) addIssue(issues, scope, 'missing mediaType')
    if (!normalizeString(entry.sourceField, '')) addIssue(issues, scope, 'missing sourceField')
    if (!normalizeString(entry.provider, '')) addIssue(issues, scope, 'missing provider')
    if (!normalizeString(entry.url, '')) addIssue(issues, scope, 'missing url')
  })
}

function inspectManifest(manifest) {
  const issues = []

  if (!manifest.batchKey) addIssue(issues, 'manifest', 'missing batchKey')
  if (!manifest.batchType) addIssue(issues, 'manifest', 'missing batchType')
  if (!Array.isArray(manifest.payload) || !manifest.payload.length) {
    addIssue(issues, 'manifest', 'missing payload entries')
    return issues
  }

  if (manifest.batchType === 'premium') inspectPremiumPayload(manifest, issues)
  else if (manifest.batchType === 'summary') inspectSummaryPayload(manifest, issues)
  else if (manifest.batchType === 'dev_team') inspectDevTeamPayload(manifest, issues)
  else if (manifest.batchType === 'composers') inspectComposerPayload(manifest, issues)
  else if (manifest.batchType === 'media') inspectMediaPayload(manifest, issues)
  else addIssue(issues, 'manifest', `unsupported batchType: ${manifest.batchType}`)

  return issues
}

function finalizeManifest(parsed, manifestPath, options = {}) {
  const normalized = normalizeManifestShape(parsed, manifestPath, { allowIncomplete: true })
  const issues = inspectManifest(normalized)
  const runnable = issues.length === 0
  const finalReviewStatus = runnable
    ? (options.promoteReady ? 'ready' : (normalizeString(parsed.reviewStatus, '') || normalized.reviewStatus))
    : 'review_required'

  const finalManifest = {
    ...parsed,
    batchKey: normalized.batchKey,
    batchType: normalized.batchType,
    reviewStatus: finalReviewStatus,
    generatedAt: normalized.generatedAt,
    notes: normalized.notes,
    ids: normalized.ids,
    payload: normalized.payload,
    sources: normalized.sources,
    writeTargets: normalized.writeTargets,
    publishDomains: normalized.publishDomains,
    postChecks: normalized.postChecks,
  }

  if (normalized.generatedFrom) {
    finalManifest.generatedFrom = mergeObjects(normalized.generatedFrom, {
      generatedAt: normalizeString(normalized.generatedFrom.generatedAt || normalized.generatedAt, '') || normalized.generatedAt,
    })
  } else if (!('generatedFrom' in finalManifest)) {
    finalManifest.generatedFrom = null
  }

  return {
    manifest: finalManifest,
    issues,
    runnable,
  }
}

function ensureManifestRunnable(manifest) {
  if (String(manifest.reviewStatus || 'ready').toLowerCase() !== 'ready') {
    throw new Error(`Batch manifest is not runnable yet (reviewStatus=${manifest.reviewStatus})`)
  }
}

module.exports = {
  DEFAULTS_BY_TYPE,
  ensureManifestRunnable,
  finalizeManifest,
  inspectManifest,
  normalizeBatchType,
  normalizeManifestShape,
  resolveManifestPath,
  readBatchManifest,
}
