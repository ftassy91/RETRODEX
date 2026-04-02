'use strict'
// DATA: pure admin/back-office helpers, no direct DB access

const DOMAIN_WEIGHTS = {
  lore: 10,
  characters: 9,
  manuals: 9,
  maps: 9,
  ost: 8,
  sprites: 8,
  records: 7,
  codes: 6,
  credits: 6,
  screenshots: 3,
  vehicles: 1,
}

const CHARACTER_GENRES = ['rpg', 'role-playing', 'fighting', 'beat', 'adventure', 'platform', 'tactical']
const LOW_LORE_GENRES = ['sports', 'puzzle', 'board', 'card', 'trivia', 'party', 'quiz']
const LOW_OST_GENRES = ['sports', 'board', 'card', 'quiz']
const MAP_GENRES = ['rpg', 'role-playing', 'jrpg', 'adventure', 'action adventure', 'metroidvania', 'platform', 'tactical', 'strategy']
const SPRITE_GENRES = ['fighting', 'platform', 'beat', 'shooter', 'run and gun', 'action', 'rpg']
const ENDING_GENRES = ['rpg', 'role-playing', 'jrpg', 'adventure', 'action adventure', 'visual novel', 'fighting']
const CODE_GENRES = ['platform', 'action', 'shooter', 'beat', 'fighting', 'adventure']

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

function safeNumber(value, fallback = 0) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function hasGenreMatch(entry, candidates = []) {
  const haystack = normalizeText(entry?.genre)
  return candidates.some((candidate) => haystack.includes(normalizeText(candidate)))
}

function normalizeMissingSections(value) {
  return Array.isArray(value)
    ? value.map((entry) => String(entry || '').trim()).filter(Boolean)
    : []
}

function getMissingWeight(missingSections = []) {
  return missingSections.reduce((total, key) => total + (DOMAIN_WEIGHTS[key] || 0), 0)
}

function buildMediaCountMap(rows = []) {
  const mediaMap = new Map()

  for (const row of rows) {
    const gameId = String(row.gameId || '')
    const mediaType = String(row.mediaType || '').toLowerCase()
    if (!gameId || !mediaType) {
      continue
    }

    if (!mediaMap.has(gameId)) {
      mediaMap.set(gameId, {})
    }

    mediaMap.get(gameId)[mediaType] = {
      total: safeNumber(row.totalCount),
      valid: safeNumber(row.validCount),
      broken: safeNumber(row.brokenCount),
      blocked: safeNumber(row.blockedCount),
      reviewOnly: safeNumber(row.reviewCount),
    }
  }

  return mediaMap
}

function getMediaCounts(mediaMap, gameId, mediaType) {
  const gameBucket = mediaMap.get(String(gameId || '')) || {}
  return gameBucket[String(mediaType || '').toLowerCase()] || {
    total: 0,
    valid: 0,
    broken: 0,
    blocked: 0,
    reviewOnly: 0,
  }
}

function buildPresentSignals(entry) {
  const domains = entry.validation?.domains || {}

  return {
    lore: Boolean(domains.lore),
    characters: Boolean(domains.characters),
    ost: Boolean(domains.ost),
    manuals: entry.media.manuals.valid > 0,
    maps: entry.media.maps.valid > 0,
    sprites: entry.media.sprites.valid > 0,
    endings: entry.media.endings.valid > 0,
    codes: Boolean(domains.codes),
    records: Boolean(domains.records),
    credits: Boolean(domains.credits),
  }
}

function deriveOpportunitySections(entry) {
  const opportunities = new Set(entry.missingRelevantSections)

  if (entry.media.manuals.valid === 0) {
    opportunities.add('manuals')
  }
  if (entry.media.maps.valid === 0 && hasGenreMatch(entry, MAP_GENRES)) {
    opportunities.add('maps')
  }
  if (entry.media.sprites.valid === 0 && hasGenreMatch(entry, SPRITE_GENRES)) {
    opportunities.add('sprites')
  }
  if (entry.media.endings.valid === 0 && hasGenreMatch(entry, ENDING_GENRES)) {
    opportunities.add('endings')
  }
  if (!entry.presentSignals.lore && !hasGenreMatch(entry, LOW_LORE_GENRES)) {
    opportunities.add('lore')
  }
  if (!entry.presentSignals.characters && hasGenreMatch(entry, CHARACTER_GENRES)) {
    opportunities.add('characters')
  }
  if (!entry.presentSignals.ost && !hasGenreMatch(entry, LOW_OST_GENRES)) {
    opportunities.add('ost')
  }
  if (!entry.presentSignals.codes && hasGenreMatch(entry, CODE_GENRES)) {
    opportunities.add('codes')
  }

  return Array.from(opportunities)
}

