'use strict'
// DATA: Sequelize via admin game read schema, canonical tables, and premium scoring - admin/back-office only

const { QueryTypes } = require('sequelize')
const { Op } = require('sequelize')

const Game = require('../../../models/Game')
const { sequelize } = require('../../../database')
const { tableExists } = require('../../publication-service')
const { getSelectableGameAttributes, getGameColumnNames } = require('../game-read/schema')
const { normalizeRoleSignal, normalizeMediaSignal } = require('./rules')
const { countStructuredEntries, parseMaybeJson, scorePremiumCoverageEntry } = require('./scoring')
const { buildGameEvidenceSummaryMap } = require('./evidence-service')

const PREMIUM_GAME_ATTRIBUTES = [
  'id',
  'type',
  'title',
  'console',
  'consoleId',
  'year',
  'releaseDate',
  'developer',
  'developerId',
  'publisherId',
  'genre',
  'metascore',
  'rarity',
  'summary',
  'synopsis',
  'cover_url',
  'coverImage',
  'source_confidence',
  'lore',
  'gameplay_description',
  'characters',
  'manual_url',
  'youtube_id',
  'youtube_verified',
  'archive_id',
  'archive_verified',
  'ost_composers',
  'ost_notable_tracks',
  'versions',
  'avg_duration_main',
  'avg_duration_complete',
  'speedrun_wr',
  'slug',
]

function normalizeGameIds(gameIds = []) {
  return Array.from(new Set((gameIds || []).filter(Boolean).map((value) => String(value))))
}

function createEmptyMediaSummary() {
  return {
    signals: {
      cover: false,
      manual: false,
      map: false,
      sprite_sheet: false,
      ending: false,
      archive_item: false,
      youtube_video: false,
      screenshot: false,
      scan: false,
    },
    validCounts: {},
    distinctCount: 0,
  }
}

function ensureMediaSummary(map, gameId) {
  const key = String(gameId || '')
  if (!map.has(key)) {
    map.set(key, createEmptyMediaSummary())
  }
  return map.get(key)
}

function createEmptyCreditSummary() {
  return {
    signals: {
      developer: false,
      publisher: false,
      distributor: false,
      soundtrack_label: false,
      director: false,
      composer: false,
      writer: false,
      producer: false,
      designer: false,
      programmer: false,
    },
    peopleCount: 0,
    companyCount: 0,
    distinctRoleCount: 0,
  }
}

function ensureCreditSummary(map, gameId) {
  const key = String(gameId || '')
  if (!map.has(key)) {
    map.set(key, createEmptyCreditSummary())
  }
  return map.get(key)
}

function createEmptyMusicSummary() {
  return {
    composerCount: 0,
    trackCount: 0,
    releaseCount: 0,
    labelCount: 0,
  }
}

function ensureMusicSummary(map, gameId) {
  const key = String(gameId || '')
  if (!map.has(key)) {
    map.set(key, createEmptyMusicSummary())
  }
  return map.get(key)
}

function buildWhereClause(gameIds = []) {
  const ids = normalizeGameIds(gameIds)
  return {
    ids,
    clause: ids.length ? 'AND game_id IN (:gameIds)' : '',
  }
}

async function loadStoredStatusMap(gameIds = []) {
  const columns = await getGameColumnNames()
  const hasStatuses = ['editorial_status', 'media_status', 'price_status'].every((name) => columns.has(name))
  if (!hasStatuses) {
    return new Map()
  }

  const ids = normalizeGameIds(gameIds)
  const whereClause = ids.length ? 'AND id IN (:gameIds)' : ''
  const rows = await sequelize.query(
    `SELECT id AS gameId,
            editorial_status AS editorialStatus,
            media_status AS mediaStatus,
            price_status AS priceStatus
     FROM games
     WHERE COALESCE(type, 'game') = 'game'
       ${whereClause}`,
    {
      replacements: ids.length ? { gameIds: ids } : {},
      type: QueryTypes.SELECT,
    }
  )

  return new Map(rows.map((row) => [String(row.gameId), row]))
}

