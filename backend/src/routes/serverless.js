'use strict'
// SYNC: B1 - migre le 2026-03-23 - fallback Supabase et recherche par annee alignes avec les tests
// Decision source : SYNC.md Â§ B1
// SYNC: A8 - migre le 2026-03-23 - routeur Supabase dedie au runtime Vercel
// Decision source : SYNC.md § A8

const { Router } = require('express')

const {
  db,
  queryGames,
  getGameById,
  getStats,
} = require('../../db_supabase')
const { handleAsync, parseLimit } = require('../helpers/query')
const { dedupeSearchResults } = require('../helpers/search')
const { buildPriceHistoryPayload } = require('../helpers/priceHistory')
const { getConsoleById, listConsoles, normalizeConsoleKey } = require('../lib/consoles')
const {
  buildProductionPayload,
  buildMediaPayload,
  buildArchivePayload: buildKnowledgeArchivePayload,
  buildEncyclopediaPayload: buildKnowledgeEncyclopediaPayload,
} = require('../helpers/game-knowledge')

const router = Router()
// SYNC: SC-5 - routes Search Core confirmees pour le runtime serverless
// Decision source : SYNC.md § SEARCH RULES / SERVERLESS RULES

const RARITY_DESC_ORDER = {
  LEGENDARY: 0,
  EPIC: 1,
  RARE: 2,
  UNCOMMON: 3,
  COMMON: 4,
}

const RARITY_ASC_ORDER = {
  COMMON: 0,
  UNCOMMON: 1,
  RARE: 2,
  EPIC: 3,
  LEGENDARY: 4,
}

const DEX_RARITY_ORDER = {
  LEGENDARY: 0,
  EPIC: 1,
  RARE: 2,
  UNCOMMON: 3,
  COMMON: 4,
}

const SEARCH_CONTEXT_LABELS = {
  all: 'TOUS',
  retrodex: 'RETRODEX',
  retromarket: 'RETROMARKET',
  collection: 'COLLECTION',
  neoretro: 'NEORETRO',
}

function normalizeGameRecord(game) {
  if (!game || typeof game !== 'object') {
    return game
  }

  return {
    ...game,
    loosePrice: game.loosePrice ?? game.loose_price ?? null,
    cibPrice: game.cibPrice ?? game.cib_price ?? null,
    mintPrice: game.mintPrice ?? game.mint_price ?? null,
    cover_url: game.cover_url ?? game.coverImage ?? game.coverimage ?? null,
    coverImage: game.coverImage ?? game.cover_url ?? game.coverimage ?? null,
  }
}

function getRecordValue(record, fields = []) {
  for (const field of fields) {
    if (record && record[field] != null && record[field] !== '') {
      return record[field]
    }
  }

  return null
}

async function fetchGameMediaMap(gameIds = []) {
  const uniqueIds = Array.from(new Set((gameIds || []).filter(Boolean).map((value) => String(value))))
  if (!uniqueIds.length) {
    return new Map()
  }

  const { data, error } = await db
    .from('media_references')
    .select('entity_id,media_type,url')
    .eq('entity_type', 'game')
    .in('entity_id', uniqueIds)

  if (error) {
    if (isMissingSupabaseRelationError(error)) {
      return new Map()
    }
    throw new Error(error.message)
  }

  const mediaMap = new Map()
  for (const row of data || []) {
    const gameId = String(row.entity_id || '')
    if (!gameId) {
      continue
    }

    if (!mediaMap.has(gameId)) {
      mediaMap.set(gameId, {})
    }

    mediaMap.get(gameId)[String(row.media_type || '').toLowerCase()] = row.url
  }

  return mediaMap
}

async function fetchGameMediaRows(gameId) {
  const query = db
    .from('media_references')
    .select('media_type,url,provider,compliance_status,storage_mode,title,preview_url,asset_subtype,license_status,ui_allowed,healthcheck_status,notes,source_context')
    .eq('entity_type', 'game')
    .eq('entity_id', String(gameId || ''))

  const { data, error } = await query

  if (error) {
    if (isMissingSupabaseRelationError(error)) {
      return []
    }

    const fallback = await db
      .from('media_references')
      .select('media_type,url,provider,compliance_status,storage_mode')
      .eq('entity_type', 'game')
      .eq('entity_id', String(gameId || ''))

    if (fallback.error) {
      if (isMissingSupabaseRelationError(fallback.error)) {
        return []
      }
      throw new Error(fallback.error.message)
    }

    return Array.isArray(fallback.data) ? fallback.data : []
  }

  return Array.isArray(data) ? data : []
}

async function fetchGameEditorialRow(gameId) {
  const query = db
    .from('game_editorial')
    .select('summary,synopsis,lore,gameplay_description,characters,dev_anecdotes,cheat_codes,versions,avg_duration_main,avg_duration_complete,speedrun_wr')
    .eq('game_id', String(gameId || ''))
    .limit(1)
    .single()

  const { data, error } = await query
  if (error) {
    if (isMissingSupabaseRelationError(error)) {
      return null
    }

    const fallback = await db
      .from('game_editorial')
      .select('summary,synopsis,lore,gameplay_description,characters,cheat_codes')
      .eq('game_id', String(gameId || ''))
      .limit(1)
      .single()

    if (fallback.error) {
      if (isMissingSupabaseRelationError(fallback.error)) {
        return null
      }
      throw new Error(fallback.error.message)
    }

    return fallback.data || null
  }

  return data || null
}

async function fetchGamePeopleRows(gameId) {
  const { data, error } = await db
    .from('game_people')
    .select('person_id,role,billing_order,confidence,is_inferred,people(id,name,normalized_name)')
    .eq('game_id', String(gameId || ''))
    .order('billing_order', { ascending: true })

  if (error) {
    if (isMissingSupabaseRelationError(error)) {
      return []
    }
    throw new Error(error.message)
  }

  return (data || []).map((entry) => ({
    personId: entry.person_id,
    role: entry.role,
    billingOrder: entry.billing_order,
    confidence: entry.confidence,
    isInferred: entry.is_inferred,
    name: entry.people?.name || null,
    normalizedName: entry.people?.normalized_name || null,
  })).filter((entry) => entry.name)
}

async function fetchGameCompanyRows(game) {
  const gameId = String(game?.id || '')
  if (!gameId) {
    return []
  }

  const { data, error } = await db
    .from('game_companies')
    .select('company_id,role,confidence')
    .eq('game_id', gameId)

  if (error) {
    if (isMissingSupabaseRelationError(error)) {
      return []
    }
    throw new Error(error.message)
  }

  let bindings = Array.isArray(data) ? data : []

  if (!bindings.length) {
    bindings = [
      { company_id: getRecordValue(game, ['developerId', 'developer_id', 'developerid']), role: 'developer', confidence: 0.7 },
      { company_id: getRecordValue(game, ['publisherId', 'publisher_id', 'publisherid']), role: 'publisher', confidence: 0.7 },
    ].filter((entry) => entry.company_id)
  }

  if (!bindings.length) {
    return []
  }

  const ids = Array.from(new Set(bindings.map((entry) => String(entry.company_id)).filter(Boolean)))
  const companyResult = await db
    .from('companies')
    .select('id,name,country')
    .in('id', ids)

  if (companyResult.error) {
    if (isMissingSupabaseRelationError(companyResult.error)) {
      return []
    }
    throw new Error(companyResult.error.message)
  }

  const companies = new Map((companyResult.data || []).map((entry) => [String(entry.id), entry]))

  return bindings
    .map((binding) => {
      const company = companies.get(String(binding.company_id))
      if (!company) {
        return null
      }

      return {
        id: company.id,
        name: company.name,
        country: company.country || null,
        role: binding.role,
        confidence: binding.confidence,
        source: Array.isArray(data) && data.length ? 'canonical' : 'association_fallback',
      }
    })
    .filter(Boolean)
}

async function fetchGameOstReleases(gameId) {
  const { data, error } = await db
    .from('ost_releases')
    .select('id,ost_id,region_code,release_date,catalog_number,label,confidence,ost!inner(id,game_id,title)')
    .eq('ost.game_id', String(gameId || ''))
    .order('release_date', { ascending: true })
    .order('label', { ascending: true })

  if (error) {
    if (isMissingSupabaseRelationError(error)) {
      const legacy = await db
        .from('osts')
        .select('id,name,format,track_count,release_year,label,region_code,slug,source_confidence')
        .eq('game_id', String(gameId || ''))
        .order('release_year', { ascending: true })
        .order('name', { ascending: true })

      if (legacy.error) {
        if (isMissingSupabaseRelationError(legacy.error)) {
          return []
        }
        throw new Error(legacy.error.message)
      }

      return (legacy.data || []).map((entry) => ({
        id: entry.id,
        name: entry.name,
        format: entry.format || null,
        trackCount: entry.track_count ?? null,
        releaseYear: entry.release_year ?? null,
        label: entry.label || null,
        regionCode: entry.region_code || null,
        slug: entry.slug || null,
        sourceConfidence: entry.source_confidence ?? null,
      }))
    }
    throw new Error(error.message)
  }

  return (data || []).map((entry) => ({
    id: entry.id,
    name: entry.ost?.title || null,
    format: null,
    trackCount: null,
    releaseYear: entry.release_date ? Number(String(entry.release_date).slice(0, 4)) : null,
    label: entry.label || null,
    regionCode: entry.region_code || null,
    slug: null,
    sourceConfidence: entry.confidence ?? null,
  }))
}

