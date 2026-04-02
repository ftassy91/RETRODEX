'use strict'

const fs = require('fs')
const path = require('path')
const Database = require('better-sqlite3')

const BACKEND_ROOT = path.join(__dirname, '..', '..', '..')
const DATA_ROOT = path.join(BACKEND_ROOT, 'data')
const AUDIT_DIR = path.join(DATA_ROOT, 'audit')
const TOP1200_DIR = path.join(AUDIT_DIR, 'top1200')
const ENRICHMENT_DIR = path.join(DATA_ROOT, 'enrichment')
const SQLITE_PATH = path.join(BACKEND_ROOT, 'storage', 'retrodex.sqlite')

const STATUS_ORDER = ['strong', 'close', 'weak', 'blocked_by_source']
const FAMILY_LABELS = {
  identity: 'Identite',
  editorial: 'Editorial',
  crew: 'Crew / developpement',
  market: 'Marche',
  media: 'Media / assets',
  collection: 'Collection / usage',
}

const FIELD_DEFINITIONS = [
  {
    key: 'identity_core',
    label: 'Identity Core',
    family: 'identity',
    targetClass: 'core',
    strongTarget: 0.99,
    sql: `
      title IS NOT NULL AND TRIM(title) <> ''
      AND console IS NOT NULL AND TRIM(console) <> ''
      AND slug IS NOT NULL AND TRIM(slug) <> ''
    `,
  },
  {
    key: 'summary',
    label: 'Summary',
    family: 'editorial',
    targetClass: 'core',
    strongTarget: 0.8,
    sql: `summary IS NOT NULL AND TRIM(summary) <> ''`,
  },
  {
    key: 'synopsis',
    label: 'Synopsis',
    family: 'editorial',
    targetClass: 'core',
    strongTarget: 0.35,
    sql: `synopsis IS NOT NULL AND TRIM(synopsis) <> ''`,
  },
  {
    key: 'tagline',
    label: 'Tagline',
    family: 'editorial',
    targetClass: 'premium',
    strongTarget: 0.15,
    sql: `tagline IS NOT NULL AND TRIM(tagline) <> ''`,
  },
  {
    key: 'dev_anecdotes',
    label: 'Dev Anecdotes',
    family: 'editorial',
    targetClass: 'premium',
    strongTarget: 0.15,
    sql: `dev_anecdotes IS NOT NULL AND TRIM(dev_anecdotes) <> ''`,
  },
  {
    key: 'versions',
    label: 'Versions',
    family: 'editorial',
    targetClass: 'premium',
    strongTarget: 0.15,
    sql: `versions IS NOT NULL AND TRIM(versions) <> ''`,
  },
  {
    key: 'dev_team_text',
    label: 'Dev Team (text)',
    family: 'crew',
    targetClass: 'core',
    strongTarget: 0.9,
    sql: `dev_team IS NOT NULL AND TRIM(dev_team) <> ''`,
  },
  {
    key: 'ost_composers',
    label: 'OST Composers',
    family: 'crew',
    targetClass: 'core',
    strongTarget: 0.85,
    sql: `ost_composers IS NOT NULL AND TRIM(ost_composers) <> ''`,
  },
  {
    key: 'crew_profile_complete',
    label: 'Crew Profile Complete',
    family: 'crew',
    targetClass: 'core',
    strongTarget: 0.9,
    sql: `
      EXISTS (SELECT 1 FROM game_companies gc WHERE gc.game_id = games.id)
      AND (
        EXISTS (SELECT 1 FROM game_people gp WHERE gp.game_id = games.id AND gp.role = 'developer')
        OR (dev_team IS NOT NULL AND TRIM(dev_team) <> '')
      )
      AND (
        EXISTS (SELECT 1 FROM game_people gp WHERE gp.game_id = games.id AND gp.role = 'composer')
        OR (ost_composers IS NOT NULL AND TRIM(ost_composers) <> '')
      )
      AND EXISTS (SELECT 1 FROM game_people gp WHERE gp.game_id = games.id)
    `,
  },
  {
    key: 'market_readiness',
    label: 'Market Readiness',
    family: 'market',
    targetClass: 'core',
    strongTarget: 0.7,
    sql: `COALESCE(loose_price, 0) > 0 OR COALESCE(cib_price, 0) > 0 OR COALESCE(mint_price, 0) > 0`,
  },
  {
    key: 'collection_support',
    label: 'Collection Support',
    family: 'collection',
    targetClass: 'core',
    strongTarget: 0.75,
    sql: `
      rarity IS NOT NULL AND TRIM(rarity) <> ''
      AND (
        (cover_url IS NOT NULL AND TRIM(cover_url) <> '')
        OR (coverImage IS NOT NULL AND TRIM(coverImage) <> '')
      )
      AND (COALESCE(loose_price, 0) > 0 OR COALESCE(cib_price, 0) > 0 OR COALESCE(mint_price, 0) > 0)
    `,
  },
  {
    key: 'manual',
    label: 'Manual',
    family: 'media',
    targetClass: 'core',
    strongTarget: 0.2,
    sql: `manual_url IS NOT NULL AND TRIM(manual_url) <> ''`,
  },
  {
    key: 'ost_notable_tracks',
    label: 'OST Notable Tracks',
    family: 'media',
    targetClass: 'core',
    strongTarget: 0.2,
    sql: `ost_notable_tracks IS NOT NULL AND TRIM(ost_notable_tracks) <> ''`,
  },
  {
    key: 'map',
    label: 'Maps',
    family: 'media',
    targetClass: 'premium',
    strongTarget: 0.08,
    sql: `EXISTS (SELECT 1 FROM media_references mr WHERE mr.entity_type = 'game' AND mr.entity_id = games.id AND mr.media_type = 'map')`,
  },
  {
    key: 'sprite',
    label: 'Sprites / Sheets',
    family: 'media',
    targetClass: 'premium',
    strongTarget: 0.08,
    sql: `EXISTS (SELECT 1 FROM media_references mr WHERE mr.entity_type = 'game' AND mr.entity_id = games.id AND mr.media_type IN ('sprite_sheet', 'sprites', 'sprite'))`,
  },
  {
    key: 'ending',
    label: 'Ending',
    family: 'media',
    targetClass: 'premium',
    strongTarget: 0.03,
    sql: `EXISTS (SELECT 1 FROM media_references mr WHERE mr.entity_type = 'game' AND mr.entity_id = games.id AND mr.media_type = 'ending')`,
  },
  {
    key: 'cheat_codes',
    label: 'Cheat Codes',
    family: 'collection',
    targetClass: 'expert_eligible',
    strongTarget: 0.3,
    eligibleSql: `
      cheat_codes IS NOT NULL AND TRIM(cheat_codes) <> ''
      OR EXISTS (
        SELECT 1
        FROM source_records sr
        WHERE sr.entity_type = 'game'
          AND sr.entity_id = games.id
          AND sr.field_name = 'cheat_codes'
      )
    `,
    sql: `cheat_codes IS NOT NULL AND TRIM(cheat_codes) <> ''`,
  },
  {
    key: 'avg_duration',
    label: 'Duration (Main/Complete)',
    family: 'collection',
    targetClass: 'expert_eligible',
    strongTarget: 0.5,
    eligibleSql: `
      avg_duration_main IS NOT NULL
      OR avg_duration_complete IS NOT NULL
      OR EXISTS (
        SELECT 1
        FROM source_records sr
        WHERE sr.entity_type = 'game'
          AND sr.entity_id = games.id
          AND sr.field_name IN ('avg_duration_main', 'avg_duration_complete')
      )
    `,
    sql: `avg_duration_main IS NOT NULL OR avg_duration_complete IS NOT NULL`,
  },
  {
    key: 'expert_signals',
    label: 'Speedrun / Records',
    family: 'collection',
    targetClass: 'expert_eligible',
    strongTarget: 0.6,
    eligibleSql: `
      speedrun_wr IS NOT NULL AND TRIM(speedrun_wr) <> ''
      OR EXISTS (SELECT 1 FROM game_record_categories grc WHERE grc.game_id = games.id)
      OR EXISTS (SELECT 1 FROM game_record_entries gre WHERE gre.game_id = games.id)
      OR EXISTS (SELECT 1 FROM game_competitive_profiles gcp WHERE gcp.game_id = games.id)
    `,
    sql: `
      speedrun_wr IS NOT NULL AND TRIM(speedrun_wr) <> ''
      OR EXISTS (SELECT 1 FROM game_record_categories grc WHERE grc.game_id = games.id)
      OR EXISTS (SELECT 1 FROM game_record_entries gre WHERE gre.game_id = games.id)
      OR EXISTS (SELECT 1 FROM game_competitive_profiles gcp WHERE gcp.game_id = games.id)
    `,
  },
]

