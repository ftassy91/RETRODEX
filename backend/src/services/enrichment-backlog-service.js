'use strict'

const fs = require('fs')
const path = require('path')

const { QueryTypes } = require('sequelize')

const { sequelize } = require('../database')
const { listConsoleItems } = require('./console-service')
const { tableExists } = require('./publication-service')
const { PASS1_KEY } = require('./curation-service')

const AUDIT_OUTPUT_DIR = path.resolve(__dirname, '../../../data/audit')

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

const NARRATIVE_GENRES = ['rpg', 'role-playing', 'jrpg', 'adventure', 'action adventure', 'metroidvania', 'visual novel']
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

async function loadConsoleNameMap() {
  const rows = await listConsoleItems()
  return new Map(rows.map((row) => [String(row.id || ''), row]))
}

async function loadBacklogSourceRows(passKey = PASS1_KEY) {
  const [hasStates, hasSlots, hasMedia] = await Promise.all([
    tableExists('game_curation_states'),
    tableExists('console_publication_slots'),
    tableExists('media_references'),
  ])

  if (!hasStates) {
    return { stateRows: [], mediaMap: new Map() }
  }

  const stateRows = await sequelize.query(
    `SELECT states.game_id AS gameId,
            states.console_id AS consoleId,
            states.status AS status,
            states.selection_score AS selectionScore,
            states.target_rank AS targetRank,
            states.is_target AS isTarget,
            states.completion_score AS completionScore,
            states.relevant_expected AS relevantExpected,
            states.relevant_filled AS relevantFilled,
            states.missing_relevant_sections_json AS missingRelevantSectionsJson,
            states.critical_errors_json AS criticalErrorsJson,
            states.validation_summary_json AS validationSummaryJson,
            slots.slot_rank AS slotRank,
            slots.is_active AS slotActive,
            games.title AS title,
            games.console AS consoleNameRaw,
            games.year AS year,
            games.genre AS genre,
            games.rarity AS rarity,
            games.metascore AS metascore
     FROM game_curation_states states
     INNER JOIN games ON games.id = states.game_id
     ${hasSlots ? `LEFT JOIN console_publication_slots slots
       ON slots.game_id = states.game_id
      AND slots.pass_key = states.pass_key
      AND slots.is_active = 1` : 'LEFT JOIN (SELECT NULL AS game_id, NULL AS slot_rank, NULL AS is_active) slots ON 1=0'}
     WHERE states.pass_key = :passKey
       AND (states.is_target = 1 OR states.status IN ('published', 'locked', 'complete'))
       AND COALESCE(games.type, 'game') = 'game'`,
    {
      replacements: { passKey },
      type: QueryTypes.SELECT,
    }
  )

  if (!hasMedia) {
    return { stateRows, mediaMap: new Map() }
  }

  const mediaRows = await sequelize.query(
    `SELECT entity_id AS gameId,
            LOWER(media_type) AS mediaType,
            COUNT(*) AS totalCount,
            SUM(CASE WHEN COALESCE(ui_allowed, 1) = 1
                       AND LOWER(COALESCE(license_status, 'reference_only')) <> 'blocked'
                     THEN 1 ELSE 0 END) AS validCount,
            SUM(CASE WHEN LOWER(COALESCE(healthcheck_status, 'ok')) IN ('broken', 'timeout')
                     THEN 1 ELSE 0 END) AS brokenCount,
            SUM(CASE WHEN LOWER(COALESCE(license_status, 'reference_only')) = 'blocked'
                     THEN 1 ELSE 0 END) AS blockedCount,
            SUM(CASE WHEN LOWER(COALESCE(license_status, 'reference_only')) = 'review_required'
                     THEN 1 ELSE 0 END) AS reviewCount
     FROM media_references
     WHERE entity_type = 'game'
     GROUP BY entity_id, LOWER(media_type)`,
    { type: QueryTypes.SELECT }
  )

  return {
    stateRows,
    mediaMap: buildMediaCountMap(mediaRows),
  }
}

function buildBacklogEntries(rows = [], mediaMap = new Map(), consoleNameMap = new Map()) {
  return rows.map((row) => {
    const validation = parseMaybeJson(row.validationSummaryJson, {}) || {}
    const missingRelevantSections = normalizeMissingSections(parseMaybeJson(row.missingRelevantSectionsJson, []))
    const criticalErrors = normalizeMissingSections(parseMaybeJson(row.criticalErrorsJson, []))
    const reviewItems = normalizeMissingSections(validation.reviewItems || [])
    const consoleMeta = consoleNameMap.get(String(row.consoleId || '')) || null
    const media = {
      manuals: getMediaCounts(mediaMap, row.gameId, 'manual'),
      maps: getMediaCounts(mediaMap, row.gameId, 'map'),
      sprites: getMediaCounts(mediaMap, row.gameId, 'sprite_sheet'),
      endings: getMediaCounts(mediaMap, row.gameId, 'ending'),
    }

    const entry = {
      gameId: String(row.gameId || ''),
      title: row.title || null,
      consoleId: String(row.consoleId || ''),
      consoleName: consoleMeta?.name || row.consoleNameRaw || String(row.consoleId || ''),
      status: String(row.status || 'draft'),
      published: String(row.status || '').toLowerCase() === 'published' || safeNumber(row.slotActive) === 1,
      slotRank: safeNumber(row.slotRank, null),
      targetRank: safeNumber(row.targetRank, null),
      isTarget: safeNumber(row.isTarget) === 1,
      selectionScore: safeNumber(row.selectionScore),
      completionScore: safeNumber(row.completionScore),
      relevantExpected: safeNumber(row.relevantExpected),
      relevantFilled: safeNumber(row.relevantFilled),
      year: row.year || null,
      genre: row.genre || null,
      rarity: row.rarity || null,
      metascore: safeNumber(row.metascore, null),
      missingRelevantSections,
      criticalErrors,
      reviewItems,
      validation: {
        domains: validation.domains || {},
      },
      media,
    }

    entry.presentSignals = buildPresentSignals(entry)
    entry.opportunitySections = deriveOpportunitySections(entry)
    entry.backlogScore = computeBacklogScore(entry)
    entry.rationale = buildRationale(entry)

    return entry
  }).sort(compareBacklogEntries)
}