async function fetchGameOstRows(gameId) {
  const { data, error } = await db
    .from('ost')
    .select('id,title,confidence,needs_release_enrichment')
    .eq('game_id', String(gameId || ''))

  if (error) {
    if (isMissingSupabaseRelationError(error)) {
      return []
    }
    throw new Error(error.message)
  }

  return Array.isArray(data) ? data : []
}

async function fetchGameOstTracks(gameId) {
  const { data, error } = await db
    .from('ost_tracks')
    .select('id,ost_id,track_title,track_number,composer_person_id,confidence,ost!inner(game_id)')
    .eq('ost.game_id', String(gameId || ''))
    .order('track_number', { ascending: true })
    .order('track_title', { ascending: true })

  if (error) {
    if (isMissingSupabaseRelationError(error)) {
      return []
    }
    throw new Error(error.message)
  }

  return (data || []).map((entry) => ({
    ostId: entry.ost_id,
    title: entry.track_title,
    trackNumber: entry.track_number,
    composerPersonId: entry.composer_person_id || null,
    confidence: entry.confidence ?? null,
  }))
}

async function fetchGameKnowledgeDomains(game) {
  const [companyRows, mediaRows, editorial, peopleRows, ostRows, ostTracks, ostReleases] = await Promise.all([
    fetchGameCompanyRows(game),
    fetchGameMediaRows(game?.id),
    fetchGameEditorialRow(game?.id),
    fetchGamePeopleRows(game?.id),
    fetchGameOstRows(game?.id),
    fetchGameOstTracks(game?.id),
    fetchGameOstReleases(game?.id),
  ])

  const canonicalDevTeam = peopleRows
    .filter((entry) => !String(entry.role || '').toLowerCase().includes('composer'))
    .map((entry) => ({
      personId: entry.personId,
      name: entry.name,
      normalizedName: entry.normalizedName,
      role: entry.role,
      confidence: Number(entry.confidence || 0),
      isInferred: Boolean(entry.isInferred),
    }))

  const canonicalComposers = peopleRows
    .filter((entry) => String(entry.role || '').toLowerCase().includes('composer'))
    .map((entry) => ({
      personId: entry.personId,
      name: entry.name,
      normalizedName: entry.normalizedName,
      role: entry.role,
      confidence: Number(entry.confidence || 0),
      isInferred: Boolean(entry.isInferred),
    }))

  return {
    editorial,
    production: buildProductionPayload({
      game,
      companyRows,
      devTeam: canonicalDevTeam.length ? canonicalDevTeam : (parseStoredJson(game?.dev_team) || []),
    }),
    media: buildMediaPayload({
      game,
      mediaRows,
    }),
    music: {
      composers: canonicalComposers.length ? canonicalComposers : (parseStoredJson(game?.ost_composers) || []),
      tracks: ostTracks.length ? ostTracks : (parseStoredJson(game?.ost_notable_tracks) || []),
      releases: ostReleases,
      ostRows,
    },
  }
}

async function hydrateGameCovers(items = []) {
  const mediaMap = await fetchGameMediaMap(items.map((item) => item?.id))
  return items.map((item) => {
    const normalized = normalizeGameRecord(item)
    const media = mediaMap.get(String(normalized?.id || '')) || {}
    const coverUrl = media.cover || normalized.cover_url || normalized.coverImage || null
    return {
      ...normalized,
      cover_url: coverUrl,
      coverImage: coverUrl,
    }
  })
}

function buildArchivePayload(game, domains = {}) {
  return buildKnowledgeArchivePayload({
    game: normalizeGameRecord(game) || {},
    editorial: domains.editorial,
    production: domains.production,
    media: domains.media,
    music: domains.music,
    ostReleases: domains.music?.releases || [],
  })
}

function buildEncyclopediaPayload(game, domains = {}) {
  return buildKnowledgeEncyclopediaPayload({
    game: normalizeGameRecord(game) || {},
    editorial: domains.editorial,
    production: domains.production,
    music: domains.music,
  })
}

function compareNullableNumbers(left, right, ascending = true) {
  const leftNumber = Number(left)
  const rightNumber = Number(right)
  const leftMissing = !Number.isFinite(leftNumber)
  const rightMissing = !Number.isFinite(rightNumber)

  if (leftMissing && rightMissing) return 0
  if (leftMissing) return 1
  if (rightMissing) return -1

  return ascending ? leftNumber - rightNumber : rightNumber - leftNumber
}

function compareGamesForSort(leftGame, rightGame, sortKey) {
  const left = normalizeGameRecord(leftGame)
  const right = normalizeGameRecord(rightGame)
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
    case 'rarity_desc':
      return (RARITY_DESC_ORDER[String(left.rarity || '').toUpperCase()] ?? 5)
        - (RARITY_DESC_ORDER[String(right.rarity || '').toUpperCase()] ?? 5)
        || compareNullableNumbers(left.loosePrice, right.loosePrice, false)
        || leftTitle.localeCompare(rightTitle, 'fr', { sensitivity: 'base' })
    case 'rarity_asc':
      return (RARITY_ASC_ORDER[String(left.rarity || '').toUpperCase()] ?? 5)
        - (RARITY_ASC_ORDER[String(right.rarity || '').toUpperCase()] ?? 5)
        || leftTitle.localeCompare(rightTitle, 'fr', { sensitivity: 'base' })
    case 'title_asc':
    default:
      return leftTitle.localeCompare(rightTitle, 'fr', { sensitivity: 'base' })
  }
}

async function fetchRowsInBatches(table, columns, configure, orderBy) {
  const rows = []
  let from = 0
  const batchSize = 1000

  while (true) {
    let query = db.from(table).select(columns)
    query = configure(query)

    if (orderBy) {
      query = query.order(orderBy.column, orderBy.options)
    }

    query = query.range(from, from + batchSize - 1)

    const { data, error } = await query
    if (error) {
      throw new Error(error.message)
    }

    if (!Array.isArray(data) || data.length === 0) {
      break
    }

    rows.push(...data)

    if (data.length < batchSize) {
      break
    }

    from += batchSize
  }

  return rows
}

function isMissingSupabaseRelationError(error) {
  const message = String(error?.message || error || '').toLowerCase()
  return (
    message.includes('schema cache') ||
    message.includes('could not find the table') ||
    message.includes('no such table') ||
    message.includes('no such column') ||
    (message.includes('column') && message.includes('does not exist')) ||
    (message.includes('relation') && message.includes('does not exist'))
  )
}

async function fetchAllSupabaseGames() {
  return fetchRowsInBatches(
    'games',
    'id,title,console,year,genre,developer,metascore,rarity,summary,synopsis,source_confidence,slug,cover_url,loose_price,cib_price,mint_price',
    (query) => query.eq('type', 'game'),
    { column: 'title', options: { ascending: true } }
  )
}

async function fetchGamesMap(gameIds) {
  const uniqueIds = [...new Set((gameIds || []).filter(Boolean))]

  if (!uniqueIds.length) {
    return new Map()
  }

  const { data, error } = await db
    .from('games')
    .select('id,title,console,year,rarity,loose_price,cib_price,mint_price')
    .in('id', uniqueIds)

  if (error) {
    throw new Error(error.message)
  }

  return new Map((data || []).map((game) => [game.id, normalizeGameRecord(game)]))
}

async function fetchSeedPriceHistory(gameId) {
  const { data, error } = await db
    .from('price_history')
    .select('price,condition,sale_date')
    .eq('game_id', gameId)
    .order('sale_date', { ascending: true })
    .limit(2000)

  if (error) {
    throw new Error(error.message)
  }

  return data || []
}

function toItemPayload(game) {
  const item = normalizeGameRecord(game)

  return {
    id: item.id,
    title: item.title,
    platform: item.console,
    console: item.console,
    year: item.year,
    genre: item.genre,
    rarity: item.rarity,
    type: item.type || 'game',
    slug: item.slug || null,
    loosePrice: item.loosePrice,
    cibPrice: item.cibPrice,
    mintPrice: item.mintPrice,
    coverImage: item.coverImage || item.cover_url || null,
    cover_url: item.cover_url || item.coverImage || null,
    synopsis: item.synopsis || null,
    summary: item.summary || null,
  }
}

function normalizeSearchGameRow(row) {
  const item = normalizeGameRecord(row)
  return {
    id: item.id,
    title: item.title || item.name || null,
    console: item.console || null,
    year: item.year ?? null,
    rarity: item.rarity || null,
    loosePrice: item.loosePrice ?? null,
    slug: item.slug || null,
    franch_id: item.franch_id || null,
    source_confidence: item.source_confidence ?? null,
    _type: 'game',
  }
}

function normalizeSearchFranchiseRow(row) {
  return {
    id: row.id || row.slug,
    name: row.name,
    slug: row.slug || null,
    first_game: row.first_game ?? row.first_game_year ?? null,
    last_game: row.last_game ?? row.last_game_year ?? null,
    developer: row.developer || null,
    _type: 'franchise',
  }
}