function parseStringFlag(args = [], name, fallback = null) {
  const prefix = `--${name}=`
  const match = args.find((entry) => String(entry || '').startsWith(prefix))
  return match ? String(match).slice(prefix.length) : fallback
}

function roundPercent(value) {
  return Number((Number(value || 0) * 100).toFixed(1))
}

function percentToCount(target, total) {
  return Math.ceil(Number(target || 0) * Number(total || 0))
}

function clampNonNegative(value) {
  return Math.max(0, Number(value || 0))
}

function findLatestFile(dirPath, matcher) {
  if (!fs.existsSync(dirPath)) return null
  return fs.readdirSync(dirPath)
    .filter((entry) => matcher(entry))
    .map((entry) => {
      const fullPath = path.join(dirPath, entry)
      return {
        path: fullPath,
        stat: fs.statSync(fullPath),
      }
    })
    .sort((left, right) => right.stat.mtimeMs - left.stat.mtimeMs)[0]?.path || null
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function listFilesRecursive(dirPath, matcher, bucket = []) {
  if (!fs.existsSync(dirPath)) return bucket

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      listFilesRecursive(fullPath, matcher, bucket)
      continue
    }
    if (matcher(entry.name, fullPath)) {
      bucket.push({
        path: fullPath,
        stat: fs.statSync(fullPath),
      })
    }
  }

  return bucket
}