function buildMarkdownReport(report) {
  const lines = [
    '# PASS 1 Enrichment Backlog',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Pass key: \`${report.passKey}\``,
    `- Total candidates: \`${report.summary.totalCandidates}\``,
    `- Published candidates: \`${report.summary.publishedCandidates}\``,
    `- Locked candidates: \`${report.summary.lockedCandidates}\``,
    `- Global target count: \`${report.globalTargets.length}\``,
    `- Per-console limit: \`${report.summary.perConsoleLimit}\``,
    `- Global limit: \`${report.summary.globalLimit}\``,
    '',
    '## Global Targets',
    '',
    '| rank | game | console | status | backlog_score | opportunities | signals |',
    '|---|---|---|---|---:|---|---|',
  ]

  report.globalTargets.forEach((entry, index) => {
    const missing = entry.opportunitySections.join(', ') || 'none'
    const signals = Object.entries(entry.presentSignals)
      .filter(([, value]) => Boolean(value))
      .map(([key]) => key)
      .join(', ') || 'none'
    lines.push(`| ${index + 1} | ${entry.title} | ${entry.consoleName} | ${entry.status} | ${entry.backlogScore} | ${missing} | ${signals} |`)
  })

  lines.push('', '## By Console', '')

  for (const consoleEntry of report.byConsole) {
    lines.push(`### ${consoleEntry.consoleName} (\`${consoleEntry.consoleId}\`)`, '')
    lines.push(`- candidates: \`${consoleEntry.candidateCount}\``)
    lines.push(`- selected: \`${consoleEntry.selectedCount}\``)
    lines.push(`- underfilled: \`${consoleEntry.underfilled}\``)
    lines.push('')

    consoleEntry.entries.forEach((entry) => {
      lines.push(`- ${entry.title} — \`${entry.status}\` — score \`${entry.backlogScore}\` — opportunities: ${entry.opportunitySections.join(', ') || 'none'}`)
    })

    lines.push('')
  }

  return `${lines.join('\n').trim()}\n`
}

function ensureAuditDir() {
  if (!fs.existsSync(AUDIT_OUTPUT_DIR)) {
    fs.mkdirSync(AUDIT_OUTPUT_DIR, { recursive: true })
  }
}

async function buildPass1EnrichmentBacklogReport({
  passKey = PASS1_KEY,
  perConsoleLimit = 3,
  globalLimit = 40,
} = {}) {
  const [{ stateRows, mediaMap }, consoleNameMap] = await Promise.all([
    loadBacklogSourceRows(passKey),
    loadConsoleNameMap(),
  ])

  const entries = buildBacklogEntries(stateRows, mediaMap, consoleNameMap)
  const actionableEntries = entries.filter((entry) => (
    entry.opportunitySections.length > 0
    || entry.criticalErrors.length > 0
    || entry.reviewItems.length > 0
  ))
  const globalTargets = selectBacklogTargets(actionableEntries, { perConsoleLimit, globalLimit })
  const selectedIds = new Set(globalTargets.map((entry) => entry.gameId))

  const byConsole = Array.from(
    actionableEntries.reduce((map, entry) => {
      const key = String(entry.consoleId || '')
      if (!map.has(key)) {
        map.set(key, {
          consoleId: key,
          consoleName: entry.consoleName,
          entries: [],
        })
      }
      map.get(key).entries.push(entry)
      return map
    }, new Map()).values()
  )
    .map((entry) => ({
      consoleId: entry.consoleId,
      consoleName: entry.consoleName,
      candidateCount: entry.entries.length,
      selectedCount: entry.entries.filter((item) => selectedIds.has(item.gameId)).length,
      underfilled: entry.entries.length < perConsoleLimit,
      entries: entry.entries.slice(0, perConsoleLimit),
    }))
    .sort((left, right) => left.consoleName.localeCompare(right.consoleName, 'fr', { sensitivity: 'base' }))

  const report = {
    passKey,
    generatedAt: new Date().toISOString(),
    summary: {
      evaluatedEntries: entries.length,
      totalCandidates: actionableEntries.length,
      publishedCandidates: actionableEntries.filter((entry) => entry.published).length,
      lockedCandidates: actionableEntries.filter((entry) => String(entry.status).toLowerCase() === 'locked').length,
      globalLimit,
      perConsoleLimit,
    },
    globalTargets,
    byConsole,
  }

  return report
}

async function writePass1EnrichmentBacklogReport(report) {
  ensureAuditDir()
  const timestamp = String(report.generatedAt || new Date().toISOString()).replace(/[:.]/g, '-')
  const jsonPath = path.join(AUDIT_OUTPUT_DIR, `${timestamp}_pass1_enrichment_backlog.json`)
  const markdownPath = path.join(AUDIT_OUTPUT_DIR, `${timestamp}_pass1_enrichment_backlog.md`)

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2))
  fs.writeFileSync(markdownPath, buildMarkdownReport(report))

  return {
    jsonPath,
    markdownPath,
  }
}

module.exports = {
  DOMAIN_WEIGHTS,
  computeBacklogScore,
  selectBacklogTargets,
  buildPass1EnrichmentBacklogReport,
  writePass1EnrichmentBacklogReport,
}