function computeBacklogScore(entry) {
  const status = String(entry.status || '').toLowerCase()
  const published = Boolean(entry.published)
  const missingSections = normalizeMissingSections(entry.opportunitySections || entry.missingRelevantSections)
  const criticalErrors = Array.isArray(entry.criticalErrors) ? entry.criticalErrors : []
  const reviewItems = Array.isArray(entry.reviewItems) ? entry.reviewItems : []

  const visibilityBonus = published
    ? 30
    : status === 'locked'
      ? 18
      : status === 'complete'
        ? 10
        : 6
  const slotBonus = published && safeNumber(entry.slotRank) > 0 && safeNumber(entry.slotRank) <= 5 ? 8 : 0
  const selectionContribution = Math.round(safeNumber(entry.selectionScore) * 0.5)
  const gapScore = getMissingWeight(missingSections)
  const quickWinBonus = criticalErrors.length
    ? 0
    : missingSections.length <= 2
      ? 12
      : missingSections.length <= 4
        ? 6
        : 0
  const reviewPenalty = reviewItems.length * 4
  const criticalPenalty = criticalErrors.length * 20

  return visibilityBonus + slotBonus + selectionContribution + gapScore + quickWinBonus - reviewPenalty - criticalPenalty
}

function compareBacklogEntries(left, right) {
  if (Boolean(left.published) !== Boolean(right.published)) {
    return left.published ? -1 : 1
  }

  if (safeNumber(left.backlogScore) !== safeNumber(right.backlogScore)) {
    return safeNumber(right.backlogScore) - safeNumber(left.backlogScore)
  }

  if (safeNumber(left.selectionScore) !== safeNumber(right.selectionScore)) {
    return safeNumber(right.selectionScore) - safeNumber(left.selectionScore)
  }

  if (safeNumber(left.slotRank, 9999) !== safeNumber(right.slotRank, 9999)) {
    return safeNumber(left.slotRank, 9999) - safeNumber(right.slotRank, 9999)
  }

  return String(left.title || '').localeCompare(String(right.title || ''), 'fr', { sensitivity: 'base' })
}

function buildRationale(entry) {
  const reasons = []
  const opportunities = Array.isArray(entry.opportunitySections) ? entry.opportunitySections : []

  if (entry.published) {
    reasons.push('visible_now_on_public_surface')
  } else if (String(entry.status || '').toLowerCase() === 'locked') {
    reasons.push('locked_but_not_visible')
  }

  if (entry.media.manuals.valid === 0 && opportunities.includes('manuals')) {
    reasons.push('missing_manuals')
  }
  if (entry.media.maps.valid === 0 && opportunities.includes('maps')) {
    reasons.push('missing_maps')
  }
  if (entry.media.sprites.valid === 0 && opportunities.includes('sprites')) {
    reasons.push('missing_sprites')
  }
  if (opportunities.includes('lore')) {
    reasons.push('missing_lore')
  }
  if (opportunities.includes('characters')) {
    reasons.push('missing_characters')
  }
  if (opportunities.includes('ost')) {
    reasons.push('missing_ost')
  }

  if (entry.criticalErrors.length) {
    reasons.push('has_blocking_quality_issues')
  }

  if (!reasons.length) {
    reasons.push('high_value_curated_entry')
  }

  return reasons
}

function selectBacklogTargets(entries = [], { perConsoleLimit = 3, globalLimit = 40 } = {}) {
  const selected = []
  const countsByConsole = new Map()

  for (const entry of [...entries].sort(compareBacklogEntries)) {
    if (selected.length >= globalLimit) {
      break
    }

    const consoleId = String(entry.consoleId || '')
    const used = countsByConsole.get(consoleId) || 0
    if (used >= perConsoleLimit) {
      continue
    }

    selected.push(entry)
    countsByConsole.set(consoleId, used + 1)
  }

  return selected
}

module.exports = {
  DOMAIN_WEIGHTS,
  parseMaybeJson,
  safeNumber,
  normalizeMissingSections,
  buildMediaCountMap,
  getMediaCounts,
  buildPresentSignals,
  deriveOpportunitySections,
  computeBacklogScore,
  compareBacklogEntries,
  buildRationale,
  selectBacklogTargets,
}