function parseStoredJson(value) {
  if (value == null || value === '') {
    return null
  }

  if (Array.isArray(value) || typeof value === 'object') {
    return value
  }

  if (typeof value !== 'string') {
    return null
  }

  try {
    return JSON.parse(value)
  } catch (_error) {
    return null
  }
}

function buildExcerpt(value, maxLength = 160) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text) {
    return null
  }

  if (text.length <= maxLength) {
    return text
  }

  const sliced = text.slice(0, maxLength)
  const lastSpace = sliced.lastIndexOf(' ')
  const safeSlice = lastSpace > 40 ? sliced.slice(0, lastSpace) : sliced
  return `${safeSlice}…`
}

function uniqueBy(items, keySelector) {
  const seen = new Set()
  const next = []

  for (const item of items) {
    const key = keySelector(item)
    if (!key || seen.has(key)) {
      continue
    }
    seen.add(key)
    next.push(item)
  }

  return next
}

function scoreByQuery(query, values = []) {
  const normalizedQuery = String(query || '').trim().toLowerCase()
  if (!normalizedQuery) {
    return 10
  }

  const haystacks = values
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)

  for (const value of haystacks) {
    if (value === normalizedQuery) return 0
    if (value.startsWith(`${normalizedQuery} `)) return 1
    if (value.startsWith(normalizedQuery)) return 2
    if (value.includes(` ${normalizedQuery}`)) return 3
    if (value.includes(normalizedQuery)) return 4
  }

  return 10
}

function editorialSignalCount(game) {
  const item = normalizeGameRecord(game)
  return [
    Boolean(item.synopsis || item.summary),
    (parseStoredJson(item.dev_anecdotes) || []).length > 0,
    (parseStoredJson(item.dev_team) || []).length > 0,
    (parseStoredJson(item.cheat_codes) || []).length > 0,
    Boolean(item.tagline),
  ].filter(Boolean).length
}

function compareDexPriority(leftGame, rightGame) {
  const left = normalizeGameRecord(leftGame)
  const right = normalizeGameRecord(rightGame)
  const leftHasSynopsis = Boolean(left.synopsis || left.summary)
  const rightHasSynopsis = Boolean(right.synopsis || right.summary)

  if (leftHasSynopsis !== rightHasSynopsis) {
    return leftHasSynopsis ? -1 : 1
  }

  const signalDiff = editorialSignalCount(right) - editorialSignalCount(left)
  if (signalDiff !== 0) {
    return signalDiff
  }

  const rarityDiff =
    (DEX_RARITY_ORDER[String(left.rarity || '').toUpperCase()] ?? 9)
    - (DEX_RARITY_ORDER[String(right.rarity || '').toUpperCase()] ?? 9)
  if (rarityDiff !== 0) {
    return rarityDiff
  }

  return String(left.title || '').localeCompare(String(right.title || ''), 'fr', {
    sensitivity: 'base',
  })
}

async function fetchDexGamesByField(field, query, limit) {
  const { data, error } = await db
    .from('games')
    .select('id,title,console,year,genre,developer,metascore,rarity,summary,synopsis,tagline,cover_url,franch_id,dev_anecdotes,dev_team,cheat_codes,loose_price,cib_price,mint_price')
    .eq('type', 'game')
    .ilike(field, `%${query}%`)
    .limit(limit)

  if (error) {
    throw new Error(error.message)
  }

  return data || []
}

async function fetchDexGamesInBatches(limit) {
  return fetchRowsInBatches(
    'games',
    'id,title,console,year,genre,developer,metascore,rarity,summary,synopsis,tagline,cover_url,franch_id,dev_anecdotes,dev_team,cheat_codes,loose_price,cib_price,mint_price',
    (query) => query.eq('type', 'game'),
    { column: 'title', options: { ascending: true } }
  ).then((rows) => rows.slice(0, limit))
}

function serializeDexResult(game) {
  const item = normalizeGameRecord(game)
  const team = parseStoredJson(item.dev_team) || []
  const anecdotes = parseStoredJson(item.dev_anecdotes) || []
  const codes = parseStoredJson(item.cheat_codes) || []

  return {
    id: item.id,
    title: item.title,
    console: item.console || null,
    year: item.year ?? null,
    rarity: item.rarity || null,
    metascore: item.metascore ?? null,
    tagline: item.tagline || null,
    synopsis: item.synopsis || null,
    summary: item.summary || null,
    dev_anecdotes: item.dev_anecdotes || null,
    dev_team: item.dev_team || null,
    cheat_codes: item.cheat_codes || null,
    synopsisExcerpt: buildExcerpt(item.synopsis || item.summary),
    team,
    anecdotes,
    codes,
    teamCount: team.length,
    anecdotesCount: anecdotes.length,
    codesCount: codes.length,
    franchId: item.franch_id || null,
    cover_url: item.cover_url || null,
  }
}

async function searchDex(query, limit) {
  if (!query) {
    return (await fetchDexGamesInBatches(Math.max(limit, 1000)))
      .filter((game) => Boolean(game.synopsis || game.dev_anecdotes || game.dev_team || game.cheat_codes))
      .sort(compareDexPriority)
      .slice(0, limit)
      .map(serializeDexResult)
  }

  const fetchLimit = Math.min(Math.max(limit * 3, limit), 200)
  const [titleRows, consoleRows, synopsisRows, summaryRows, taglineRows] = await Promise.all([
    fetchDexGamesByField('title', query, fetchLimit),
    fetchDexGamesByField('console', query, fetchLimit),
    fetchDexGamesByField('synopsis', query, fetchLimit),
    fetchDexGamesByField('summary', query, fetchLimit),
    fetchDexGamesByField('tagline', query, fetchLimit),
  ])

  const rows = uniqueBy([
    ...titleRows,
    ...consoleRows,
    ...synopsisRows,
    ...summaryRows,
    ...taglineRows,
  ], (item) => item.id).filter((game) => Boolean(game.synopsis || game.dev_anecdotes || game.dev_team || game.cheat_codes))

  return [...rows]
    .sort((left, right) => {
      const byQuery = scoreByQuery(query, [left.title, left.console, left.tagline, left.summary, left.synopsis])
        - scoreByQuery(query, [right.title, right.console, right.tagline, right.summary, right.synopsis])
      if (byQuery !== 0) {
        return byQuery
      }
      return compareDexPriority(left, right)
    })
    .slice(0, limit)
    .map(serializeDexResult)
}

function toFranchisePayload(franchise) {
  return {
    id: franchise.id || franchise.slug,
    name: franchise.name,
    slug: franchise.slug || null,
    description: franchise.description || franchise.synopsis || null,
    first_game: franchise.first_game ?? franchise.first_game_year ?? null,
    last_game: franchise.last_game ?? franchise.last_game_year ?? null,
    developer: franchise.developer || null,
    publisher: franchise.publisher || null,
    genres: parseStoredJson(franchise.genres),
    platforms: parseStoredJson(franchise.platforms),
    timeline: parseStoredJson(franchise.timeline),
    team_changes: parseStoredJson(franchise.team_changes),
    trivia: parseStoredJson(franchise.trivia),
    legacy: franchise.legacy || franchise.heritage || null,
  }
}

async function fetchSearchIndexResults(query, limit) {
  const { data, error } = await db
    .from('retrodex_search_index')
    .select('*')
    .ilike('name', `%${query}%`)
    .limit(limit)

  if (error) {
    if (isMissingSupabaseRelationError(error)) {
      return []
    }
    throw new Error(error.message)
  }

  return Array.isArray(data) ? data : []
}

async function fetchSearchFallbackResults(
  query,
  type,
  requestedGamesLimit,
  requestedFranchisesLimit,
  numericYear = null
) {
  const requests = []

  if (type === 'all' || type === 'game') {
    const titleMatchesPromise =
      db
        .from('games')
        .select('id,title,console,year,rarity,loose_price,slug,franch_id,source_confidence')
        .eq('type', 'game')
        .ilike('title', `%${query}%`)
        .limit(Math.min(Math.max(requestedGamesLimit * 2, requestedGamesLimit), 200))
    const yearMatchesPromise = Number.isInteger(numericYear)
      ? db
        .from('games')
        .select('id,title,console,year,rarity,loose_price,slug,franch_id,source_confidence')
        .eq('type', 'game')
        .eq('year', numericYear)
        .limit(Math.min(Math.max(requestedGamesLimit * 2, requestedGamesLimit), 200))
      : Promise.resolve({ data: [], error: null })

    requests.push(Promise.all([titleMatchesPromise, yearMatchesPromise]))
  } else {
    requests.push(Promise.resolve([{ data: [], error: null }, { data: [], error: null }]))
  }

  if (type === 'all' || type === 'franchise') {
    requests.push(
      db
        .from('franchise_entries')
        .select('slug,name,first_game_year,last_game_year,developer')
        .ilike('name', `%${query}%`)
        .limit(requestedFranchisesLimit)
    )
  } else {
    requests.push(Promise.resolve({ data: [], error: null }))
  }

  const [gamesResults, franchisesResult] = await Promise.all(requests)
  const [titleMatchesResult, yearMatchesResult] = gamesResults
  const safeFranchisesResult = franchisesResult?.error && isMissingSupabaseRelationError(franchisesResult.error)
    ? { data: [], error: null }
    : franchisesResult

  if (titleMatchesResult.error) throw new Error(titleMatchesResult.error.message)
  if (yearMatchesResult.error) throw new Error(yearMatchesResult.error.message)
  if (safeFranchisesResult.error) throw new Error(safeFranchisesResult.error.message)

  return {
    games: dedupeSearchResults([
      ...((titleMatchesResult.data || []).map(normalizeSearchGameRow)),
      ...((yearMatchesResult.data || []).map(normalizeSearchGameRow)),
    ]),
    franchises: (safeFranchisesResult.data || []).map((row) => normalizeSearchFranchiseRow({
      id: row.slug,
      slug: row.slug,
      name: row.name,
      first_game_year: row.first_game_year,
      last_game_year: row.last_game_year,
      developer: row.developer,
    })),
  }
}