function latestAuditGamesFile() {
  return findLatestFile(AUDIT_DIR, (entry) => entry.endsWith('_games.json'))
}

function latestAuditSummaryFile() {
  return findLatestFile(AUDIT_DIR, (entry) => entry.endsWith('_summary.json'))
}

function latestTop1200SelectionBandFile() {
  return findLatestFile(TOP1200_DIR, (entry) => entry.endsWith('_top1200_selection_band.json'))
}

function loadFallbackAuditEntries(db) {
  const rows = db.prepare(`
    SELECT id
    FROM games
    WHERE type = 'game'
    ORDER BY
      CASE
        WHEN COALESCE(loose_price, 0) > 0 OR COALESCE(cib_price, 0) > 0 OR COALESCE(mint_price, 0) > 0 THEN 1
        ELSE 0
      END DESC,
      COALESCE(source_confidence, 0) DESC,
      COALESCE(metascore, 0) DESC,
      MAX(COALESCE(loose_price, 0), COALESCE(cib_price, 0), COALESCE(mint_price, 0)) DESC,
      year DESC,
      title COLLATE NOCASE ASC
  `).all()

  return rows.map((row, index) => ({
    entityType: 'game',
    entityId: String(row.id),
    overallScore: null,
    fallbackRank: index + 1,
  }))
}

function buildFallbackAuditSummary(auditEntries = []) {
  return {
    games: { total: auditEntries.length },
    consoles: null,
    market: null,
  }
}

function placeholders(ids) {
  return ids.map(() => '?').join(', ')
}

function normalizeBlockedFieldKey(fieldName) {
  const normalized = String(fieldName || '').trim()
  if (!normalized) return null

  const aliases = {
    dev_team: 'dev_team_text',
  }

  return aliases[normalized] || normalized
}

