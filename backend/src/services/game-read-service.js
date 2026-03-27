'use strict'

const { Op, QueryTypes } = require('sequelize')

const Game = require('../models/Game')
const { sequelize } = require('../database')

const BASE_GAME_ATTRIBUTES = [
  'id',
  'type',
  'title',
  'console',
  'consoleId',
  'year',
  'developer',
  'genre',
  'metascore',
  'rarity',
  'summary',
  'synopsis',
  'tagline',
  'cover_url',
  'coverImage',
  'franch_id',
  'dev_anecdotes',
  'dev_team',
  'cheat_codes',
  'source_confidence',
  'loosePrice',
  'cibPrice',
  'mintPrice',
  'releaseDate',
  'lore',
  'gameplay_description',
  'characters',
  'manual_url',
  'ost_composers',
  'ost_notable_tracks',
  'versions',
  'avg_duration_main',
  'avg_duration_complete',
  'speedrun_wr',
  'slug',
]

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

function tableNamesMatch(tableName, target) {
  return String(tableName || '').replace(/"/g, '').toLowerCase() === String(target).toLowerCase()
}

let tableNamesPromise = null
let gameColumnsPromise = null

async function getTableNames() {
  if (!tableNamesPromise) {
    tableNamesPromise = sequelize.getQueryInterface()
      .showAllTables()
      .then((tables) => new Set((tables || []).map((tableName) => String(tableName || '').replace(/"/g, '').toLowerCase())))
      .catch(() => new Set())
  }

  return tableNamesPromise
}

async function tableExists(target) {
  const tables = await getTableNames()
  return tables.has(String(target || '').toLowerCase())
}

async function getGameColumnNames() {
  if (!gameColumnsPromise) {
    gameColumnsPromise = sequelize.getQueryInterface()
      .describeTable('games')
      .then((columns) => new Set(Object.keys(columns || {}).map((name) => String(name || '').toLowerCase())))
      .catch(() => new Set())
  }

  return gameColumnsPromise
}

async function getSelectableGameAttributes(attributes = BASE_GAME_ATTRIBUTES) {
  const columns = await getGameColumnNames()
  if (!columns.size) {
    return attributes.filter((attribute) => attribute !== 'coverImage')
  }

  return attributes.filter((attribute) => {
    const field = Game.rawAttributes?.[attribute]?.field || attribute
    return columns.has(String(field || '').toLowerCase())
  })
}

function buildPeopleBuckets(rows) {
  const buckets = {
    devTeam: [],
    composers: [],
  }

  for (const row of rows) {
    const entry = {
      name: row.name,
      role: row.role,
      confidence: Number(row.confidence || 0),
    }
    const normalizedRole = String(row.role || '').toLowerCase()
    if (normalizedRole.includes('composer') || normalizedRole.includes('music')) {
      buckets.composers.push(entry)
    } else {
      buckets.devTeam.push(entry)
    }
  }

  return buckets
}

async function loadCanonicalSupplements(gameId) {
  const [hasEditorial, hasPeople, hasMedia, hasSnapshot, hasQuality, hasReleases] = await Promise.all([
    tableExists('game_editorial'),
    Promise.all([tableExists('game_people'), tableExists('people')]).then((result) => result.every(Boolean)),
    tableExists('media_references'),
    tableExists('market_snapshots'),
    tableExists('quality_records'),
    tableExists('releases'),
  ])

  const [editorialRows, peopleRows, mediaRows, snapshotRows, qualityRows, releaseRows] = await Promise.all([
    hasEditorial
      ? sequelize.query(
        `SELECT summary,
                synopsis,
                lore,
                dev_notes AS devNotes,
                cheat_codes AS cheatCodes,
                characters,
                gameplay_description AS gameplayDescription
         FROM game_editorial
         WHERE game_id = :gameId
         LIMIT 1`,
        {
          replacements: { gameId },
          type: QueryTypes.SELECT,
        }
      )
      : Promise.resolve([]),
    hasPeople
      ? sequelize.query(
        `SELECT gp.role AS role, gp.confidence AS confidence, p.name AS name
         FROM game_people gp
         INNER JOIN people p ON p.id = gp.person_id
         WHERE gp.game_id = :gameId
         ORDER BY COALESCE(gp.billing_order, 9999) ASC, p.name ASC`,
        {
          replacements: { gameId },
          type: QueryTypes.SELECT,
        }
      )
      : Promise.resolve([]),
    hasMedia
      ? sequelize.query(
        `SELECT media_type AS mediaType, url
         FROM media_references
         WHERE entity_type = 'game'
           AND entity_id = :gameId`,
        {
          replacements: { gameId },
          type: QueryTypes.SELECT,
        }
      )
      : Promise.resolve([]),
    hasSnapshot
      ? sequelize.query(
        `SELECT loose_price AS loosePrice,
                cib_price AS cibPrice,
                mint_price AS mintPrice,
                observation_count AS observationCount,
                last_observed_at AS lastObservedAt,
                trend_signal AS trendSignal,
                confidence_score AS confidenceScore,
                source_coverage AS sourceCoverage
         FROM market_snapshots
         WHERE game_id = :gameId
         LIMIT 1`,
        {
          replacements: { gameId },
          type: QueryTypes.SELECT,
        }
      )
      : Promise.resolve([]),
    hasQuality
      ? sequelize.query(
        `SELECT completeness_score AS completenessScore,
                confidence_score AS confidenceScore,
                source_coverage_score AS sourceCoverageScore,
                freshness_score AS freshnessScore,
                overall_score AS overallScore,
                tier,
                missing_critical_fields AS missingCriticalFields,
                breakdown_json AS breakdownJson,
                priority_score AS priorityScore
         FROM quality_records
         WHERE entity_type = 'game'
           AND entity_id = :gameId
         LIMIT 1`,
        {
          replacements: { gameId },
          type: QueryTypes.SELECT,
        }
      )
      : Promise.resolve([]),
    hasReleases
      ? sequelize.query(
        `SELECT release_date AS releaseDate,
                release_year AS releaseYear,
                console_id AS consoleId,
                region_code AS regionCode,
                edition_name AS editionName
         FROM releases
         WHERE game_id = :gameId
         ORDER BY CASE WHEN edition_name = 'default' THEN 0 ELSE 1 END ASC, release_year ASC
         LIMIT 1`,
        {
          replacements: { gameId },
          type: QueryTypes.SELECT,
        }
      )
      : Promise.resolve([]),
  ])

  return {
    editorial: editorialRows[0] || null,
    people: buildPeopleBuckets(peopleRows),
    media: mediaRows.reduce((acc, row) => {
      acc[String(row.mediaType || '').toLowerCase()] = row.url
      return acc
    }, {}),
    snapshot: snapshotRows[0] || null,
    quality: qualityRows[0] || null,
    release: releaseRows[0] || null,
  }
}

async function loadCanonicalSupplementsMap(gameIds) {
  const ids = Array.from(new Set((gameIds || []).filter(Boolean).map((gameId) => String(gameId))))
  if (!ids.length) {
    return new Map()
  }

  const [hasEditorial, hasPeople, hasMedia, hasSnapshot, hasQuality, hasReleases] = await Promise.all([
    tableExists('game_editorial'),
    Promise.all([tableExists('game_people'), tableExists('people')]).then((result) => result.every(Boolean)),
    tableExists('media_references'),
    tableExists('market_snapshots'),
    tableExists('quality_records'),
    tableExists('releases'),
  ])

  const [editorialRows, peopleRows, mediaRows, snapshotRows, qualityRows, releaseRows] = await Promise.all([
    hasEditorial
      ? sequelize.query(
        `SELECT game_id AS gameId,
                summary,
                synopsis,
                lore,
                dev_notes AS devNotes,
                cheat_codes AS cheatCodes,
                characters,
                gameplay_description AS gameplayDescription
         FROM game_editorial
         WHERE game_id IN (:gameIds)`,
        {
          replacements: { gameIds: ids },
          type: QueryTypes.SELECT,
        }
      )
      : Promise.resolve([]),
    hasPeople
      ? sequelize.query(
        `SELECT gp.game_id AS gameId,
                gp.role AS role,
                gp.confidence AS confidence,
                p.name AS name
         FROM game_people gp
         INNER JOIN people p ON p.id = gp.person_id
         WHERE gp.game_id IN (:gameIds)
         ORDER BY gp.game_id ASC, COALESCE(gp.billing_order, 9999) ASC, p.name ASC`,
        {
          replacements: { gameIds: ids },
          type: QueryTypes.SELECT,
        }
      )
      : Promise.resolve([]),
    hasMedia
      ? sequelize.query(
        `SELECT entity_id AS gameId,
                media_type AS mediaType,
                url
         FROM media_references
         WHERE entity_type = 'game'
           AND entity_id IN (:gameIds)`,
        {
          replacements: { gameIds: ids },
          type: QueryTypes.SELECT,
        }
      )
      : Promise.resolve([]),
    hasSnapshot
      ? sequelize.query(
        `SELECT game_id AS gameId,
                loose_price AS loosePrice,
                cib_price AS cibPrice,
                mint_price AS mintPrice,
                observation_count AS observationCount,
                last_observed_at AS lastObservedAt,
                trend_signal AS trendSignal,
                confidence_score AS confidenceScore,
                source_coverage AS sourceCoverage
         FROM market_snapshots
         WHERE game_id IN (:gameIds)`,
        {
          replacements: { gameIds: ids },
          type: QueryTypes.SELECT,
        }
      )
      : Promise.resolve([]),
    hasQuality
      ? sequelize.query(
        `SELECT entity_id AS gameId,
                completeness_score AS completenessScore,
                confidence_score AS confidenceScore,
                source_coverage_score AS sourceCoverageScore,
                freshness_score AS freshnessScore,
                overall_score AS overallScore,
                tier,
                missing_critical_fields AS missingCriticalFields,
                breakdown_json AS breakdownJson,
                priority_score AS priorityScore
         FROM quality_records
         WHERE entity_type = 'game'
           AND entity_id IN (:gameIds)`,
        {
          replacements: { gameIds: ids },
          type: QueryTypes.SELECT,
        }
      )
      : Promise.resolve([]),
    hasReleases
      ? sequelize.query(
        `SELECT game_id AS gameId,
                release_date AS releaseDate,
                release_year AS releaseYear,
                console_id AS consoleId,
                region_code AS regionCode,
                edition_name AS editionName
         FROM releases
         WHERE game_id IN (:gameIds)
         ORDER BY game_id ASC,
                  CASE WHEN edition_name = 'default' THEN 0 ELSE 1 END ASC,
                  release_year ASC`,
        {
          replacements: { gameIds: ids },
          type: QueryTypes.SELECT,
        }
      )
      : Promise.resolve([]),
  ])

  const editorialMap = new Map(editorialRows.map((row) => [String(row.gameId), row]))
  const groupedPeopleRows = new Map()
  for (const row of peopleRows) {
    const gameId = String(row.gameId)
    if (!groupedPeopleRows.has(gameId)) {
      groupedPeopleRows.set(gameId, [])
    }
    groupedPeopleRows.get(gameId).push(row)
  }

  const peopleMap = new Map()
  for (const [gameId, rows] of groupedPeopleRows.entries()) {
    peopleMap.set(gameId, buildPeopleBuckets(rows))
  }

  const mediaMap = new Map()
  for (const row of mediaRows) {
    const gameId = String(row.gameId)
    if (!mediaMap.has(gameId)) {
      mediaMap.set(gameId, {})
    }
    mediaMap.get(gameId)[String(row.mediaType || '').toLowerCase()] = row.url
  }

  const snapshotMap = new Map(snapshotRows.map((row) => [String(row.gameId), row]))
  const qualityMap = new Map(qualityRows.map((row) => [String(row.gameId), row]))
  const releaseMap = new Map()
  for (const row of releaseRows) {
    const gameId = String(row.gameId)
    if (!releaseMap.has(gameId)) {
      releaseMap.set(gameId, row)
    }
  }

  return new Map(ids.map((gameId) => [
    gameId,
    {
      editorial: editorialMap.get(gameId) || null,
      people: peopleMap.get(gameId) || { devTeam: [], composers: [] },
      media: mediaMap.get(gameId) || {},
      snapshot: snapshotMap.get(gameId) || null,
      quality: qualityMap.get(gameId) || null,
      release: releaseMap.get(gameId) || null,
    },
  ]))
}

function mergeGameRecord(game, supplement) {
  if (!game) {
    return null
  }

  const editorial = supplement.editorial || {}
  const people = supplement.people || { devTeam: [], composers: [] }
  const media = supplement.media || {}
  const snapshot = supplement.snapshot || {}
  const quality = supplement.quality || null
  const release = supplement.release || {}

  return {
    ...game,
    summary: game.summary || editorial.summary || null,
    synopsis: game.synopsis || editorial.synopsis || editorial.lore || null,
    lore: game.lore || editorial.lore || null,
    dev_anecdotes: game.dev_anecdotes || editorial.devNotes || null,
    cheat_codes: parseMaybeJson(game.cheat_codes) || parseMaybeJson(editorial.cheatCodes) || null,
    characters: parseMaybeJson(game.characters) || parseMaybeJson(editorial.characters) || null,
    gameplay_description: game.gameplay_description || editorial.gameplayDescription || null,
    dev_team: people.devTeam.length ? people.devTeam : parseMaybeJson(game.dev_team) || null,
    ost_composers: people.composers.length ? people.composers : parseMaybeJson(game.ost_composers) || null,
    ost_notable_tracks: parseMaybeJson(game.ost_notable_tracks) || null,
    versions: parseMaybeJson(game.versions) || null,
    avg_duration_main: game.avg_duration_main ?? null,
    avg_duration_complete: game.avg_duration_complete ?? null,
    speedrun_wr: parseMaybeJson(game.speedrun_wr) || null,
    loosePrice: snapshot.loosePrice ?? game.loosePrice ?? game.loose_price ?? null,
    cibPrice: snapshot.cibPrice ?? game.cibPrice ?? game.cib_price ?? null,
    mintPrice: snapshot.mintPrice ?? game.mintPrice ?? game.mint_price ?? null,
    coverImage: media.cover || game.cover_url || game.coverImage || null,
    cover_url: media.cover || game.cover_url || game.coverImage || null,
    manual_url: media.manual || game.manual_url || null,
    releaseDate: release.releaseDate || game.releaseDate || null,
    quality: quality ? {
      completenessScore: Number(quality.completenessScore || 0),
      confidenceScore: Number(quality.confidenceScore || 0),
      sourceCoverageScore: Number(quality.sourceCoverageScore || 0),
      freshnessScore: Number(quality.freshnessScore || 0),
      overallScore: Number(quality.overallScore || 0),
      tier: quality.tier,
      missingCriticalFields: parseMaybeJson(quality.missingCriticalFields, []) || [],
      breakdown: parseMaybeJson(quality.breakdownJson, {}) || {},
      priorityScore: Number(quality.priorityScore || 0),
    } : null,
    market: snapshot ? {
      observationCount: Number(snapshot.observationCount || 0),
      lastObservedAt: snapshot.lastObservedAt || null,
      trendSignal: snapshot.trendSignal || null,
      confidenceScore: Number(snapshot.confidenceScore || 0),
      sourceCoverage: Number(snapshot.sourceCoverage || 0),
    } : null,
  }
}

async function hydrateGameRows(rows) {
  const plainRows = (rows || []).map((row) => (
    typeof row?.get === 'function' ? row.get({ plain: true }) : row
  ))

  if (!plainRows.length) {
    return []
  }

  const supplements = await loadCanonicalSupplementsMap(plainRows.map((row) => row.id))
  return plainRows.map((row) => mergeGameRecord(row, supplements.get(String(row.id)) || {}))
}

function normalizeSearchValue(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function rarityRankDescending(value) {
  switch (String(value || '').toUpperCase()) {
    case 'LEGENDARY': return 0
    case 'EPIC': return 1
    case 'RARE': return 2
    case 'UNCOMMON': return 3
    case 'COMMON': return 4
    default: return 5
  }
}

function rarityRankAscending(value) {
  switch (String(value || '').toUpperCase()) {
    case 'COMMON': return 0
    case 'UNCOMMON': return 1
    case 'RARE': return 2
    case 'EPIC': return 3
    case 'LEGENDARY': return 4
    default: return 5
  }
}

function compareNullableNumbers(left, right, ascending = true) {
  const leftEmpty = left == null || String(left).trim() === ''
  const rightEmpty = right == null || String(right).trim() === ''
  const leftNumber = Number(left)
  const rightNumber = Number(right)
  const leftMissing = leftEmpty || !Number.isFinite(leftNumber)
  const rightMissing = rightEmpty || !Number.isFinite(rightNumber)

  if (leftMissing && rightMissing) return 0
  if (leftMissing) return 1
  if (rightMissing) return -1

  return ascending ? leftNumber - rightNumber : rightNumber - leftNumber
}

function compareGamesForSort(leftGame, rightGame, sortKey) {
  const left = leftGame || {}
  const right = rightGame || {}
  const leftTitle = String(left.title || '')
  const rightTitle = String(right.title || '')

  switch (String(sortKey || '').trim()) {
    case 'title_desc':
      return rightTitle.localeCompare(leftTitle, 'fr', { sensitivity: 'base' })
    case 'price_asc':
      return compareNullableNumbers(left.loosePrice, right.loosePrice, true)
        || leftTitle.localeCompare(rightTitle, 'fr', { sensitivity: 'base' })
    case 'price_desc':
      return compareNullableNumbers(left.loosePrice, right.loosePrice, false)
        || leftTitle.localeCompare(rightTitle, 'fr', { sensitivity: 'base' })
    case 'year_asc':
      return compareNullableNumbers(left.year, right.year, true)
        || leftTitle.localeCompare(rightTitle, 'fr', { sensitivity: 'base' })
    case 'year_desc':
      return compareNullableNumbers(left.year, right.year, false)
        || leftTitle.localeCompare(rightTitle, 'fr', { sensitivity: 'base' })
    case 'meta_asc':
    case 'metascore_asc':
      return compareNullableNumbers(left.metascore, right.metascore, true)
        || leftTitle.localeCompare(rightTitle, 'fr', { sensitivity: 'base' })
    case 'meta_desc':
    case 'metascore_desc':
      return compareNullableNumbers(left.metascore, right.metascore, false)
        || leftTitle.localeCompare(rightTitle, 'fr', { sensitivity: 'base' })
    case 'rarity_desc':
      return rarityRankDescending(left.rarity) - rarityRankDescending(right.rarity)
        || compareNullableNumbers(left.loosePrice, right.loosePrice, false)
        || leftTitle.localeCompare(rightTitle, 'fr', { sensitivity: 'base' })
    case 'rarity_asc':
      return rarityRankAscending(left.rarity) - rarityRankAscending(right.rarity)
        || leftTitle.localeCompare(rightTitle, 'fr', { sensitivity: 'base' })
    case 'title_asc':
    default:
      return leftTitle.localeCompare(rightTitle, 'fr', { sensitivity: 'base' })
  }
}

function matchesSearch(game, search) {
  const query = normalizeSearchValue(search)
  if (!query) {
    return true
  }

  const fields = [
    game.title,
    game.developer,
    game.console,
    game.genre,
    game.summary,
    game.synopsis,
    game.lore,
    game.gameplay_description,
    game.tagline,
  ]

  return fields.some((value) => normalizeSearchValue(value).includes(query))
}

function matchesGenre(game, genreValue) {
  const genre = normalizeSearchValue(genreValue)
  if (!genre) {
    return true
  }
  return normalizeSearchValue(game.genre).includes(genre)
}

function buildSequelizeOrder(sortKey) {
  switch (String(sortKey || '').trim()) {
    case 'title_asc':
      return [['title', 'ASC']]
    case 'title_desc':
      return [['title', 'DESC']]
    case 'year_asc':
      return [['year', 'ASC'], ['title', 'ASC']]
    case 'year_desc':
      return [['year', 'DESC'], ['title', 'ASC']]
    case 'meta_asc':
    case 'metascore_asc':
      return [['metascore', 'ASC'], ['title', 'ASC']]
    case 'meta_desc':
    case 'metascore_desc':
      return [['metascore', 'DESC'], ['title', 'ASC']]
    default:
      return null
  }
}

function canPushPaginationToSql(options) {
  if (options.search || options.genreName) {
    return false
  }

  const sortKey = String(options.sort || '').trim()
  if (!sortKey || sortKey === 'title_asc') {
    return true
  }

  return buildSequelizeOrder(sortKey) !== null
}

async function listHydratedGames(options = {}) {
  const limit = Math.max(1, Math.min(Number(options.limit || 20) || 20, 5000))
  const offset = Math.max(0, Number(options.offset || 0) || 0)
  const where = { type: 'game' }
  const selectableAttributes = await getSelectableGameAttributes(BASE_GAME_ATTRIBUTES)

  if (options.consoleId) {
    where.consoleId = String(options.consoleId)
  }
  if (options.consoleName) {
    where.console = String(options.consoleName)
  }
  if (options.franchiseId) {
    where.franch_id = String(options.franchiseId)
  }
  if (Array.isArray(options.ids) && options.ids.length) {
    where.id = {
      [Op.in]: Array.from(new Set(options.ids.filter(Boolean).map((value) => String(value)))),
    }
  }
  if (options.rarity) {
    where.rarity = String(options.rarity)
  }

  if (canPushPaginationToSql(options)) {
    const sequelizeOrder = buildSequelizeOrder(options.sort) || [['title', 'ASC']]

    const [total, rows] = await Promise.all([
      Game.count({ where }),
      Game.findAll({
        where,
        attributes: selectableAttributes,
        order: sequelizeOrder,
        limit,
        offset,
      }),
    ])

    const items = await hydrateGameRows(rows)

    return {
      items,
      returned: items.length,
      total,
    }
  }

  const rows = await Game.findAll({
    where,
    attributes: selectableAttributes,
  })

  let games = await hydrateGameRows(rows)

  if (options.search) {
    games = games.filter((game) => matchesSearch(game, options.search))
  }

  if (options.genreName) {
    games = games.filter((game) => matchesGenre(game, options.genreName))
  }

  games.sort((left, right) => compareGamesForSort(left, right, options.sort))

  const total = games.length
  const items = games.slice(offset, offset + limit)

  return {
    items,
    returned: items.length,
    total,
  }
}

async function getRandomHydratedGame(options = {}) {
  const where = { type: 'game' }

  if (options.consoleId) {
    where.consoleId = String(options.consoleId)
  }
  if (options.consoleName) {
    where.console = String(options.consoleName)
  }
  if (options.franchiseId) {
    where.franch_id = String(options.franchiseId)
  }
  if (options.rarity) {
    where.rarity = String(options.rarity)
  }

  const needsPostFilter = Boolean(options.search || options.genreName)

  if (!needsPostFilter) {
    const total = await Game.count({ where })
    if (total === 0) {
      return null
    }

    const randomOffset = Math.floor(Math.random() * total)
    const selectableAttributes = await getSelectableGameAttributes(BASE_GAME_ATTRIBUTES)
    const rows = await Game.findAll({
      where,
      attributes: selectableAttributes,
      limit: 1,
      offset: randomOffset,
    })

    if (!rows.length) {
      return null
    }

    const hydrated = await hydrateGameRows(rows)
    return hydrated[0] || null
  }

  const selectableAttributes = await getSelectableGameAttributes(BASE_GAME_ATTRIBUTES)
  const rows = await Game.findAll({
    where,
    attributes: selectableAttributes,
  })

  let games = await hydrateGameRows(rows)

  if (options.search) {
    games = games.filter((game) => matchesSearch(game, options.search))
  }
  if (options.genreName) {
    games = games.filter((game) => matchesGenre(game, options.genreName))
  }

  if (!games.length) {
    return null
  }

  const index = Math.floor(Math.random() * games.length)
  return games[index] || null
}

async function getHydratedGameById(gameId) {
  const selectableAttributes = await getSelectableGameAttributes(BASE_GAME_ATTRIBUTES)
  const record = await Game.findOne({
    where: { id: gameId },
    attributes: selectableAttributes,
  })
  if (!record) {
    return null
  }

  const supplement = await loadCanonicalSupplements(gameId)
  return mergeGameRecord(record.get({ plain: true }), supplement)
}

async function getHydratedGameByLookup(lookup) {
  const needle = String(lookup || '').trim()
  if (!needle) {
    return null
  }

  const selectableAttributes = await getSelectableGameAttributes(BASE_GAME_ATTRIBUTES)

  const record = await Game.findOne({
    where: {
      [Op.or]: [
        { id: needle },
        { slug: needle },
      ],
    },
    attributes: selectableAttributes,
  })

  if (!record) {
    return null
  }

  const supplement = await loadCanonicalSupplements(record.id)
  return mergeGameRecord(record.get({ plain: true }), supplement)
}

async function getHydratedGamesByIds(gameIds = [], { preserveOrder = true } = {}) {
  const ids = Array.from(new Set((gameIds || []).filter(Boolean).map((value) => String(value))))
  if (!ids.length) {
    return []
  }

  const selectableAttributes = await getSelectableGameAttributes(BASE_GAME_ATTRIBUTES)

  const rows = await Game.findAll({
    where: {
      id: {
        [Op.in]: ids,
      },
    },
    attributes: selectableAttributes,
  })

  const hydratedRows = await hydrateGameRows(rows)
  if (!preserveOrder) {
    return hydratedRows
  }

  const byId = new Map(hydratedRows.map((row) => [String(row.id), row]))
  return ids.map((id) => byId.get(String(id))).filter(Boolean)
}

async function listHydratedGamesByConsole(consoleRecord, options = {}) {
  const consoleId = consoleRecord?.id ? String(consoleRecord.id) : null
  const nameVariants = Array.from(new Set((options.nameVariants || [])
    .filter(Boolean)
    .map((value) => String(value))))
  const whereOr = []

  if (consoleId) {
    whereOr.push({ consoleId })
  }
  if (nameVariants.length) {
    whereOr.push({ console: { [Op.in]: nameVariants } })
  }

  if (!whereOr.length) {
    return {
      items: [],
      returned: 0,
      total: 0,
    }
  }

  const selectableAttributes = await getSelectableGameAttributes(BASE_GAME_ATTRIBUTES)

  const rows = await Game.findAll({
    where: {
      type: 'game',
      [Op.or]: whereOr,
    },
    attributes: selectableAttributes,
  })

  let items = await hydrateGameRows(rows)
  items.sort((left, right) => compareGamesForSort(left, right, options.sort))

  const offset = Math.max(0, Number(options.offset || 0) || 0)
  const limit = Math.max(1, Math.min(Number(options.limit || 24) || 24, 5000))
  const total = items.length

  return {
    items: items.slice(offset, offset + limit),
    returned: Math.max(0, Math.min(limit, total - offset)),
    total,
  }
}

async function listHydratedGamesByFranchise(franchiseId, options = {}) {
  return listHydratedGames({
    ...options,
    franchiseId,
  })
}

module.exports = {
  BASE_GAME_ATTRIBUTES,
  getSelectableGameAttributes,
  parseMaybeJson,
  mergeGameRecord,
  hydrateGameRows,
  listHydratedGames,
  getRandomHydratedGame,
  getHydratedGameById,
  getHydratedGameByLookup,
  getHydratedGamesByIds,
  listHydratedGamesByConsole,
  listHydratedGamesByFranchise,
}