async function loadProfileMap(gameIds = []) {
  if (!(await tableExists('game_content_profiles'))) {
    return new Map()
  }

  const { ids, clause } = buildWhereClause(gameIds)
  const rows = await sequelize.query(
    `SELECT game_id AS gameId,
            console_id AS consoleId,
            profile_version AS profileVersion,
            profile_mode AS profileMode,
            content_profile_json AS contentProfileJson,
            profile_basis_json AS profileBasisJson,
            relevant_expected AS relevantExpected
     FROM game_content_profiles
     WHERE 1 = 1
       ${clause}`,
    {
      replacements: ids.length ? { gameIds: ids } : {},
      type: QueryTypes.SELECT,
    }
  )

  return new Map(rows.map((row) => [String(row.gameId), row]))
}

async function loadCurationStateMap(gameIds = []) {
  if (!(await tableExists('game_curation_states'))) {
    return new Map()
  }

  const { ids, clause } = buildWhereClause(gameIds)
  const rows = await sequelize.query(
    `SELECT game_id AS gameId,
            pass_key AS passKey,
            status,
            selection_score AS selectionScore,
            target_rank AS targetRank,
            is_target AS isTarget,
            completion_score AS completionScore,
            relevant_expected AS relevantExpected,
            relevant_filled AS relevantFilled,
            missing_relevant_sections_json AS missingRelevantSectionsJson,
            critical_errors_json AS criticalErrorsJson,
            validation_summary_json AS validationSummaryJson
     FROM game_curation_states
     WHERE 1 = 1
       ${clause}`,
    {
      replacements: ids.length ? { gameIds: ids } : {},
      type: QueryTypes.SELECT,
    }
  )

  return new Map(rows.map((row) => [String(row.gameId), row]))
}

async function loadQualityMap(gameIds = []) {
  if (!(await tableExists('quality_records'))) {
    return new Map()
  }

  const ids = normalizeGameIds(gameIds)
  const whereClause = ids.length ? 'AND entity_id IN (:gameIds)' : ''
  const rows = await sequelize.query(
    `SELECT entity_id AS gameId,
            completeness_score AS completenessScore,
            confidence_score AS confidenceScore,
            source_coverage_score AS sourceCoverageScore,
            freshness_score AS freshnessScore,
            overall_score AS overallScore,
            tier,
            priority_score AS priorityScore,
            missing_critical_fields AS missingCriticalFields,
            breakdown_json AS breakdownJson
     FROM quality_records
     WHERE entity_type = 'game'
       ${whereClause}`,
    {
      replacements: ids.length ? { gameIds: ids } : {},
      type: QueryTypes.SELECT,
    }
  )

  return new Map(rows.map((row) => [String(row.gameId), row]))
}

async function loadMediaSummaryMap(gameIds = []) {
  if (!(await tableExists('media_references'))) {
    return new Map()
  }

  const ids = normalizeGameIds(gameIds)
  const whereClause = ids.length ? 'AND entity_id IN (:gameIds)' : ''
  const rows = await sequelize.query(
    `SELECT entity_id AS gameId,
            LOWER(media_type) AS mediaType,
            COUNT(*) AS totalCount,
            SUM(CASE WHEN COALESCE(ui_allowed, 1) = 1
                       AND LOWER(COALESCE(license_status, 'reference_only')) <> 'blocked'
                     THEN 1 ELSE 0 END) AS validCount
     FROM media_references
     WHERE entity_type = 'game'
       ${whereClause}
     GROUP BY entity_id, LOWER(media_type)`,
    {
      replacements: ids.length ? { gameIds: ids } : {},
      type: QueryTypes.SELECT,
    }
  )

  const map = new Map()
  for (const row of rows) {
    const mediaKey = normalizeMediaSignal(row.mediaType)
    if (!mediaKey && String(row.mediaType || '').toLowerCase() !== 'cover') {
      continue
    }
    const summary = ensureMediaSummary(map, row.gameId)
    const normalizedKey = mediaKey || 'cover'
    const validCount = Number(row.validCount || 0)
    summary.validCounts[normalizedKey] = validCount
    summary.signals[normalizedKey] = validCount > 0
  }

  for (const summary of map.values()) {
    summary.distinctCount = Object.entries(summary.signals)
      .filter(([key, value]) => key !== 'cover' && Boolean(value))
      .length
  }

  return map
}

