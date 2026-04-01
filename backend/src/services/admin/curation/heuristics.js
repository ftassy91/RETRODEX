'use strict'

const crypto = require('crypto')

const {
  CONTENT_VERSION,
  LOCK_THRESHOLD,
  PROFILE_KEYS,
  NARRATIVE_GENRES,
  VEHICLE_GENRES,
  LOW_LORE_GENRES,
  LOW_OST_GENRES,
} = require('./constants')

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function parseMaybeJson(value, fallback = null) {
  if (value == null || value === '') {
    return fallback
  }
  if (Array.isArray(value) || typeof value === 'object') {
    return value
  }
  if (typeof value !== 'string') {
    return fallback
  }
  try {
    return JSON.parse(value)
  } catch (_error) {
    return fallback
  }
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex')
}

function countStructuredEntries(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).length
  }
  if (value && typeof value === 'object') {
    return Object.keys(value).length
  }
  if (typeof value === 'string') {
    return value.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean).length
  }
  return 0
}

function hasSubstantiveText(value, minimumLength = 80) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text.length >= minimumLength
}

function hasGenreMatch(game, candidates = []) {
  const haystack = normalizeText(game?.genre)
  return candidates.some((candidate) => haystack.includes(normalizeText(candidate)))
}

function buildConsoleKey(record) {
  return String(record?.id || record?.consoleId || record?.slug || record?.name || '')
}

function toBooleanProfile(profile = {}) {
  return PROFILE_KEYS.reduce((acc, key) => {
    acc[key] = Boolean(profile[key])
    return acc
  }, {})
}

function emptyMediaCounters() {
  return {
    total: 0,
    valid: 0,
    broken: 0,
    blocked: 0,
    reviewOnly: 0,
  }
}

function getMediaCounters(mediaMap, gameId, mediaType) {
  const bucket = mediaMap.get(String(gameId || '')) || {}
  return bucket[String(mediaType || '').toLowerCase()] || emptyMediaCounters()
}

function buildHeuristicContentProfile(game, context = {}) {
  const media = context.media || {}
  const profile = {
    overview: true,
    lore: !hasGenreMatch(game, LOW_LORE_GENRES) && (
      hasGenreMatch(game, NARRATIVE_GENRES)
      || hasSubstantiveText(game?.lore, 80)
      || hasSubstantiveText(game?.synopsis, 80)
    ),
    characters: countStructuredEntries(parseMaybeJson(game?.characters, [])) > 0,
    maps: Number(media.maps?.valid || media.map?.valid || 0) > 0,
    vehicles: hasGenreMatch(game, VEHICLE_GENRES),
    ost: !hasGenreMatch(game, LOW_OST_GENRES) && (
      countStructuredEntries(parseMaybeJson(game?.ost_composers, [])) > 0
      || countStructuredEntries(parseMaybeJson(game?.ost_notable_tracks, [])) > 0
    ),
    manuals: Number(media.manuals?.valid || 0) > 0 || Number(media.manual?.valid || 0) > 0 || Boolean(game?.manual_url),
    sprites: Number(media.sprites?.valid || 0) > 0 || Number(media.sprite_sheet?.valid || 0) > 0,
    screenshots: false,
    codes: countStructuredEntries(parseMaybeJson(game?.cheat_codes, [])) > 0,
    records: Boolean(parseMaybeJson(game?.speedrun_wr)) || Number(context.recordCount || 0) > 0,
    credits: Boolean(game?.developer) || countStructuredEntries(parseMaybeJson(game?.dev_team, [])) > 0,
  }

  return toBooleanProfile(profile)
}