function scoreResult(result, query) {
  const normalizedQuery = query.toLowerCase().trim()
  const name = String(result.name || result.title || '').toLowerCase()
  if (name === normalizedQuery) return 0
  if (name.startsWith(`${normalizedQuery} `)) return 1
  if (name.startsWith(normalizedQuery)) return 2
  if (name.endsWith(` ${normalizedQuery}`)) return 2
  if (name.includes(` ${normalizedQuery}`)) return 3
  if (name.includes(normalizedQuery)) return 4
  return 10
}

function compareGlobalResults(left, right) {
  return (right.score || 0) - (left.score || 0)
    || String(left.title || '').localeCompare(String(right.title || ''), 'fr', {
      sensitivity: 'base',
    })
}

function createGlobalGameResult(game, context = 'all') {
  const item = normalizeGameRecord(game)
  const marketHref = `/stats.html?q=${encodeURIComponent(item.title || '')}`
  const detailHref = `/game-detail.html?id=${encodeURIComponent(item.id || '')}`

  return {
    id: item.id,
    type: 'game',
    title: item.title || '',
    subtitle: [item.console, item.year].filter(Boolean).join(' · '),
    href: context === 'retromarket' ? marketHref : detailHref,
    marketHref,
    detailHref,
    product: context === 'retromarket' ? 'retromarket' : 'retrodex',
    meta: {
      console: item.console || null,
      year: item.year ?? null,
      genre: item.genre || null,
      developer: item.developer || null,
      metascore: item.metascore ?? null,
      rarity: item.rarity || null,
      summary: item.summary || item.synopsis || null,
      synopsis: item.synopsis || null,
      coverImage: item.coverImage || item.cover_url || null,
      loosePrice: item.loosePrice ?? item.loose_price ?? null,
      cibPrice: item.cibPrice ?? item.cib_price ?? null,
      mintPrice: item.mintPrice ?? item.mint_price ?? null,
      qualityScore: Number(item.source_confidence || 0) || null,
    },
  }
}

function createGlobalConsoleResult(consoleItem, gamesCount = 0) {
  const releaseYear = consoleItem.releaseYear ?? consoleItem.release_year ?? null

  return {
    id: `console-${consoleItem.id}`,
    type: 'console',
    title: consoleItem.name || '',
    subtitle: [consoleItem.manufacturer, releaseYear, gamesCount ? `${gamesCount} jeux` : null]
      .filter(Boolean)
      .join(' · '),
    href: `/console-detail.html?id=${encodeURIComponent(consoleItem.id || '')}`,
    marketHref: `/stats.html?q=${encodeURIComponent(consoleItem.name || '')}`,
    product: 'retrodex',
    meta: {
      manufacturer: consoleItem.manufacturer || null,
      console: consoleItem.name || null,
      year: releaseYear,
      gamesCount,
    },
  }
}

function createGlobalFranchiseResult(franchise) {
  return {
    id: `franchise-${franchise.slug || franchise.id}`,
    type: 'franchise',
    title: franchise.name || '',
    subtitle: [franchise.developer, franchise.first_game_year, franchise.last_game_year ? `→ ${franchise.last_game_year}` : null]
      .filter(Boolean)
      .join(' · '),
    href: `/franchises.html?slug=${encodeURIComponent(franchise.slug || franchise.id || '')}`,
    product: 'retrodex',
    meta: {
      developer: franchise.developer || null,
      summary: franchise.synopsis || null,
    },
  }
}

function roundConsoleNumber(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) {
    return null
  }

  return Math.round(number * 100) / 100
}

function averageConsoleValues(values) {
  const numbers = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0)

  if (!numbers.length) {
    return null
  }

  return roundConsoleNumber(numbers.reduce((sum, value) => sum + value, 0) / numbers.length)
}

function toConsoleTier(score) {
  if (score >= 85) return 'Tier A'
  if (score >= 70) return 'Tier B'
  if (score >= 50) return 'Tier C'
  return 'Tier D'
}

function buildStaticConsoleRecord(entry) {
  return {
    id: entry.id,
    slug: entry.id,
    name: entry.name,
    title: entry.name,
    platform: entry.name,
    manufacturer: entry.manufacturer || null,
    releaseYear: entry.release_year ?? null,
    generation: entry.generation || null,
    summary: entry.overview || null,
    mediaType: entry?.technical_specs?.media || null,
    overview: entry.overview || null,
    development: entry.development || null,
    team: entry.team || [],
    technicalSpecs: entry.technical_specs || {},
    legacy: entry.legacy || null,
    anecdotes: entry.anecdotes || [],
    marketNotes: entry.market || null,
    knowledgeEntry: entry,
  }
}

function buildPublishedConsoleRecord(row) {
  const knowledgeEntry = getConsoleById(row.id) || getConsoleById(row.title) || getConsoleById(row.platform)
  const fallback = knowledgeEntry ? buildStaticConsoleRecord(knowledgeEntry) : {}
  const name = row.title || row.platform || fallback.name || row.id
  return {
    ...fallback,
    id: row.id || fallback.id || normalizeConsoleKey(name),
    slug: fallback.slug || normalizeConsoleKey(name),
    name,
    title: name,
    platform: row.platform || name,
    manufacturer: row.manufacturer || fallback.manufacturer || null,
    releaseYear: row.year ?? fallback.releaseYear ?? null,
    mediaType: row.media_type || fallback.mediaType || null,
    knowledgeEntry: knowledgeEntry || fallback.knowledgeEntry || null,
  }
}

function buildConsoleAliases(consoleItem) {
  const values = [
    consoleItem?.id,
    consoleItem?.slug,
    consoleItem?.name,
    consoleItem?.title,
    consoleItem?.platform,
    consoleItem?.knowledgeEntry?.id,
    consoleItem?.knowledgeEntry?.name,
  ]

  return Array.from(new Set(values.map((value) => normalizeConsoleKey(value)).filter(Boolean)))
}

function getConsoleCatalogKey(consoleItem) {
  if (consoleItem?.knowledgeEntry?.id) {
    return consoleItem.knowledgeEntry.id
  }

  return normalizeConsoleKey(consoleItem?.name || consoleItem?.platform || consoleItem?.title || consoleItem?.id)
}

function buildConsoleGamesMap(games = []) {
  const map = new Map()

  games.forEach((game) => {
    const knowledgeEntry = getConsoleById(game.console)
    const key = knowledgeEntry?.id || normalizeConsoleKey(game.console)
    if (!key) {
      return
    }

    if (!map.has(key)) {
      map.set(key, [])
    }

    map.get(key).push(normalizeGameRecord(game))
  })

  return map
}

function buildConsoleMarketPayload(games = []) {
  const pricedGames = games.filter((game) => Number(game.loosePrice || game.cibPrice || game.mintPrice) > 0)
  const legendaryCount = games.filter((game) => String(game.rarity || '').toUpperCase() === 'LEGENDARY').length
  const epicCount = games.filter((game) => String(game.rarity || '').toUpperCase() === 'EPIC').length

  return {
    gamesCount: games.length,
    pricedGames: pricedGames.length,
    priceCoverage: games.length ? Math.round((pricedGames.length / games.length) * 100) : 0,
    avgLoose: averageConsoleValues(games.map((game) => game.loosePrice)),
    avgCib: averageConsoleValues(games.map((game) => game.cibPrice)),
    avgMint: averageConsoleValues(games.map((game) => game.mintPrice)),
    legendaryCount,
    epicCount,
  }
}

function buildConsoleQualityPayload(consoleItem, market) {
  let score = 0

  if (consoleItem?.name) score += 20
  if (consoleItem?.manufacturer) score += 15
  if (consoleItem?.releaseYear) score += 15
  if (consoleItem?.summary) score += 20
  if (consoleItem?.generation || consoleItem?.mediaType) score += 10
  if (market.gamesCount > 0) score += 10
  if (market.pricedGames > 0) score += 10

  return {
    score,
    tier: toConsoleTier(score),
  }
}

function buildConsoleSourcesPayload(consoleItem, market) {
  const sources = [
    {
      id: 'supabase-consoles',
      label: 'Supabase consoles',
      status: 'published',
      type: 'runtime',
    },
  ]

  if (consoleItem?.knowledgeEntry) {
    sources.push({
      id: 'console-registry',
      label: 'Console registry',
      status: 'versioned',
      type: 'knowledge',
    })
  }

  if (market.pricedGames > 0) {
    sources.push({
      id: 'games-market',
      label: 'Games market',
      status: 'derived',
      type: 'market',
    })
  }

  return sources
}