async function loadCreditSummaryMap(gameIds = []) {
  const map = new Map()
  const ids = normalizeGameIds(gameIds)
  const replacements = ids.length ? { gameIds: ids } : {}
  const whereClause = ids.length ? 'AND gp.game_id IN (:gameIds)' : ''
  const companyWhereClause = ids.length ? 'AND gc.game_id IN (:gameIds)' : ''

  if ((await tableExists('game_people')) && (await tableExists('people'))) {
    const rows = await sequelize.query(
      `SELECT gp.game_id AS gameId,
              LOWER(COALESCE(gp.role, p.primary_role, '')) AS role
       FROM game_people gp
       LEFT JOIN people p ON p.id = gp.person_id
       WHERE 1 = 1
         ${whereClause}`,
      {
        replacements,
        type: QueryTypes.SELECT,
      }
    )

    for (const row of rows) {
      const roleKey = normalizeRoleSignal(row.role)
      if (!roleKey) {
        continue
      }
      const summary = ensureCreditSummary(map, row.gameId)
      summary.signals[roleKey] = true
      summary.peopleCount += 1
    }
  }

  if ((await tableExists('game_companies')) && (await tableExists('companies'))) {
    const rows = await sequelize.query(
      `SELECT gc.game_id AS gameId,
              LOWER(COALESCE(gc.role, c.role, '')) AS role
       FROM game_companies gc
       LEFT JOIN companies c ON c.id = gc.company_id
       WHERE 1 = 1
         ${companyWhereClause}`,
      {
        replacements,
        type: QueryTypes.SELECT,
      }
    )

    for (const row of rows) {
      const roleKey = normalizeRoleSignal(row.role)
      if (!roleKey) {
        continue
      }
      const summary = ensureCreditSummary(map, row.gameId)
      summary.signals[roleKey] = true
      summary.companyCount += 1
    }
  }

  for (const summary of map.values()) {
    summary.distinctRoleCount = Object.values(summary.signals).filter(Boolean).length
  }

  return map
}

async function loadMusicSummaryMap(gameIds = []) {
  const map = new Map()
  const ids = normalizeGameIds(gameIds)

  if (await tableExists('ost')) {
    const replacements = ids.length ? { gameIds: ids } : {}
    const whereClause = ids.length ? 'WHERE o.game_id IN (:gameIds)' : ''
    const rows = await sequelize.query(
      `SELECT o.game_id AS gameId,
              COUNT(DISTINCT t.id) AS trackCount,
              COUNT(DISTINCT r.id) AS releaseCount,
              COUNT(DISTINCT CASE WHEN r.label IS NOT NULL AND TRIM(r.label) <> '' THEN r.label END) AS labelCount
       FROM ost o
       LEFT JOIN ost_tracks t ON t.ost_id = o.id
       LEFT JOIN ost_releases r ON r.ost_id = o.id
       ${whereClause}
       GROUP BY o.game_id`,
      {
        replacements,
        type: QueryTypes.SELECT,
      }
    )

    for (const row of rows) {
      const summary = ensureMusicSummary(map, row.gameId)
      summary.trackCount = Number(row.trackCount || 0)
      summary.releaseCount = Number(row.releaseCount || 0)
      summary.labelCount = Number(row.labelCount || 0)
    }
  }

  return map
}

