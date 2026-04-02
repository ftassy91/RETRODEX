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
  competitive: {
    publishDomains: ['records', 'competitive'],
    postChecks: ['records', 'competitive'],
    writeTargets: [
      'games',
      'game_competitive_profiles',
      'game_record_categories',
      'game_record_entries',
      'game_achievement_profiles',
      'source_records',
      'field_provenance',
    ],
  },
  richness: {
    publishDomains: ['records', 'editorial', 'media', 'ui'],
    postChecks: ['records', 'editorial', 'media', 'ui'],
    writeTargets: ['games', 'game_editorial', 'media_references', 'source_records', 'field_provenance'],
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

function normalizeStructuredValue(value) {
  if (value === undefined) return null
  if (value === null) return null
  if (typeof value === 'string') {
    const normalized = normalizeString(value, '')
    return normalized || null
  }
  if (Array.isArray(value)) return value.map((item) => (isPlainObject(item) ? { ...item } : item)).filter((item) => !isEmptyValue(item))
  if (isPlainObject(value)) return { ...value }
  return value
}

function normalizeRichnessPayloadEntry(entry) {
  return {
    ...entry,
    gameId: normalizeString(entry?.gameId || entry?.id, ''),
    title: normalizeString(entry?.title, ''),
    sourceName: normalizeString(entry?.sourceName, ''),
    sourceType: normalizeString(entry?.sourceType, ''),
    sourceUrl: normalizeNullableString(entry?.sourceUrl),
    confidenceLevel: normalizeNumeric(entry?.confidenceLevel),
    notes: normalizeString(entry?.notes, ''),
    summary: normalizeString(entry?.summary, ''),
    synopsis: normalizeString(entry?.synopsis, ''),
    tagline: normalizeString(entry?.tagline, ''),
    devAnecdotes: normalizeStructuredValue(entry?.devAnecdotes ?? entry?.dev_anecdotes),
    cheatCodes: normalizeStructuredValue(entry?.cheatCodes ?? entry?.cheat_codes),
    versions: normalizeStructuredValue(entry?.versions),
    avgDurationMain: normalizeNumeric(entry?.avgDurationMain ?? entry?.avg_duration_main),
    avgDurationComplete: normalizeNumeric(entry?.avgDurationComplete ?? entry?.avg_duration_complete),
    speedrunWr: normalizeStructuredValue(entry?.speedrunWr ?? entry?.speedrun_wr),
    ostTracks: normalizeStructuredValue(entry?.ostTracks ?? entry?.ost_notable_tracks),
    media: Array.isArray(entry?.media) ? entry.media.map((item) => (isPlainObject(item) ? { ...item } : item)).filter(Boolean) : [],
    candidateContext: normalizeContext(entry?.candidateContext),
  }
}

function normalizeCompetitiveRecordEntry(entry) {
  if (!isPlainObject(entry)) return null
  return {
    ...entry,
    id: normalizeString(entry.id, ''),
    categoryId: normalizeString(entry.categoryId || entry.recordCategoryId, ''),
    gameId: normalizeString(entry.gameId || entry.entityId, ''),
    rankPosition: normalizeNumeric(entry.rankPosition ?? entry.rank),
    playerHandle: normalizeString(entry.playerHandle || entry.runner || entry.player, ''),
    scoreRaw: normalizeString(entry.scoreRaw || entry.valueRaw || entry.score, ''),
    scoreDisplay: normalizeString(entry.scoreDisplay || entry.valueDisplay || entry.time || entry.value, ''),
    achievedAt: normalizeNullableString(entry.achievedAt || entry.submittedAt || entry.date),
    externalUrl: normalizeNullableString(entry.externalUrl || entry.url),
    sourceName: normalizeString(entry.sourceName, ''),
    sourceType: normalizeString(entry.sourceType, ''),
    sourceUrl: normalizeNullableString(entry.sourceUrl),
    observedAt: normalizeNullableString(entry.observedAt),
  }
}

function normalizeCompetitiveCategoryEntry(entry, gameIdFallback) {
  if (!isPlainObject(entry)) return null
  return {
    ...entry,
    id: normalizeString(entry.id || entry.categoryId, ''),
    gameId: normalizeString(entry.gameId || gameIdFallback, ''),
    categoryKey: normalizeString(entry.categoryKey || entry.slug, ''),
    label: normalizeString(entry.label || entry.name, ''),
    recordKind: normalizeString(entry.recordKind || entry.type, ''),
    valueDirection: normalizeString(entry.valueDirection || entry.sortDirection, ''),
    externalUrl: normalizeNullableString(entry.externalUrl || entry.url),
    sourceName: normalizeString(entry.sourceName, ''),
    sourceType: normalizeString(entry.sourceType, ''),
    sourceUrl: normalizeNullableString(entry.sourceUrl),
    observedAt: normalizeNullableString(entry.observedAt),
    isPrimary: Boolean(entry.isPrimary),
    displayOrder: normalizeNumeric(entry.displayOrder),
  }
}

function normalizeCompetitivePayloadEntry(entry) {
  const competitiveProfile = isPlainObject(entry?.competitiveProfile) ? {
    ...entry.competitiveProfile,
    speedrunRelevant: Boolean(entry.competitiveProfile.speedrunRelevant),
    scoreAttackRelevant: Boolean(entry.competitiveProfile.scoreAttackRelevant),
    leaderboardRelevant: Boolean(entry.competitiveProfile.leaderboardRelevant),
    achievementCompetitive: Boolean(entry.competitiveProfile.achievementCompetitive),
    primarySource: normalizeString(entry.competitiveProfile.primarySource, ''),
    freshnessCheckedAt: normalizeNullableString(entry.competitiveProfile.freshnessCheckedAt),
    sourceSummary: normalizeContext(entry.competitiveProfile.sourceSummary),
  } : {}

  const primaryProjection = isPlainObject(entry?.primaryProjection) ? {
    ...entry.primaryProjection,
    category: normalizeString(entry.primaryProjection.category || entry.primaryProjection.label, ''),
    value: normalizeString(entry.primaryProjection.value || entry.primaryProjection.time || entry.primaryProjection.scoreDisplay, ''),
    runner: normalizeString(entry.primaryProjection.runner || entry.primaryProjection.playerHandle, ''),
    source: normalizeString(entry.primaryProjection.source || entry.primaryProjection.sourceName, ''),
    url: normalizeNullableString(entry.primaryProjection.url || entry.primaryProjection.externalUrl),
    metricType: normalizeString(entry.primaryProjection.metricType, ''),
  } : null

  const recordCategories = (Array.isArray(entry?.recordCategories) ? entry.recordCategories : [])
    .map((item) => normalizeCompetitiveCategoryEntry(item, entry?.gameId || entry?.id))
    .filter(Boolean)

  const recordEntries = (Array.isArray(entry?.recordEntries) ? entry.recordEntries : [])
    .map((item) => normalizeCompetitiveRecordEntry(item))
    .filter(Boolean)

  const achievementProfile = isPlainObject(entry?.achievementProfile) ? {
    ...entry.achievementProfile,
    gameId: normalizeString(entry.achievementProfile.gameId || entry?.gameId || entry?.id, ''),
    sourceName: normalizeString(entry.achievementProfile.sourceName, ''),
    sourceType: normalizeString(entry.achievementProfile.sourceType, ''),
    sourceUrl: normalizeNullableString(entry.achievementProfile.sourceUrl),
    pointsTotal: normalizeNumeric(entry.achievementProfile.pointsTotal),
    achievementCount: normalizeNumeric(entry.achievementProfile.achievementCount),
    leaderboardCount: normalizeNumeric(entry.achievementProfile.leaderboardCount),
    masterySummary: normalizeNullableString(entry.achievementProfile.masterySummary),
    highScoreSummary: normalizeNullableString(entry.achievementProfile.highScoreSummary),
    observedAt: normalizeNullableString(entry.achievementProfile.observedAt),
  } : null

  return {
    ...entry,
    gameId: normalizeString(entry?.gameId || entry?.id, ''),
    title: normalizeString(entry?.title, ''),
    sourceName: normalizeString(entry?.sourceName, ''),
    sourceType: normalizeString(entry?.sourceType, ''),
    sourceUrl: normalizeNullableString(entry?.sourceUrl),
    notes: normalizeString(entry?.notes, ''),
    competitiveProfile,
    recordCategories,
    recordEntries,
    achievementProfile,
    primaryProjection,
    candidateContext: normalizeContext(entry?.candidateContext),
  }
}

function normalizePayloadEntry(batchType, entry) {
  if (batchType === 'premium') return normalizePremiumPayloadEntry(entry)
  if (batchType === 'summary') return normalizeSummaryPayloadEntry(entry)
  if (batchType === 'dev_team') return normalizeDevTeamPayloadEntry(entry)
  if (batchType === 'composers') return normalizeComposerPayloadEntry(entry)
  if (batchType === 'media') return normalizeMediaPayloadEntry(entry)
  if (batchType === 'competitive') return normalizeCompetitivePayloadEntry(entry)
  if (batchType === 'richness') return normalizeRichnessPayloadEntry(entry)
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
  if (raw === 'competitive') return 'competitive'
  if (['richness', 'editorial_depth', 'development_context', 'player_utility', 'expert_signals'].includes(raw)) return 'richness'
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

function inspectCompetitivePayload(manifest, issues) {
  manifest.payload.forEach((entry, index) => {
    const scope = `payload[${index}]`
    if (!entry.gameId) addIssue(issues, scope, 'missing gameId')
    if (!normalizeString(entry.sourceName, '')) addIssue(issues, scope, 'missing sourceName')
    if (!normalizeString(entry.sourceType, '')) addIssue(issues, scope, 'missing sourceType')

    const categoryCount = Array.isArray(entry.recordCategories) ? entry.recordCategories.length : 0
    const entryCount = Array.isArray(entry.recordEntries) ? entry.recordEntries.length : 0
    const hasAchievement = isPlainObject(entry.achievementProfile)
    const hasProjection = isPlainObject(entry.primaryProjection) && normalizeString(entry.primaryProjection.value, '')

    if (!categoryCount && !entryCount && !hasAchievement && !hasProjection) {
      addIssue(issues, scope, 'competitive payload has no actionable content')
    }

    ;(entry.recordCategories || []).forEach((category, categoryIndex) => {
      const categoryScope = `${scope}.recordCategories[${categoryIndex}]`
      if (!normalizeString(category.label, '')) addIssue(issues, categoryScope, 'missing label')
      if (!normalizeString(category.sourceName, '')) addIssue(issues, categoryScope, 'missing sourceName')
      if (!normalizeString(category.sourceType, '')) addIssue(issues, categoryScope, 'missing sourceType')
    })

    ;(entry.recordEntries || []).forEach((record, recordIndex) => {
      const recordScope = `${scope}.recordEntries[${recordIndex}]`
      if (!normalizeString(record.categoryId, '')) addIssue(issues, recordScope, 'missing categoryId')
      if (!normalizeString(record.scoreDisplay, '')) addIssue(issues, recordScope, 'missing scoreDisplay')
      if (!normalizeString(record.sourceName, '')) addIssue(issues, recordScope, 'missing sourceName')
      if (!normalizeString(record.sourceType, '')) addIssue(issues, recordScope, 'missing sourceType')
    })
  })
}

function inspectRichnessPayload(manifest, issues) {
  manifest.payload.forEach((entry, index) => {
    const scope = `payload[${index}]`
    const hasEditorialWork = Boolean(
      normalizeString(entry.summary, '')
      || normalizeString(entry.synopsis, '')
      || normalizeString(entry.tagline, '')
      || !isEmptyValue(entry.devAnecdotes)
      || !isEmptyValue(entry.cheatCodes)
      || !isEmptyValue(entry.versions)
      || entry.avgDurationMain !== null
      || entry.avgDurationComplete !== null
      || !isEmptyValue(entry.speedrunWr)
      || !isEmptyValue(entry.ostTracks)
    )
    const hasMediaWork = Array.isArray(entry.media) && entry.media.length > 0

    if (!entry.gameId) addIssue(issues, scope, 'missing gameId')
    if (!hasEditorialWork && !hasMediaWork) addIssue(issues, scope, 'richness payload has no actionable content')
    if (hasEditorialWork && !normalizeString(entry.sourceName, '')) addIssue(issues, scope, 'missing sourceName')
    if (hasEditorialWork && !normalizeString(entry.sourceType, '')) addIssue(issues, scope, 'missing sourceType')

    ;(entry.media || []).forEach((media, mediaIndex) => {
      const mediaScope = `${scope}.media[${mediaIndex}]`
      if (!normalizeString(media.mediaType, '')) addIssue(issues, mediaScope, 'missing mediaType')
      if (!normalizeString(media.sourceField, '')) addIssue(issues, mediaScope, 'missing sourceField')
      if (!normalizeString(media.provider, '')) addIssue(issues, mediaScope, 'missing provider')
      if (!normalizeString(media.url, '')) addIssue(issues, mediaScope, 'missing url')
    })
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
  else if (manifest.batchType === 'competitive') inspectCompetitivePayload(manifest, issues)
  else if (manifest.batchType === 'richness') inspectRichnessPayload(manifest, issues)
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
