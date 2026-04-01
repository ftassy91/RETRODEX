'use strict'

const { QueryTypes, Op } = require('sequelize')

const Game = require('../../../models/Game')
const { sequelize } = require('../../../database')
const { tableExists } = require('../../publication-service')
const { getSelectableGameAttributes, getGameColumnNames } = require('../game-read/schema')
const { normalizeRoleSignal, normalizeMediaSignal } = require('./rules')

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
    const mediaType = normalizeMediaSignal(row.mediaType)
    if (!mediaType) {
      continue
    }

    const summary = ensureMediaSummary(map, row.gameId)
    summary.signals[mediaType] = summary.signals[mediaType] || Number(row.validCount || 0) > 0
    summary.validCounts[mediaType] = Number(row.validCount || 0)
    summary.distinctCount = Object.entries(summary.signals)
      .filter(([key, value]) => key !== 'cover' && Boolean(value))
      .length
  }

  return map
}

async function loadCreditSummaryMap(gameIds = []) {
  const map = new Map()
  const replacements = {}

  if (await tableExists('game_people')) {
    const { ids, clause } = buildWhereClause(gameIds)
    if (ids.length) {
      replacements.gameIds = ids
    }
    const peopleRows = await sequelize.query(
      `SELECT game_id AS gameId,
              role,
              COUNT(*) AS totalCount
       FROM game_people
       WHERE 1 = 1
         ${clause}
       GROUP BY game_id, role`,
      {
        replacements,
        type: QueryTypes.SELECT,
      }
    )

    for (const row of peopleRows) {
      const role = normalizeRoleSignal(row.role)
      if (!role) {
        continue
      }
      const summary = ensureCreditSummary(map, row.gameId)
      summary.signals[role] = true
      summary.peopleCount += Number(row.totalCount || 0)
      summary.distinctRoleCount = Object.values(summary.signals).filter(Boolean).length
    }
  }

  if (await tableExists('game_companies')) {
    const { ids, clause } = buildWhereClause(gameIds)
    const companyRows = await sequelize.query(
      `SELECT game_id AS gameId,
              role,
              COUNT(*) AS totalCount
       FROM game_companies
       WHERE 1 = 1
         ${clause}
       GROUP BY game_id, role`,
      {
        replacements: ids.length ? { gameIds: ids } : {},
        type: QueryTypes.SELECT,
      }
    )

    for (const row of companyRows) {
      const role = normalizeRoleSignal(row.role)
      if (!role) {
        continue
      }
      const summary = ensureCreditSummary(map, row.gameId)
      summary.signals[role] = true
      summary.companyCount += Number(row.totalCount || 0)
      summary.distinctRoleCount = Object.values(summary.signals).filter(Boolean).length
    }
  }

  return map
}

async function loadMusicSummaryMap(gameIds = []) {
  const map = new Map()
  const replacements = {}
  const { ids, clause } = buildWhereClause(gameIds)
  if (ids.length) {
    replacements.gameIds = ids
  }

  if (await tableExists('ost')) {
    const ostRows = await sequelize.query(
      `SELECT game_id AS gameId,
              COUNT(*) AS releaseCount
       FROM ost
       WHERE 1 = 1
         ${clause}
       GROUP BY game_id`,
      {
        replacements,
        type: QueryTypes.SELECT,
      }
    )

    for (const row of ostRows) {
      const summary = ensureMusicSummary(map, row.gameId)
      summary.releaseCount = Number(row.releaseCount || 0)
    }
  }

  if (await tableExists('ost_tracks') && await tableExists('ost')) {
    const rows = await sequelize.query(
      `SELECT o.game_id AS gameId,
              COUNT(t.id) AS trackCount,
              COUNT(DISTINCT t.composer_person_id) AS composerCount
       FROM ost o
       LEFT JOIN ost_tracks t ON t.ost_id = o.id
       WHERE 1 = 1
         ${clause}
       GROUP BY o.game_id`,
      {
        replacements,
        type: QueryTypes.SELECT,
      }
    )

    for (const row of rows) {
      const summary = ensureMusicSummary(map, row.gameId)
      summary.trackCount = Number(row.trackCount || 0)
      summary.composerCount = Number(row.composerCount || 0)
    }
  }

  if (await tableExists('ost_releases') && await tableExists('ost')) {
    const rows = await sequelize.query(
      `SELECT o.game_id AS gameId,
              COUNT(DISTINCT r.id) AS releaseCount,
              COUNT(DISTINCT NULLIF(TRIM(COALESCE(r.label, '')), '')) AS labelCount
       FROM ost o
       LEFT JOIN ost_releases r ON r.ost_id = o.id
       WHERE 1 = 1
         ${clause}
       GROUP BY o.game_id`,
      {
        replacements,
        type: QueryTypes.SELECT,
      }
    )

    for (const row of rows) {
      const summary = ensureMusicSummary(map, row.gameId)
      summary.releaseCount = Number(row.releaseCount || 0)
      summary.labelCount = Number(row.labelCount || 0)
    }
  }

  return map
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

module.exports = {
  createEmptyCreditSummary,
  createEmptyMediaSummary,
  createEmptyMusicSummary,
  loadBaseGames,
  loadCreditSummaryMap,
  loadCurationStateMap,
  loadMediaSummaryMap,
  loadMusicSummaryMap,
  loadProfileMap,
  loadQualityMap,
  loadStoredStatusMap,
}