function loadBlockedResidueIndex() {
  const files = listFilesRecursive(ENRICHMENT_DIR, (entry) => entry.includes('blocked_residue') && entry.endsWith('.json'))
    .sort((left, right) => right.stat.mtimeMs - left.stat.mtimeMs)
  const latestFiles = []
  const seenDirectories = new Set()

  for (const file of files) {
    const directory = path.dirname(file.path)
    if (seenDirectories.has(directory)) continue
    seenDirectories.add(directory)
    latestFiles.push(file)
  }

  const idsByField = new Map()
  const entriesByField = new Map()
  const sourceFiles = []

  function register(fieldKey, entry) {
    if (!fieldKey || !entry?.gameId) return
    if (!idsByField.has(fieldKey)) idsByField.set(fieldKey, new Set())
    if (!entriesByField.has(fieldKey)) entriesByField.set(fieldKey, new Map())
    idsByField.get(fieldKey).add(String(entry.gameId))
    if (!entriesByField.get(fieldKey).has(String(entry.gameId))) {
      entriesByField.get(fieldKey).set(String(entry.gameId), {
        gameId: String(entry.gameId),
        title: entry.title || null,
        field: fieldKey,
        reason: entry.reason || null,
        missingField: entry.missingField || null,
        debtType: entry.debtType || null,
      })
    }
  }

  for (const file of latestFiles) {
    sourceFiles.push(file.path)
    const payload = readJson(file.path)

    if (Array.isArray(payload?.blocked)) {
      payload.blocked.forEach((entry) => register(normalizeBlockedFieldKey(entry.missingField), entry))
    }

    if (payload?.fields && typeof payload.fields === 'object') {
      for (const [fieldName, items] of Object.entries(payload.fields)) {
        if (!Array.isArray(items)) continue
        items.forEach((entry) => register(normalizeBlockedFieldKey(fieldName), entry))
      }
    }
  }

  return {
    sourceFiles,
    idsByField,
    entriesByField: new Map(
      [...entriesByField.entries()].map(([field, entryMap]) => [field, [...entryMap.values()]])
    ),
  }
}

function classifyStatus({ coverage, target, blockedCount, eligibleCount, filledCount, targetClass }) {
  if (eligibleCount === 0 && blockedCount > 0) return 'blocked_by_source'
  if (coverage >= target) return 'strong'
  if (blockedCount > 0 && coverage < target) return 'blocked_by_source'
  if (coverage >= target * 0.75) return 'close'
  return 'weak'
}

function statusLabel(status) {
  const labels = {
    strong: 'Strong',
    close: 'Close',
    weak: 'Weak',
    blocked_by_source: 'Blocked by source',
  }
  return labels[status] || status
}

function summarizeFamilyStatus(statuses = []) {
  const unique = new Set(statuses)
  if (!unique.size) return 'weak'
  if (unique.size === 1 && unique.has('strong')) return 'strong'
  if (unique.has('weak')) return 'weak'
  if (unique.has('blocked_by_source')) return 'blocked_by_source'
  if (unique.has('close')) return 'close'
  return 'strong'
}

function computeFieldSummary(db, ids, definition, blockedIds = new Set()) {
  const totalIds = ids.length
  if (!totalIds) {
    return {
      field: definition.key,
      label: definition.label,
      family: definition.family,
      family_label: FAMILY_LABELS[definition.family] || definition.family,
      target_class: definition.targetClass,
      strong_target: roundPercent(definition.strongTarget),
      filled_count: 0,
      eligible_count: definition.eligibleSql ? 0 : null,
      coverage_pct: 0,
      target_pct: roundPercent(definition.strongTarget),
      gap_to_target: 0,
      blocked_count: 0,
      status: 'weak',
      status_label: statusLabel('weak'),
    }
  }

  const sqlIds = placeholders(ids)
  const filledCount = db.prepare(`
    SELECT COUNT(*) AS c
    FROM games
    WHERE type = 'game'
      AND id IN (${sqlIds})
      AND (${definition.sql})
  `).get(...ids).c

  const eligibleCount = definition.eligibleSql
    ? db.prepare(`
      SELECT COUNT(*) AS c
      FROM games
      WHERE type = 'game'
        AND id IN (${sqlIds})
        AND (${definition.eligibleSql})
    `).get(...ids).c
    : null

  const denominator = eligibleCount || totalIds
  const blockedCount = ids.reduce((count, id) => count + (blockedIds.has(String(id)) ? 1 : 0), 0)
  const coverage = denominator ? filledCount / denominator : 0
  const status = classifyStatus({
    coverage,
    target: definition.strongTarget,
    blockedCount,
    eligibleCount: denominator,
    filledCount,
    targetClass: definition.targetClass,
  })

  return {
    field: definition.key,
    label: definition.label,
    family: definition.family,
    family_label: FAMILY_LABELS[definition.family] || definition.family,
    target_class: definition.targetClass,
    strong_target: roundPercent(definition.strongTarget),
    filled_count: filledCount,
    eligible_count: definition.eligibleSql ? eligibleCount : null,
    coverage_pct: roundPercent(coverage),
    target_pct: roundPercent(definition.strongTarget),
    gap_to_target: clampNonNegative(percentToCount(definition.strongTarget, denominator) - filledCount),
    blocked_count: blockedCount,
    status,
    status_label: statusLabel(status),
  }
}