function buildConsoleOverviewPayload(consoleItem, market) {
  const technicalSpecs = consoleItem?.technicalSpecs || {}

  return {
    summary: consoleItem?.overview || consoleItem?.summary || null,
    generation: consoleItem?.generation || null,
    development: consoleItem?.development || null,
    team: consoleItem?.team || [],
    technicalSpecs,
    legacy: consoleItem?.legacy || null,
    anecdotes: consoleItem?.anecdotes || [],
    shortTechnicalIdentity: [
      technicalSpecs.cpu,
      technicalSpecs.gpu,
      technicalSpecs.media || consoleItem?.mediaType,
    ].filter(Boolean).join(' | ') || null,
    marketNotes: consoleItem?.marketNotes || null,
    marketCoverage: market.priceCoverage,
  }
}

function buildConsoleHardwarePayload(consoleItem) {
  const technicalSpecs = consoleItem?.technicalSpecs || {}

  return {
    referenceId: consoleItem?.slug || consoleItem?.id,
    cpu: technicalSpecs.cpu || null,
    gpu: technicalSpecs.gpu || null,
    memory: technicalSpecs.memory || null,
    media: technicalSpecs.media || consoleItem?.mediaType || null,
    notableFeatures: technicalSpecs.notable_features || [],
  }
}

function buildRelatedConsolePayload(catalog = [], consoleItem, limit = 4) {
  return catalog
    .filter((candidate) => candidate.id !== consoleItem.id)
    .filter((candidate) => (
      candidate.manufacturer === consoleItem.manufacturer
      || candidate.generation === consoleItem.generation
    ))
    .sort((left, right) => {
      const byMaker = Number(right.manufacturer === consoleItem.manufacturer) - Number(left.manufacturer === consoleItem.manufacturer)
      if (byMaker !== 0) return byMaker
      return Number(left.releaseYear || 0) - Number(right.releaseYear || 0)
    })
    .slice(0, limit)
    .map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      releaseYear: candidate.releaseYear || null,
    }))
}

function buildNotableGamesPayload(consoleItem, games = []) {
  const names = consoleItem?.legacy?.notable_games || []
  if (!Array.isArray(names) || !names.length) {
    return []
  }

  return names.slice(0, 8).map((title) => {
    const normalized = normalizeConsoleKey(title)
    const matched = games.find((game) => {
      const normalizedTitle = normalizeConsoleKey(game.title)
      return normalizedTitle === normalized
        || normalizedTitle.includes(normalized)
        || normalized.includes(normalizedTitle)
    })

    return {
      title,
      game: matched ? {
        id: matched.id,
        title: matched.title,
        year: matched.year,
      } : null,
    }
  })
}

async function fetchPublishedConsoles() {
  const scope = await fetchPublishedGameScope().catch(() => ({
    enabled: false,
    ids: [],
    set: new Set(),
    consoleIds: [],
  }))
  const fallback = listConsoles().map((entry) => buildStaticConsoleRecord(entry))
  const { data, error } = await db
    .from('consoles')
    .select('id,title,platform,year,manufacturer,media_type')
    .order('platform', { ascending: true })

  if (error) {
    if (isMissingSupabaseRelationError(error)) {
      return fallback
    }

    throw new Error(error.message)
  }

  const published = (data || []).map((row) => buildPublishedConsoleRecord(row))
  const filtered = scope.enabled && scope.consoleIds.length
    ? published.filter((row) => scope.consoleIds.includes(String(row.id || '')))
    : published
  if (filtered.length) {
    return filtered
  }

  if (scope.enabled && scope.consoleIds.length) {
    return fallback.filter((row) => scope.consoleIds.includes(String(row.id || '')))
  }

  return published.length ? published : fallback
}

async function fetchPublishedGameScope() {
  const { data, error } = await db
    .from('console_publication_slots')
    .select('game_id,console_id')
    .eq('is_active', true)

  if (error) {
    if (isMissingSupabaseRelationError(error)) {
      return {
        enabled: false,
        ids: [],
        set: new Set(),
        consoleIds: [],
      }
    }

    throw new Error(error.message)
  }

  const ids = Array.from(new Set((data || []).map((row) => String(row.game_id || '')).filter(Boolean)))
  const consoleIds = Array.from(new Set((data || []).map((row) => String(row.console_id || '')).filter(Boolean)))

  return {
    enabled: true,
    ids,
    set: new Set(ids),
    consoleIds,
  }
}

function filterPublishedGames(games = [], scope = null) {
  if (!scope?.enabled || !scope.ids.length) {
    return games
  }

  return (games || []).filter((game) => scope.set.has(String(game?.id || '')))
}

function filterPublishedSearchResults(results = [], scope = null) {
  if (!scope?.enabled || !scope.ids.length) {
    return results
  }

  return (results || []).filter((item) => item?._type !== 'game' || scope.set.has(String(item.id || '')))
}

function buildConsoleListItem(consoleItem, games = []) {
  const market = buildConsoleMarketPayload(games)
  const quality = buildConsoleQualityPayload(consoleItem, market)

  return {
    id: consoleItem.id,
    slug: consoleItem.slug || null,
    name: consoleItem.name,
    title: consoleItem.name,
    platform: consoleItem.platform || consoleItem.name,
    manufacturer: consoleItem.manufacturer || null,
    releaseYear: consoleItem.releaseYear || null,
    generation: consoleItem.generation || null,
    summary: consoleItem.summary || null,
    gamesCount: market.gamesCount,
    quality,
  }
}

function findConsoleInCatalog(catalog = [], requestedId) {
  const needle = normalizeConsoleKey(requestedId)
  if (!needle) {
    return null
  }

  return catalog.find((consoleItem) => buildConsoleAliases(consoleItem).includes(needle)) || null
}

async function fetchGlobalConsoleResults(query, limit) {
  const normalizedQuery = String(query || '').trim().toLowerCase()
  if (!normalizedQuery) {
    return []
  }

  const [consoles, games, scope] = await Promise.all([
    fetchPublishedConsoles(),
    fetchAllSupabaseGames(),
    fetchPublishedGameScope(),
  ])
  const gamesByConsole = buildConsoleGamesMap(filterPublishedGames(games, scope))

  return consoles
    .filter((consoleItem) => {
      const haystack = [
        consoleItem.id,
        consoleItem.name,
        consoleItem.manufacturer,
        consoleItem.generation,
        consoleItem.summary,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(normalizedQuery)
    })
    .slice(0, Math.max(limit, 10))
    .map((consoleItem) => createGlobalConsoleResult(
      consoleItem,
      (gamesByConsole.get(getConsoleCatalogKey(consoleItem)) || []).length
    ))
}

async function fetchGlobalFranchiseResults(query, limit) {
  const { data, error } = await db
    .from('franchise_entries')
    .select('slug,name,synopsis,first_game_year,last_game_year,developer')
    .ilike('name', `%${query}%`)
    .limit(Math.max(limit, 10))

  if (error) {
    if (isMissingSupabaseRelationError(error)) {
      return []
    }
    throw new Error(error.message)
  }

  return (data || []).map(createGlobalFranchiseResult)
}

function median(values) {
  if (!values.length) {
    return 0
  }

  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2
  }

  return sorted[middle]
}

function normalizeCollectionCondition(value) {
  const raw = String(value ?? '').trim().toLowerCase()
  if (raw === 'cib') return 'cib'
  if (raw === 'mint') return 'mint'
  return 'loose'
}

function normalizeCollectionListType(value) {
  const raw = String(value ?? '').trim().toLowerCase()
  if (raw === 'wanted' || raw === 'for_sale') return raw
  return 'owned'
}

async function fetchCollectionRows() {
  const { data, error } = await db
    .from('collection_items')
    .select('id,game_id,user_session,condition,price_paid,date_acquired,notes,wishlist,created_at,updated_at')
    .eq('user_session', 'local')

  if (error) {
    throw new Error(error.message)
  }

  return data || []
}

async function fetchCollectionItem(gameId) {
  const { data, error } = await db
    .from('collection_items')
    .select('id,game_id,user_session,condition,price_paid,date_acquired,notes,wishlist,created_at,updated_at')
    .eq('user_session', 'local')
    .eq('game_id', gameId)
    .limit(1)

  if (error) {
    throw new Error(error.message)
  }

  return Array.isArray(data) ? (data[0] || null) : null
}

async function fetchCollectionGame(gameId) {
  const { data, error } = await db
    .from('games')
    .select('id,title,console,year,rarity,cover_url,coverImage,summary,synopsis,loose_price,cib_price,mint_price')
    .eq('id', gameId)
    .eq('type', 'game')
    .limit(1)

  if (error) {
    throw new Error(error.message)
  }

  return Array.isArray(data) ? normalizeGameRecord(data[0] || null) : null
}