function buildPremiumCoverageSnapshot(game, context) {
  const profile = context.profile || null
  const curation = context.curation || null
  const quality = context.quality || null
  const evidence = context.evidence || null
  const media = context.media || createEmptyMediaSummary()
  const credits = context.credits || createEmptyCreditSummary()
  const music = context.music || createEmptyMusicSummary()
  const storedStatus = context.storedStatus || null

  const composersFromGame = countStructuredEntries(game.ost_composers)
  const tracksFromGame = countStructuredEntries(game.ost_notable_tracks)
  const finalMusic = {
    composerCount: Math.max(
      Number(music.composerCount || 0),
      composersFromGame,
      credits.signals.composer ? 1 : 0
    ),
    trackCount: Math.max(Number(music.trackCount || 0), tracksFromGame),
    releaseCount: Number(music.releaseCount || 0),
    labelCount: Number(music.labelCount || 0),
  }

  const finalCredits = {
    ...credits,
    signals: {
      ...credits.signals,
      developer: Boolean(credits.signals.developer || game.developer || game.developerId),
      publisher: Boolean(credits.signals.publisher || game.publisherId),
      soundtrack_label: Boolean(credits.signals.soundtrack_label || finalMusic.labelCount > 0),
      composer: Boolean(credits.signals.composer || finalMusic.composerCount > 0),
    },
  }
  finalCredits.distinctRoleCount = Object.values(finalCredits.signals).filter(Boolean).length

  const finalMedia = {
    ...media,
    signals: {
      ...media.signals,
      cover: Boolean(media.signals.cover || game.cover_url || game.coverImage),
      manual: Boolean(media.signals.manual || game.manual_url),
      archive_item: Boolean(media.signals.archive_item || game.archive_id),
      youtube_video: Boolean(media.signals.youtube_video || game.youtube_id),
    },
  }
  finalMedia.distinctCount = Object.entries(finalMedia.signals)
    .filter(([key, value]) => key !== 'cover' && Boolean(value))
    .length

  const snapshot = {
    gameId: String(game.id),
    title: game.title || null,
    console: game.console || null,
    consoleId: game.consoleId || null,
    year: game.year || null,
    releaseDate: game.releaseDate || null,
    rarity: game.rarity || null,
    metascore: game.metascore == null ? null : Number(game.metascore),
    developer: game.developer || null,
    developerId: game.developerId || null,
    publisherId: game.publisherId || null,
    slug: game.slug || null,
    summary: game.summary || null,
    synopsis: game.synopsis || null,
    lore: game.lore || null,
    gameplayDescription: game.gameplay_description || null,
    characters: game.characters || null,
    coverUrl: game.cover_url || null,
    coverImage: game.coverImage || null,
    profile: profile ? {
      version: profile.profileVersion || null,
      mode: profile.profileMode || null,
      relevantExpected: Number(profile.relevantExpected || 0),
      contentProfile: parseMaybeJson(profile.contentProfileJson, {}),
      basis: parseMaybeJson(profile.profileBasisJson, {}),
    } : null,
    curation: curation ? {
      passKey: curation.passKey || null,
      status: curation.status || null,
      selectionScore: Number(curation.selectionScore || 0),
      targetRank: curation.targetRank == null ? null : Number(curation.targetRank),
      isTarget: Number(curation.isTarget || 0) === 1,
      completionScore: Number(curation.completionScore || 0),
      relevantExpected: Number(curation.relevantExpected || 0),
      relevantFilled: Number(curation.relevantFilled || 0),
      missingRelevantSections: parseMaybeJson(curation.missingRelevantSectionsJson, []) || [],
      criticalErrors: parseMaybeJson(curation.criticalErrorsJson, []) || [],
      validationSummary: parseMaybeJson(curation.validationSummaryJson, {}) || {},
    } : null,
    audit: quality ? {
      completenessScore: Number(quality.completenessScore || 0),
      confidenceScore: Number(quality.confidenceScore || 0),
      sourceCoverageScore: Number(quality.sourceCoverageScore || 0),
      freshnessScore: Number(quality.freshnessScore || 0),
      overallScore: Number(quality.overallScore || 0),
      tier: quality.tier || null,
      priorityScore: Number(quality.priorityScore || 0),
      missingCriticalFields: parseMaybeJson(quality.missingCriticalFields, []) || [],
      breakdown: parseMaybeJson(quality.breakdownJson, {}) || {},
    } : null,
    storedStatuses: storedStatus ? {
      editorialStatus: storedStatus.editorialStatus || null,
      mediaStatus: storedStatus.mediaStatus || null,
      priceStatus: storedStatus.priceStatus || null,
    } : null,
    evidence: evidence || {
      sourceRecordCount: 0,
      fieldProvenanceCount: 0,
      attributedFieldCount: 0,
      inferredFieldCount: 0,
      verifiedFieldCount: 0,
      avgFieldConfidence: 0,
      sourceNames: [],
      fieldNames: [],
    },
    credits: finalCredits,
    media: finalMedia,
    music: finalMusic,
    editorial: {
      signals: {
        summary: Boolean(game.summary),
        synopsis: Boolean(game.synopsis),
        lore: Boolean(game.lore),
        characters: countStructuredEntries(game.characters) > 0,
      },
    },
  }

  return {
    ...snapshot,
    ...scorePremiumCoverageEntry(snapshot),
  }
}