function buildFamilySummaries(fieldSummaries, gameCount) {
  const grouped = new Map()

  for (const field of fieldSummaries) {
    if (!grouped.has(field.family)) grouped.set(field.family, [])
    grouped.get(field.family).push(field)
  }

  return Object.keys(FAMILY_LABELS).map((familyKey) => {
    const fields = grouped.get(familyKey) || []
    const avgCoverage = fields.length
      ? fields.reduce((sum, item) => sum + Number(item.coverage_pct || 0), 0) / fields.length
      : 0
    const avgTarget = fields.length
      ? fields.reduce((sum, item) => sum + Number(item.target_pct || 0), 0) / fields.length
      : 0
    const status = summarizeFamilyStatus(fields.map((field) => field.status))

    return {
      family: familyKey,
      label: FAMILY_LABELS[familyKey],
      field_count: fields.length,
      filled_count: Math.round((avgCoverage / 100) * gameCount),
      coverage_pct: Number(avgCoverage.toFixed(1)),
      target_pct: Number(avgTarget.toFixed(1)),
      gap_to_target: clampNonNegative(Math.ceil((avgTarget / 100) * gameCount) - Math.round((avgCoverage / 100) * gameCount)),
      status,
      status_label: statusLabel(status),
    }
  })
}

function buildBandSummary({ key, label, ids, db, blockedResidue }) {
  const fieldSummaries = FIELD_DEFINITIONS.map((definition) => computeFieldSummary(
    db,
    ids,
    definition,
    blockedResidue.idsByField.get(definition.key) || new Set()
  ))

  const statusCounts = STATUS_ORDER.reduce((acc, status) => {
    acc[status] = fieldSummaries.filter((field) => field.status === status).length
    return acc
  }, {})

  return {
    band: key,
    label,
    game_count: ids.length,
    status_counts: statusCounts,
    family_scores: buildFamilySummaries(fieldSummaries, ids.length),
    top_gaps: [...fieldSummaries]
      .sort((left, right) => Number(right.gap_to_target || 0) - Number(left.gap_to_target || 0)
        || Number(right.blocked_count || 0) - Number(left.blocked_count || 0)
        || String(left.label || '').localeCompare(String(right.label || ''), 'fr', { sensitivity: 'base' }))
      .slice(0, 6),
    field_summaries: fieldSummaries,
  }
}

function buildBlockedSourceSummary(blockedResidue, ids) {
  const allowedIds = new Set(ids.map((id) => String(id)))
  const result = []

  for (const definition of FIELD_DEFINITIONS) {
    const entries = (blockedResidue.entriesByField.get(definition.key) || [])
      .filter((entry) => allowedIds.has(String(entry.gameId)))
    if (!entries.length) continue

    const reasonCounts = entries.reduce((acc, entry) => {
      const key = entry.reason || 'unspecified'
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})

    result.push({
      field: definition.key,
      label: definition.label,
      family: definition.family,
      count: entries.length,
      sample_titles: entries.slice(0, 5).map((entry) => entry.title || entry.gameId),
      reasons: Object.entries(reasonCounts)
        .map(([reason, count]) => ({ reason, count }))
        .sort((left, right) => right.count - left.count),
    })
  }

  return result.sort((left, right) => right.count - left.count || String(left.label || '').localeCompare(String(right.label || ''), 'fr', { sensitivity: 'base' }))
}