function serializeCollectionItem(item, game) {
  return {
    id: item?.game_id,
    gameId: item?.game_id,
    condition: String(item?.condition || 'loose').toLowerCase() === 'cib'
      ? 'CIB'
      : String(item?.condition || 'loose').toLowerCase() === 'mint'
        ? 'Mint'
        : 'Loose',
    notes: item?.notes || null,
    list_type: item?.wishlist ? 'wanted' : 'owned',
    price_paid: item?.price_paid ?? null,
    price_threshold: null,
    purchase_date: item?.date_acquired || null,
    personal_note: null,
    addedAt: item?.created_at || null,
    game: game ? {
      id: game.id,
      title: game.title,
      console: game.console,
      platform: game.console,
      year: game.year,
      image: game.coverImage || game.cover_url || null,
      coverImage: game.coverImage || game.cover_url || null,
      rarity: game.rarity,
      loosePrice: game.loosePrice,
      cibPrice: game.cibPrice,
      mintPrice: game.mintPrice,
      synopsis: game.synopsis || null,
      summary: game.summary || null,
    } : null,
  }
}

function buildCollectionInsertPayload(body) {
  const gameId = String(body?.gameId ?? '').trim()
  const listType = normalizeCollectionListType(body?.list_type)
  const rawPricePaid = body?.price_paid
  const pricePaid = rawPricePaid === undefined || rawPricePaid === null || rawPricePaid === ''
    ? null
    : Number(rawPricePaid)
  const purchaseDate = body?.purchase_date ? String(body.purchase_date).trim() : null
  const notes = String(body?.notes ?? body?.personal_note ?? '').trim() || null

  return {
    gameId,
    condition: normalizeCollectionCondition(body?.condition),
    listType,
    pricePaid,
    purchaseDate: purchaseDate || null,
    notes,
  }
}

function filterCollectionRowsByListType(rows, listType) {
  if (!listType) {
    return rows
  }

  if (listType === 'wanted') {
    return rows.filter((row) => Boolean(row.wishlist))
  }

  if (listType === 'owned') {
    return rows.filter((row) => !row.wishlist)
  }

  if (listType === 'for_sale') {
    return []
  }

  return rows
}

function getCollectionValueByCondition(item) {
  const game = item?.game
  if (!game) {
    return 0
  }

  if (item.condition === 'CIB') {
    return Number(game.cibPrice || 0)
  }

  if (item.condition === 'Mint') {
    return Number(game.mintPrice || 0)
  }

  return Number(game.loosePrice || 0)
}

router.get('/api/games', handleAsync(async (req, res) => {
  const limit = parseLimit(req.query.limit, 20, 5000)
  const offset = Math.max(0, Number.parseInt(String(req.query.offset || '0'), 10) || 0)
  const includeTrend = String(req.query.include_trend || '') === '1'
  const { items: rawItems = [] } = await queryGames({
    sort: req.query.sort,
    console: req.query.console,
    rarity: req.query.rarity,
    limit: 5000,
    offset: 0,
    search: req.query.q,
  })

  const filteredItems = rawItems
    .map(normalizeGameRecord)
    .sort((left, right) => compareGamesForSort(left, right, req.query.sort))
  const total = filteredItems.length
  const items = await hydrateGameCovers(filteredItems.slice(offset, offset + limit).map((item) => (
    includeTrend
      ? { ...item, trend: null }
      : item
  )))

  res.json({
    items,
    returned: items.length,
    total,
  })
}))

router.get('/api/games/:id', handleAsync(async (req, res) => {
  const [game] = await hydrateGameCovers([await getGameById(req.params.id)])

  if (!game) {
    return res.status(404).json({ ok: false, error: 'Game not found' })
  }

  return res.json(game)
}))

router.get('/api/games/:id/archive', handleAsync(async (req, res) => {
  const [game] = await hydrateGameCovers([await getGameById(req.params.id)])

  if (!game) {
    return res.status(404).json({ ok: false, error: 'Game not found' })
  }

  const domains = await fetchGameKnowledgeDomains(game)

  return res.json(buildArchivePayload(game, domains))
}))

router.get('/api/games/:id/encyclopedia', handleAsync(async (req, res) => {
  const [game] = await hydrateGameCovers([await getGameById(req.params.id)])

  if (!game) {
    return res.status(404).json({ ok: false, error: 'Game not found' })
  }

  const domains = await fetchGameKnowledgeDomains(game)

  return res.json(buildEncyclopediaPayload(game, domains))
}))

router.get('/api/games/:id/price-history', handleAsync(async (req, res) => {
  const game = normalizeGameRecord(await getGameById(req.params.id))

  if (!game) {
    return res.status(404).json({ ok: false, error: 'Game not found' })
  }

  const seedHistory = await fetchSeedPriceHistory(req.params.id)

  return res.json(buildPriceHistoryPayload(game, {
    reports: [],
    indexEntries: [],
    seedHistory,
  }))
}))

router.get('/api/items', handleAsync(async (req, res) => {
  const limit = parseLimit(req.query.limit, 20, 1000)
  const scope = await fetchPublishedGameScope()
  const { items = [], total = 0 } = await queryGames({
    sort: req.query.sort || 'title_asc',
    console: req.query.console || req.query.platform,
    rarity: req.query.rarity,
    limit,
    offset: Number.parseInt(String(req.query.offset || '0'), 10) || 0,
    search: req.query.q,
    ids: scope.enabled && scope.ids.length ? scope.ids : null,
  })

  const hydratedItems = await hydrateGameCovers(items)

  res.json({
    ok: true,
    items: hydratedItems.map(toItemPayload),
    total,
    limit,
    offset: Number.parseInt(String(req.query.offset || '0'), 10) || 0,
  })
}))

router.get('/api/consoles', handleAsync(async (_req, res) => {
  const [catalog, games, scope] = await Promise.all([
    fetchPublishedConsoles(),
    fetchAllSupabaseGames(),
    fetchPublishedGameScope(),
  ])
  const gamesByConsole = buildConsoleGamesMap(filterPublishedGames(games, scope))
  const knownKeys = new Set()

  const items = catalog
    .map((consoleItem) => {
      const key = getConsoleCatalogKey(consoleItem)
      knownKeys.add(key)
      return buildConsoleListItem(consoleItem, gamesByConsole.get(key) || [])
    })
    .concat(
      Array.from(gamesByConsole.entries())
        .filter(([key]) => !knownKeys.has(key))
        .map(([key, consoleGames]) => buildConsoleListItem({
          id: key,
          slug: key,
          name: consoleGames[0]?.console || key,
          title: consoleGames[0]?.console || key,
          platform: consoleGames[0]?.console || key,
          manufacturer: null,
          releaseYear: null,
          generation: null,
          summary: null,
          knowledgeEntry: null,
          mediaType: null,
        }, consoleGames))
    )
    .sort((left, right) => {
      const byYear = Number(left.releaseYear || 9999) - Number(right.releaseYear || 9999)
      if (byYear !== 0) return byYear
      return String(left.name || '').localeCompare(String(right.name || ''), 'fr', { sensitivity: 'base' })
    })

  res.json({
    ok: true,
    items,
    consoles: items,
    count: items.length,
  })
}))

router.get('/api/consoles/:id', handleAsync(async (req, res) => {
  const [catalog, games, scope] = await Promise.all([
    fetchPublishedConsoles(),
    fetchAllSupabaseGames(),
    fetchPublishedGameScope(),
  ])
  const consoleItem = findConsoleInCatalog(catalog, req.params.id)

  if (!consoleItem) {
    return res.status(404).json({ ok: false, error: 'Console not found' })
  }

  const gamesByConsole = buildConsoleGamesMap(filterPublishedGames(games, scope))
  const consoleGames = await hydrateGameCovers(
    (gamesByConsole.get(getConsoleCatalogKey(consoleItem)) || [])
      .sort((left, right) => compareGamesForSort(left, right, 'year_asc'))
  )
  const market = buildConsoleMarketPayload(consoleGames)
  const quality = buildConsoleQualityPayload(consoleItem, market)
  const overview = buildConsoleOverviewPayload(consoleItem, market)

  res.json({
    ok: true,
    console: {
      id: consoleItem.id,
      slug: consoleItem.slug || null,
      name: consoleItem.name,
      manufacturer: consoleItem.manufacturer || null,
      releaseYear: consoleItem.releaseYear || null,
      gamesCount: market.gamesCount,
    },
    overview,
    market,
    games: consoleGames.map((game) => ({
      id: game.id,
      title: game.title,
      console: game.console,
      year: game.year,
      rarity: game.rarity || null,
      coverImage: game.coverImage || game.cover_url || null,
      cover_url: game.cover_url || null,
      loosePrice: game.loosePrice ?? null,
      cibPrice: game.cibPrice ?? null,
      mintPrice: game.mintPrice ?? null,
      developer: game.developer || null,
      summary: game.summary || null,
    })),
    hardware: buildConsoleHardwarePayload(consoleItem),
    quality,
    sources: buildConsoleSourcesPayload(consoleItem, market),
    relatedConsoles: buildRelatedConsolePayload(catalog, consoleItem),
    notableGames: buildNotableGamesPayload(consoleItem, consoleGames),
  })
}))

