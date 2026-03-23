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

const router = Router()

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

function normalizeGameRecord(game) {
  if (!game || typeof game !== 'object') {
    return game
  }

  return {
    ...game,
    loosePrice: game.loosePrice ?? game.loose_price ?? null,
    cibPrice: game.cibPrice ?? game.cib_price ?? null,
    mintPrice: game.mintPrice ?? game.mint_price ?? null,
  }
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

async function fetchAllSupabaseGames() {
  return fetchRowsInBatches(
    'games',
    'id,title,console,year,genre,developer,metascore,rarity,summary,synopsis,source_confidence,loose_price,cib_price,mint_price',
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

  if (titleMatchesResult.error) throw new Error(titleMatchesResult.error.message)
  if (yearMatchesResult.error) throw new Error(yearMatchesResult.error.message)
  if (franchisesResult.error) throw new Error(franchisesResult.error.message)

  return {
    games: dedupeSearchResults([
      ...((titleMatchesResult.data || []).map(normalizeSearchGameRow)),
      ...((yearMatchesResult.data || []).map(normalizeSearchGameRow)),
    ]),
    franchises: (franchisesResult.data || []).map((row) => normalizeSearchFranchiseRow({
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
    .select('id,title,console,year,rarity,loose_price,cib_price,mint_price')
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
      image: null,
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
  const items = filteredItems.slice(offset, offset + limit).map((item) => (
    includeTrend
      ? { ...item, trend: null }
      : item
  ))

  res.json({
    items,
    returned: items.length,
    total,
  })
}))

router.get('/api/games/:id', handleAsync(async (req, res) => {
  const game = normalizeGameRecord(await getGameById(req.params.id))

  if (!game) {
    return res.status(404).json({ ok: false, error: 'Game not found' })
  }

  return res.json(game)
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
  const { items = [], total = 0 } = await queryGames({
    sort: req.query.sort || 'title_asc',
    console: req.query.console || req.query.platform,
    rarity: req.query.rarity,
    limit,
    offset: Number.parseInt(String(req.query.offset || '0'), 10) || 0,
    search: req.query.q,
  })

  res.json({
    ok: true,
    items: items.map(toItemPayload),
    total,
    limit,
    offset: Number.parseInt(String(req.query.offset || '0'), 10) || 0,
  })
}))

router.get('/api/consoles', handleAsync(async (_req, res) => {
  const games = await fetchAllSupabaseGames()
  const counts = new Map()

  games.forEach((game) => {
    const consoleName = String(game.console || '').trim()
    if (!consoleName) {
      return
    }

    counts.set(consoleName, (counts.get(consoleName) || 0) + 1)
  })

  const items = Array.from(counts.entries())
    .map(([name, gamesCount]) => ({
      id: name,
      name,
      title: name,
      platform: name,
      gamesCount,
    }))
    .sort((left, right) => left.name.localeCompare(right.name, 'fr', { sensitivity: 'base' }))

  res.json({
    ok: true,
    items,
    consoles: items,
    count: items.length,
  })
}))

router.get('/api/search', handleAsync(async (req, res) => {
  const q = String(req.query.q || '').trim()
  const type = ['all', 'game', 'franchise'].includes(String(req.query.type || 'all'))
    ? String(req.query.type || 'all')
    : 'all'
  const limit = parseLimit(req.query.limit, 20, 100)
  const numericYear = /^\d{4}$/.test(q) ? Number.parseInt(q, 10) : null

  if (!q || q.length < 2) {
    return res.json({ ok: true, results: [], count: 0, query: q })
  }

  const requestedGamesLimit = type === 'all' ? Math.ceil(limit * 0.7) : limit
  const requestedFranchisesLimit = type === 'all' ? Math.ceil(limit * 0.3) : limit

  let results = []

  try {
    const indexRows = await fetchSearchIndexResults(q, Math.min(Math.max(limit * 2, limit), 200))
    results = indexRows
      .filter((row) => type === 'all' || row._type === type)
      .map((row) => (row._type === 'franchise'
        ? normalizeSearchFranchiseRow(row)
        : normalizeSearchGameRow(row)))
  } catch (_error) {
    const fallback = await fetchSearchFallbackResults(
      q,
      type,
      requestedGamesLimit,
      requestedFranchisesLimit,
      numericYear
    )
    results = [
      ...fallback.franchises,
      ...dedupeSearchResults(fallback.games).slice(0, requestedGamesLimit),
    ]
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

  if (error || !data) {
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
  const { data: franchise, error: franchiseError } = await db
    .from('franchise_entries')
    .select('slug,game_ids')
    .eq('slug', slug)
    .single()

  if (franchiseError || !franchise) {
    return res.status(404).json({ ok: false, error: 'Franchise not found' })
  }

  const parsedIds = parseStoredJson(franchise.game_ids)
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
  const { count: franchiseCount, error: franchiseError } = await db
    .from('franchise_entries')
    .select('*', { count: 'exact', head: true })

  if (franchiseError) {
    throw new Error(franchiseError.message)
  }

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