async function loadBaseGames(gameIds = []) {
  const selectableAttributes = await getSelectableGameAttributes(PREMIUM_GAME_ATTRIBUTES)
  const ids = normalizeGameIds(gameIds)
  const where = {
    type: 'game',
  }

  if (ids.length) {
    where.id = {
      [Op.in]: ids,
    }
  }

  const rows = await Game.findAll({
    where,
    attributes: selectableAttributes,
  })

  return rows.map((row) => row.get({ plain: true }))
}

function compareCoverageEntries(left, right) {
  if (Number(left.isTop100Candidate) !== Number(right.isTop100Candidate)) {
    return left.isTop100Candidate ? -1 : 1
  }
  if (Number(left.completenessScore || 0) !== Number(right.completenessScore || 0)) {
    return Number(right.completenessScore || 0) - Number(left.completenessScore || 0)
  }
  if (Number(left.audit?.priorityScore || 0) !== Number(right.audit?.priorityScore || 0)) {
    return Number(right.audit?.priorityScore || 0) - Number(left.audit?.priorityScore || 0)
  }
  return String(left.title || '').localeCompare(String(right.title || ''), 'fr', { sensitivity: 'base' })
}

async function buildPremiumCoverageEntries({ gameIds = [] } = {}) {
  const baseGames = await loadBaseGames(gameIds)
  const ids = baseGames.map((game) => String(game.id))

  const [
    profileMap,
    curationMap,
    qualityMap,
    mediaMap,
    creditMap,
    musicMap,
    evidenceMap,
    storedStatusMap,
  ] = await Promise.all([
    loadProfileMap(ids),
    loadCurationStateMap(ids),
    loadQualityMap(ids),
    loadMediaSummaryMap(ids),
    loadCreditSummaryMap(ids),
    loadMusicSummaryMap(ids),
    buildGameEvidenceSummaryMap(ids),
    loadStoredStatusMap(ids),
  ])

  return baseGames
    .map((game) => buildPremiumCoverageSnapshot(game, {
      profile: profileMap.get(String(game.id)) || null,
      curation: curationMap.get(String(game.id)) || null,
      quality: qualityMap.get(String(game.id)) || null,
      media: mediaMap.get(String(game.id)) || null,
      credits: creditMap.get(String(game.id)) || null,
      music: musicMap.get(String(game.id)) || null,
      evidence: evidenceMap.get(String(game.id)) || null,
      storedStatus: storedStatusMap.get(String(game.id)) || null,
    }))
    .sort(compareCoverageEntries)
}

function summarizePremiumCoverage(entries = []) {
  const summary = {
    totalGames: entries.length,
    publishable: 0,
    top100Candidates: 0,
    tiers: {
      gold: 0,
      silver: 0,
      bronze: 0,
      none: 0,
    },
    missingCoreCounts: {},
  }

  for (const entry of entries) {
    if (entry.isPublishable) {
      summary.publishable += 1
    }
    if (entry.isTop100Candidate) {
      summary.top100Candidates += 1
    }
    summary.tiers[entry.completionTier] = (summary.tiers[entry.completionTier] || 0) + 1
    for (const key of entry.missingCoreRequirements || []) {
      summary.missingCoreCounts[key] = (summary.missingCoreCounts[key] || 0) + 1
    }
  }

  return summary
}

module.exports = {
  buildPremiumCoverageEntries,
  summarizePremiumCoverage,
}