router.get('/api/search', handleAsync(async (req, res) => {
  const q = String(req.query.q || '').trim()
  const type = ['all', 'game', 'franchise'].includes(String(req.query.type || 'all'))
    ? String(req.query.type || 'all')
    : 'all'
  const limit = parseLimit(req.query.limit, 20, 100)
  const numericYear = /^\d{4}$/.test(q) ? Number.parseInt(q, 10) : null
  const scope = await fetchPublishedGameScope()

  if (!q || q.length < 2) {
    return res.json({ ok: true, results: [], count: 0, query: q })
  }

  const requestedGamesLimit = type === 'all' ? Math.ceil(limit * 0.7) : limit
  const requestedFranchisesLimit = type === 'all' ? Math.ceil(limit * 0.3) : limit

  let results = []

  try {
    const indexRows = await fetchSearchIndexResults(q, Math.min(Math.max(limit * 2, limit), 200))
      results = filterPublishedSearchResults(indexRows
        .filter((row) => type === 'all' || row._type === type)
        .map((row) => (row._type === 'franchise'
          ? normalizeSearchFranchiseRow(row)
          : normalizeSearchGameRow(row))), scope)
      if (!results.length) {
        const fallback = await fetchSearchFallbackResults(
        q,
        type,
        requestedGamesLimit,
        requestedFranchisesLimit,
        numericYear
      )
        results = filterPublishedSearchResults([
          ...fallback.franchises,
          ...dedupeSearchResults(fallback.games).slice(0, requestedGamesLimit),
        ], scope)
      }
    } catch (_error) {
    const fallback = await fetchSearchFallbackResults(
      q,
      type,
      requestedGamesLimit,
      requestedFranchisesLimit,
      numericYear
    )
      results = filterPublishedSearchResults([
        ...fallback.franchises,
        ...dedupeSearchResults(fallback.games).slice(0, requestedGamesLimit),
      ], scope)
    }

  if (numericYear && (type === 'all' || type === 'game')) {
    results = results.filter((item) => item._type !== 'game' || item.year === numericYear)
  }

  results.sort((a, b) => {
    const diff = scoreResult(a, q) - scoreResult(b, q)
    if (diff !== 0) return diff

    const aName = String(a.name || a.title || '').toLowerCase()
    const bName = String(b.name || b.title || '').toLowerCase()

    if (aName === bName) {
      if (a._type === 'franchise' && b._type !== 'franchise') return -1
      if (b._type === 'franchise' && a._type !== 'franchise') return 1
    }

    if (a._type === 'game' && b._type !== 'game') return -1
    if (b._type === 'game' && a._type !== 'game') return 1
    return 0
  })

  results = results.slice(0, limit)

  res.json({
    ok: true,
    results,
    items: results,
    count: results.length,
    query: q,
  })
}))

router.get('/api/search/global', handleAsync(async (req, res) => {
  const q = String(req.query.q || '').trim()
  const context = String(req.query.context || 'all').trim().toLowerCase()
  const limit = parseLimit(req.query.limit, 20, 60)
  const scope = await fetchPublishedGameScope()

  if (q.length < 2) {
    return res.json({
      ok: true,
      query: q,
      context,
      label: SEARCH_CONTEXT_LABELS[context] || SEARCH_CONTEXT_LABELS.all,
      items: [],
      count: 0,
    })
  }

  const [gamesPayload, consoles, franchises] = await Promise.all([
    queryGames({
      search: q,
      sort: 'title_asc',
      limit: Math.max(limit * 3, 20),
      offset: 0,
      ids: scope.enabled && scope.ids.length ? scope.ids : null,
    }),
    fetchGlobalConsoleResults(q, limit),
    fetchGlobalFranchiseResults(q, limit),
  ])

  const hydratedGames = await hydrateGameCovers(filterPublishedGames(gamesPayload.items || [], scope))

  let items = [
    ...(hydratedGames.map((game) => createGlobalGameResult(game, context))),
    ...consoles,
    ...franchises,
  ]

  if (context === 'retromarket' || context === 'collection') {
    items = items.filter((item) => item.type === 'game')
  }

  items = items
    .map((item) => ({ ...item, score: scoreResult(item, q) }))
    .sort(compareGlobalResults)
    .slice(0, limit)

  res.json({
    ok: true,
    query: q,
    context,
    label: SEARCH_CONTEXT_LABELS[context] || SEARCH_CONTEXT_LABELS.all,
    items,
    count: items.length,
  })
}))

router.get('/api/dex/search', handleAsync(async (req, res) => {
  const q = String(req.query.q || '').trim()
  const limit = parseLimit(req.query.limit, 120, 1000)
  const items = await searchDex(q, limit)

  res.json({
    ok: true,
    scope: 'dex',
    query: q,
    items,
    count: items.length,
    total: items.length,
  })
}))

router.get('/api/franchises', handleAsync(async (_req, res) => {
  const { data, error } = await db
    .from('franchise_entries')
    .select('slug,name,synopsis,first_game_year,last_game_year,developer,genres,platforms,game_ids,heritage')
    .order('name', { ascending: true })

  if (error) {
    if (isMissingSupabaseRelationError(error)) {
      return res.json({
        ok: true,
        items: [],
        franchises: [],
        count: 0,
      })
    }
    throw new Error(error.message)
  }

  const items = (data || []).map((franchise) => toFranchisePayload({
    ...franchise,
    id: franchise.slug,
  }))

  res.json({
    ok: true,
    items,
    franchises: items,
    count: items.length,
  })
}))

router.get('/api/franchises/:slug', handleAsync(async (req, res) => {
  const slug = String(req.params.slug || '').trim()
  const { data, error } = await db
    .from('franchise_entries')
    .select('slug,name,synopsis,first_game_year,last_game_year,developer,genres,platforms,game_ids,heritage')
    .eq('slug', slug)
    .single()

  if ((error && isMissingSupabaseRelationError(error)) || !data) {
    return res.status(404).json({ ok: false, error: 'Franchise not found' })
  }

  if (error) {
    return res.status(404).json({ ok: false, error: 'Franchise not found' })
  }

  return res.json({
    ok: true,
    franchise: toFranchisePayload({
      ...data,
      id: data.slug,
    }),
  })
}))

router.get('/api/franchises/:slug/games', handleAsync(async (req, res) => {
  const slug = String(req.params.slug || '').trim()
  let { data: franchise, error: franchiseError } = await db
    .from('franchise_entries')
    .select('slug,game_ids')
    .eq('slug', slug)
    .single()

  if (franchiseError && !isMissingSupabaseRelationError(franchiseError)) {
    return res.status(404).json({ ok: false, error: 'Franchise not found' })
  }

  if (franchiseError && isMissingSupabaseRelationError(franchiseError)) {
    franchise = null
  }

  const parsedIds = parseStoredJson(franchise?.game_ids)
  let games = []

  if (Array.isArray(parsedIds) && parsedIds.length) {
    const { data, error } = await db
      .from('games')
      .select('id,title,console,year,genre,rarity,slug,loose_price,cib_price,mint_price')
      .in('id', parsedIds)
      .order('title', { ascending: true })

    if (error) {
      throw new Error(error.message)
    }

    games = data || []
  } else {
    const { data, error } = await db
      .from('games')
      .select('id,title,console,year,genre,rarity,slug,loose_price,cib_price,mint_price')
      .eq('type', 'game')
      .eq('franch_id', slug)
      .order('title', { ascending: true })

    if (error) {
      throw new Error(error.message)
    }

    games = data || []
  }

  return res.json({
    ok: true,
    games: games.map((game) => {
      const item = normalizeGameRecord(game)
      return {
        id: item.id,
        title: item.title,
        platform: item.console,
        year: item.year,
        genre: item.genre,
        rarity: item.rarity,
        slug: item.slug || null,
        loosePrice: item.loosePrice,
        cibPrice: item.cibPrice,
        mintPrice: item.mintPrice,
      }
    }),
    count: games.length,
  })
}))

router.get('/api/collection', handleAsync(async (req, res) => {
  const listType = req.query?.list_type ? normalizeCollectionListType(req.query.list_type) : null
  const rows = filterCollectionRowsByListType(await fetchCollectionRows(), listType)
  const gamesMap = await fetchGamesMap(rows.map((row) => row.game_id))
  const items = rows
    .map((row) => serializeCollectionItem(row, gamesMap.get(row.game_id) || null))
    .sort((left, right) => String(left.game?.title || left.gameId || '').localeCompare(String(right.game?.title || right.gameId || '')))

  res.json({
    items,
    total: items.length,
  })
}))

router.post('/api/collection', handleAsync(async (req, res) => {
  const payload = buildCollectionInsertPayload(req.body)

  if (!payload.gameId) {
    return res.status(400).json({ ok: false, error: 'gameId is required' })
  }

  if (payload.pricePaid !== null && (!Number.isFinite(payload.pricePaid) || payload.pricePaid <= 0)) {
    return res.status(400).json({ ok: false, error: 'price_paid must be a positive number' })
  }

  if (payload.purchaseDate && !/^\d{4}-\d{2}-\d{2}$/.test(payload.purchaseDate)) {
    return res.status(400).json({ ok: false, error: 'purchase_date must use YYYY-MM-DD' })
  }

  const game = await fetchCollectionGame(payload.gameId)
  if (!game) {
    return res.status(404).json({ ok: false, error: 'Game not found' })
  }

  const existing = await fetchCollectionItem(payload.gameId)
  if (existing) {
    return res.status(409).json({ ok: false, error: 'Game is already in your collection' })
  }

  const { error } = await db
    .from('collection_items')
    .insert([{
      game_id: payload.gameId,
      user_session: 'local',
      condition: payload.condition,
      price_paid: payload.pricePaid,
      date_acquired: payload.purchaseDate,
      notes: payload.notes,
      wishlist: payload.listType === 'wanted',
    }])

  if (error) {
    throw new Error(error.message)
  }

  const created = await fetchCollectionItem(payload.gameId)

  res.status(201).json({
    ok: true,
    item: serializeCollectionItem(created, game),
  })
}))