function buildValidationSummary(game, context = {}, profile = {}) {
  const media = context.media || {}
  const normalizedProfile = toBooleanProfile(profile)

  const domainChecks = {
    overview: hasSubstantiveText(game?.summary, 70) || hasSubstantiveText(game?.synopsis, 70),
    lore: hasSubstantiveText(game?.lore, 80) || hasSubstantiveText(game?.synopsis, 100),
    characters: countStructuredEntries(parseMaybeJson(game?.characters, [])) > 0,
    maps: Number(media.map?.valid || media.maps?.valid || 0) > 0,
    vehicles: hasGenreMatch(game, VEHICLE_GENRES),
    ost: (
      countStructuredEntries(parseMaybeJson(game?.ost_composers, [])) > 0
      || countStructuredEntries(parseMaybeJson(game?.ost_notable_tracks, [])) > 0
    ),
    manuals: Boolean(game?.manual_url) || Number(media.manual?.valid || media.manuals?.valid || 0) > 0,
    sprites: Number(media.sprite_sheet?.valid || media.sprites?.valid || 0) > 0,
    screenshots: Number(media.screenshot?.valid || media.screenshots?.valid || 0) > 0,
    codes: countStructuredEntries(parseMaybeJson(game?.cheat_codes, [])) > 0,
    records: Boolean(parseMaybeJson(game?.speedrun_wr)),
    credits: Boolean(game?.developer)
      || countStructuredEntries(parseMaybeJson(game?.dev_team, [])) > 0
      || countStructuredEntries(parseMaybeJson(game?.ost_composers, [])) > 0,
  }

  const reviewItems = []
  const criticalErrors = []

  if (normalizedProfile.maps && Number(media.map?.broken || media.maps?.broken || 0) > 0 && !domainChecks.maps) {
    criticalErrors.push('maps_broken_urls')
  }
  if (normalizedProfile.manuals && Number(media.manual?.broken || media.manuals?.broken || 0) > 0 && !domainChecks.manuals) {
    criticalErrors.push('manuals_broken_urls')
  }
  if (normalizedProfile.sprites && Number(media.sprite_sheet?.broken || media.sprites?.broken || 0) > 0 && !domainChecks.sprites) {
    criticalErrors.push('sprites_broken_urls')
  }
  if (Number(media.scan?.reviewOnly || 0) > 0) {
    reviewItems.push('scan_review_required')
  }
  if (Number(media.screenshot?.reviewOnly || 0) > 0) {
    reviewItems.push('screenshot_review_required')
  }

  const relevantKeys = PROFILE_KEYS.filter((key) => normalizedProfile[key])
  const relevantExpected = relevantKeys.length
  const relevantFilled = relevantKeys.filter((key) => domainChecks[key]).length
  const missingRelevantSections = relevantKeys.filter((key) => !domainChecks[key])
  const completionScore = relevantExpected > 0 ? Number((relevantFilled / relevantExpected).toFixed(4)) : 0
  const thresholdMet = completionScore >= LOCK_THRESHOLD && !missingRelevantSections.length
  const canLock = thresholdMet && !criticalErrors.length

  return {
    domains: domainChecks,
    relevantKeys,
    relevantExpected,
    relevantFilled,
    completionScore,
    missingRelevantSections,
    reviewItems,
    criticalErrors,
    thresholdMet,
    canLock,
  }
}

function computeSelectionScore(game, validation = {}) {
  const quality = game?.quality || {}
  const baseQuality = Number(quality.overallScore || 0)
  const completeness = Number(validation.completionScore || 0) * 100
  const metascore = Number(game?.metascore || 0)
  const sourceConfidence = Math.round(Number(game?.source_confidence || 0) * 100)
  const mediaBonus = (
    (validation.domains?.maps ? 8 : 0)
    + (validation.domains?.manuals ? 5 : 0)
    + (validation.domains?.sprites ? 5 : 0)
    + (validation.domains?.ost ? 5 : 0)
    + (validation.domains?.characters ? 4 : 0)
  )
  const rarityBonus = ({
    LEGENDARY: 6,
    EPIC: 4,
    RARE: 2,
  }[String(game?.rarity || '').toUpperCase()] || 0)

  return Math.round(
    (baseQuality * 0.35)
    + (completeness * 0.35)
    + (metascore * 0.15)
    + (sourceConfidence * 0.10)
    + mediaBonus
    + rarityBonus
  )
}

function deriveLifecycleStatus({ isTarget, validation, previousState, immutableHash }) {
  const previousStatus = String(previousState?.status || '')
  const previousHash = String(previousState?.immutable_hash || '')

  if (previousStatus === 'locked' && previousHash && previousHash !== immutableHash) {
    if (validation.canLock) {
      return 'locked'
    }
    return 'review'
  }
  if (validation.canLock) {
    return 'locked'
  }
  if (validation.thresholdMet) {
    return 'complete'
  }
  if (isTarget && (validation.criticalErrors.length || validation.reviewItems.length)) {
    return 'review'
  }
  if (isTarget && validation.relevantFilled > 0) {
    return 'in_progress'
  }
  return 'draft'
}

function buildImmutableHash(game, profileEnvelope, validation) {
  return sha256(stableStringify({
    gameId: game.id,
    contentVersion: CONTENT_VERSION,
    profile: profileEnvelope,
    validation: {
      relevantExpected: validation.relevantExpected,
      relevantFilled: validation.relevantFilled,
      completionScore: validation.completionScore,
      missingRelevantSections: validation.missingRelevantSections,
      criticalErrors: validation.criticalErrors,
    },
  }))
}

module.exports = {
  normalizeText,
  parseMaybeJson,
  stableStringify,
  sha256,
  countStructuredEntries,
  hasSubstantiveText,
  hasGenreMatch,
  buildConsoleKey,
  toBooleanProfile,
  emptyMediaCounters,
  getMediaCounters,
  buildHeuristicContentProfile,
  buildValidationSummary,
  computeSelectionScore,
  deriveLifecycleStatus,
  buildImmutableHash,
}