function buildGlobalSummary(auditSummary, top1200Band, longTailBand, auditEntries) {
  const strongFields = top1200Band.field_summaries.filter((field) => field.status === 'strong').length
  const closeFields = top1200Band.field_summaries.filter((field) => field.status === 'close').length
  const weakFields = top1200Band.field_summaries.filter((field) => field.status === 'weak').length
  const blockedFields = top1200Band.field_summaries.filter((field) => field.status === 'blocked_by_source').length
  const scoredEntries = auditEntries.filter((entry) => Number.isFinite(Number(entry?.overallScore)))
  const avgOverallScore = scoredEntries.length
    ? scoredEntries.reduce((sum, entry) => sum + Number(entry.overallScore || 0), 0) / scoredEntries.length
    : 0

  return {
    total_games: Number(auditSummary?.games?.total || auditEntries.length || 0),
    top1200_games: top1200Band.game_count,
    long_tail_games: longTailBand.game_count,
    avg_overall_score: Number(avgOverallScore.toFixed(1)),
    tracked_fields: top1200Band.field_summaries.length,
    strong_fields: strongFields,
    close_fields: closeFields,
    weak_fields: weakFields,
    blocked_fields: blockedFields,
  }
}

function loadBandDefinitions(auditEntries, top1200Payload) {
  const auditGameIds = auditEntries
    .filter((entry) => entry.entityType === 'game')
    .map((entry) => String(entry.entityId))

  const top1200Ids = (top1200Payload?.ids?.length ? top1200Payload.ids : auditGameIds)
    .slice(0, 1200)
    .map((id) => String(id))
  const top1200Set = new Set(top1200Ids)

  return [
    { key: 'top100', label: 'Top100', ids: top1200Ids.slice(0, 100) },
    { key: 'top500', label: 'Top500', ids: top1200Ids.slice(0, 500) },
    { key: 'top1200', label: 'Top1200', ids: top1200Ids },
    { key: 'long_tail', label: 'Long tail', ids: auditGameIds.filter((id) => !top1200Set.has(id)) },
  ]
}

async function getCompletionOverview(options = {}) {
  const auditSummaryPath = options.auditSummaryPath || latestAuditSummaryFile()
  const auditGamesPath = options.auditGamesPath || latestAuditGamesFile()
  const top1200Path = options.top1200Path || latestTop1200SelectionBandFile()
  const sqlitePath = options.sqlitePath || SQLITE_PATH
  const blockedResidue = loadBlockedResidueIndex()
  const db = new Database(sqlitePath, { readonly: true })

  try {
    const auditEntries = auditGamesPath ? readJson(auditGamesPath) : loadFallbackAuditEntries(db)
    const auditSummary = auditSummaryPath ? readJson(auditSummaryPath) : buildFallbackAuditSummary(auditEntries)
    const top1200Payload = top1200Path ? readJson(top1200Path) : { ids: auditEntries.map((entry) => entry.entityId).slice(0, 1200) }
    const bandDefinitions = loadBandDefinitions(auditEntries, top1200Payload)
    const bands = bandDefinitions.map((band) => buildBandSummary({
      key: band.key,
      label: band.label,
      ids: band.ids,
      db,
      blockedResidue,
    }))

    const top1200Band = bands.find((band) => band.band === 'top1200') || bands[0]
    const longTailBand = bands.find((band) => band.band === 'long_tail') || { game_count: 0 }

    return {
      generated_at: new Date().toISOString(),
      sources: {
        audit_summary: auditSummaryPath,
        audit_games: auditGamesPath,
        top1200: top1200Path,
        blocked_residue: blockedResidue.sourceFiles,
        sqlite: sqlitePath,
        fallback_mode: !auditSummaryPath || !auditGamesPath || !top1200Path,
      },
      summary: buildGlobalSummary(auditSummary, top1200Band, longTailBand, auditEntries),
      bands,
      families: top1200Band.family_scores,
      field_rankings: [...top1200Band.field_summaries].sort((left, right) => Number(right.gap_to_target || 0) - Number(left.gap_to_target || 0)
        || Number(right.blocked_count || 0) - Number(left.blocked_count || 0)
        || String(left.label || '').localeCompare(String(right.label || ''), 'fr', { sensitivity: 'base' })),
      blocked_by_source: buildBlockedSourceSummary(blockedResidue, top1200Band.game_count ? bandDefinitions.find((band) => band.key === 'top1200').ids : []),
      audit_quality: {
        games: auditSummary.games || null,
        consoles: auditSummary.consoles || null,
        market: auditSummary.market || null,
      },
    }
  } finally {
    db.close()
  }
}

module.exports = {
  FAMILY_LABELS,
  FIELD_DEFINITIONS,
  STATUS_ORDER,
  getCompletionOverview,
  parseStringFlag,
}