router.patch('/api/collection/:id', handleAsync(async (req, res) => {
  const item = await fetchCollectionItem(req.params.id)
  if (!item) {
    return res.status(404).json({ ok: false, error: 'Collection item not found' })
  }

  const nextValues = {}

  if (Object.prototype.hasOwnProperty.call(req.body || {}, 'condition')) {
    nextValues.condition = normalizeCollectionCondition(req.body.condition)
  }

  if (Object.prototype.hasOwnProperty.call(req.body || {}, 'list_type')) {
    nextValues.wishlist = normalizeCollectionListType(req.body.list_type) === 'wanted'
  }

  if (Object.prototype.hasOwnProperty.call(req.body || {}, 'price_paid')) {
    const pricePaid = req.body.price_paid === null || req.body.price_paid === ''
      ? null
      : Number(req.body.price_paid)
    if (pricePaid !== null && (!Number.isFinite(pricePaid) || pricePaid <= 0)) {
      return res.status(400).json({ ok: false, error: 'price_paid must be a positive number' })
    }
    nextValues.price_paid = pricePaid
  }

  if (Object.prototype.hasOwnProperty.call(req.body || {}, 'purchase_date')) {
    const purchaseDate = req.body.purchase_date ? String(req.body.purchase_date).trim() : null
    if (purchaseDate && !/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)) {
      return res.status(400).json({ ok: false, error: 'purchase_date must use YYYY-MM-DD' })
    }
    nextValues.date_acquired = purchaseDate
  }

  if (Object.prototype.hasOwnProperty.call(req.body || {}, 'notes')) {
    nextValues.notes = String(req.body.notes ?? '').trim() || null
  } else if (Object.prototype.hasOwnProperty.call(req.body || {}, 'personal_note')) {
    nextValues.notes = String(req.body.personal_note ?? '').trim() || null
  }

  const { error } = await db
    .from('collection_items')
    .update(nextValues)
    .eq('user_session', 'local')
    .eq('game_id', req.params.id)

  if (error) {
    throw new Error(error.message)
  }

  const updated = await fetchCollectionItem(req.params.id)
  const game = await fetchCollectionGame(req.params.id)

  res.json({
    ok: true,
    item: serializeCollectionItem(updated, game),
  })
}))

router.delete('/api/collection/:id', handleAsync(async (req, res) => {
  const item = await fetchCollectionItem(req.params.id)

  if (!item) {
    return res.status(404).json({ ok: false, error: 'Collection item not found' })
  }

  const { error } = await db
    .from('collection_items')
    .delete()
    .eq('user_session', 'local')
    .eq('game_id', req.params.id)

  if (error) {
    throw new Error(error.message)
  }

  res.json({ ok: true, deletedId: item.game_id })
}))

router.get('/api/collection/stats', handleAsync(async (_req, res) => {
  const rows = filterCollectionRowsByListType(await fetchCollectionRows(), 'owned')
  const gamesMap = await fetchGamesMap(rows.map((row) => row.game_id))
  const items = rows.map((row) => serializeCollectionItem(row, gamesMap.get(row.game_id) || null))

  const byPlatformMap = new Map()
  let totalLoose = 0
  let totalCib = 0
  let totalMint = 0
  let totalPaid = 0

  items.forEach((item) => {
    const game = item.game
    if (!game) {
      return
    }

    const platform = game.console || 'Unknown'
    const resolvedValue = getCollectionValueByCondition(item)

    if (item.condition === 'CIB') totalCib += resolvedValue
    else if (item.condition === 'Mint') totalMint += resolvedValue
    else totalLoose += resolvedValue

    totalPaid += Number(item.price_paid || 0)

    if (!byPlatformMap.has(platform)) {
      byPlatformMap.set(platform, { platform, count: 0, total_loose: 0 })
    }

    const bucket = byPlatformMap.get(platform)
    bucket.count += 1
    bucket.total_loose += resolvedValue
  })

  const by_platform = Array.from(byPlatformMap.values())
    .map((entry) => ({
      platform: entry.platform,
      count: entry.count,
      total_loose: Math.round(entry.total_loose * 100) / 100,
    }))
    .sort((left, right) => left.platform.localeCompare(right.platform))

  const top5 = items
    .slice()
    .sort((left, right) => Number(right.game?.loosePrice || 0) - Number(left.game?.loosePrice || 0))
    .slice(0, 5)
    .map((item) => ({
      id: item.game.id,
      title: item.game.title,
      platform: item.game.console,
      loosePrice: Number(item.game.loosePrice || 0),
      rarity: item.game.rarity,
    }))

  res.json({
    ok: true,
    count: items.length,
    total: items.length,
    total_loose: Math.round(totalLoose * 100) / 100,
    total_cib: Math.round(totalCib * 100) / 100,
    total_mint: Math.round(totalMint * 100) / 100,
    total_paid: Math.round(totalPaid * 100) / 100,
    profit_estimate: Math.round((totalLoose - totalPaid) * 100) / 100,
    confidence: 'mixed',
    by_platform,
    top5,
  })
}))

router.get('/api/stats', handleAsync(async (_req, res) => {
  const statsBase = await getStats().catch(() => ({}))
  const games = await fetchAllSupabaseGames()
  const { count: rawFranchiseCount, error: franchiseError } = await db
    .from('franchise_entries')
    .select('*', { count: 'exact', head: true })

  if (franchiseError && !isMissingSupabaseRelationError(franchiseError)) {
    throw new Error(franchiseError.message)
  }
  const franchiseCount = franchiseError ? 0 : rawFranchiseCount

  const byRarity = {
    LEGENDARY: 0,
    EPIC: 0,
    RARE: 0,
    UNCOMMON: 0,
    COMMON: 0,
  }
  const byPlatformMap = new Map()
  const looseValues = []
  let withSynopsis = 0

  for (const game of games) {
    const rarity = Object.prototype.hasOwnProperty.call(byRarity, game.rarity) ? game.rarity : 'COMMON'
    byRarity[rarity] += 1

    const platform = String(game.console || 'Unknown').trim() || 'Unknown'
    byPlatformMap.set(platform, (byPlatformMap.get(platform) || 0) + 1)

    if (String(game.synopsis || '').trim()) {
      withSynopsis += 1
    }

    const loose = Number(game.loose_price)
    if (Number.isFinite(loose) && loose > 0) {
      looseValues.push(loose)
    }
  }

  const byPlatform = Array.from(byPlatformMap.entries())
    .map(([platform, count]) => ({ platform, count }))
    .sort((left, right) => right.count - left.count || left.platform.localeCompare(right.platform))
    .slice(0, 10)

  const pricedGames = games
    .filter((game) => Number.isFinite(Number(game.loose_price)) && Number(game.loose_price) > 0)
    .sort((left, right) => Number(right.loose_price) - Number(left.loose_price))

  const top5Expensive = pricedGames.slice(0, 5).map((game) => ({
    id: game.id,
    title: game.title,
    platform: game.console,
    loosePrice: Number(game.loose_price),
  }))

  const expensiveGame = pricedGames[0] || null
  const cheapestGame = [...pricedGames].sort((left, right) => Number(left.loose_price) - Number(right.loose_price))[0] || null

  const trustStats = { t1: 0, t3: 0, t4: 0 }
  games.forEach((game) => {
    const confidence = Number(game.source_confidence) || 0
    if (confidence >= 0.6) trustStats.t1 += 1
    else if (confidence >= 0.25) trustStats.t3 += 1
    else trustStats.t4 += 1
  })

  const avgLoose = looseValues.length
    ? looseValues.reduce((sum, value) => sum + value, 0) / looseValues.length
    : 0

  res.json({
    ok: true,
    total_games: Number(statsBase.total_games) || games.length,
    total_platforms: byPlatformMap.size,
    priced_games: pricedGames.length,
    by_rarity: byRarity,
    by_platform: byPlatform,
    price_stats: {
      avg_loose: Math.round(avgLoose * 100) / 100,
      max_loose: expensiveGame ? Number(expensiveGame.loose_price) : 0,
      min_loose: cheapestGame ? Number(cheapestGame.loose_price) : 0,
      median_loose: Math.round(median(looseValues) * 100) / 100,
    },
    trust_stats: trustStats,
    encyclopedia_stats: {
      with_synopsis: withSynopsis,
      total_franchises: franchiseCount || 0,
    },
    top5_expensive: top5Expensive,
    expensive_game: expensiveGame ? {
      id: expensiveGame.id,
      title: expensiveGame.title,
      platform: expensiveGame.console,
      loosePrice: Number(expensiveGame.loose_price),
      year: expensiveGame.year,
    } : null,
    cheapest_game: cheapestGame ? {
      id: cheapestGame.id,
      title: cheapestGame.title,
      platform: cheapestGame.console,
      loosePrice: Number(cheapestGame.loose_price),
      year: cheapestGame.year,
    } : null,
  })
}))

module.exports = router
