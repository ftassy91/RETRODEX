'use strict'
// DATA: Sequelize via ../../database and admin services - not part of the canonical public runtime
// ROLE: prioritization and backlog report generation for enrichment planning
// CONSUMERS: dedicated enrichment tests and manual back-office workflows
// STATUS: retained admin orchestrator; pure scoring/profile logic lives in enrichment-backlog-profile.js

const fs = require('fs')
const path = require('path')

const { QueryTypes } = require('sequelize')

const { sequelize } = require('../../database')
const { listConsoleItems } = require('./console-service')
const { tableExists } = require('../publication-service')
const { PASS1_KEY } = require('./curation-service')
const {
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
} = require('./enrichment-backlog-profile')

const AUDIT_OUTPUT_DIR = path.resolve(__dirname, '../../../data/audit')

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
      lines.push(`- ${entry.title} - \`${entry.status}\` - score \`${entry.backlogScore}\` - opportunities: ${entry.opportunitySections.join(', ') || 'none'}`)
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
