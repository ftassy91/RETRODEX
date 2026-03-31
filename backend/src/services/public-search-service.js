'use strict'

const {
  db,
  queryGames,
  getStats,
} = require('../../db_supabase')
const {
  dedupeSearchResults,
  scoreByQuery,
  uniqueBy,
} = require('../helpers/search')
const { normalizeGameRecord, parseStoredJson } = require('../lib/normalize')
const {
  fetchRowsInBatches,
  isMissingSupabaseRelationError,
} = require('./public-supabase-utils')
const { hydrateGameCovers } = require('./public-game-reader')
const {
  buildPublicationSummary,
  fetchGameVisibilitySignals,
  fetchGameCurationStates,
  attachVisibilityMetadata,
  filterPublishedGames,
  filterPublishedSearchResults,
} = require('./public-publication-service')
const {
  fetchGlobalConsoleResults,
  fetchGlobalFranchiseResults,
} = require('./public-console-service')

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

function buildExcerpt(value, maxLength = 160) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text) return null
  if (text.length <= maxLength) return text

  const sliced = text.slice(0, maxLength)
  const lastSpace = sliced.lastIndexOf(' ')
  const safeSlice = lastSpace > 40 ? sliced.slice(0, lastSpace) : sliced
  return `${safeSlice}...`
}

function normalizeGlobalSearchText(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function tokenizeGlobalSearchText(value) {
  return normalizeGlobalSearchText(value)
    .split(/\s+/)
    .filter(Boolean)
}

function levenshteinDistance(left, right) {
  const a = String(left || '')
  const b = String(right || '')
  if (!a) return b.length
  if (!b) return a.length

  const previous = new Array(b.length + 1)
  const current = new Array(b.length + 1)

  for (let column = 0; column <= b.length; column += 1) {
    previous[column] = column
  }

  for (let row = 1; row <= a.length; row += 1) {
    current[0] = row
    for (let column = 1; column <= b.length; column += 1) {
      const cost = a[row - 1] === b[column - 1] ? 0 : 1
      current[column] = Math.min(
        previous[column] + 1,
        current[column - 1] + 1,
        previous[column - 1] + cost
      )
    }

    for (let column = 0; column <= b.length; column += 1) {
      previous[column] = current[column]
    }
  }

  return previous[b.length]
}

function isNearSearchTokenMatch(token, candidate) {
  const queryToken = String(token || '')
  const candidateToken = String(candidate || '')
  if (!queryToken || !candidateToken) return false
  if (candidateToken === queryToken) return true
  if (candidateToken.startsWith(queryToken) || queryToken.startsWith(candidateToken)) return true

  const maxLength = Math.max(queryToken.length, candidateToken.length)
  if (maxLength < 4) return false

  const maxDistance = maxLength >= 8 ? 2 : 1
  return levenshteinDistance(queryToken, candidateToken) <= maxDistance
}

function collectGlobalSearchTokens(result) {
  return tokenizeGlobalSearchText([
    result?.name,
    result?.title,
    result?.subtitle,
    result?.meta?.console,
    result?.meta?.genre,
    result?.meta?.developer,
    result?.meta?.manufacturer,
    result?.meta?.summary,
    result?.meta?.synopsis,
  ].filter(Boolean).join(' '))
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
  if (leftHasSynopsis !== rightHasSynopsis) return leftHasSynopsis ? -1 : 1

  const signalDiff = editorialSignalCount(right) - editorialSignalCount(left)
  if (signalDiff !== 0) return signalDiff

  const rarityDiff =
    (DEX_RARITY_ORDER[String(left.rarity || '').toUpperCase()] ?? 9)
    - (DEX_RARITY_ORDER[String(right.rarity || '').toUpperCase()] ?? 9)
  if (rarityDiff !== 0) return rarityDiff

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

  if (error) throw new Error(error.message)
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
      if (byQuery !== 0) return byQuery
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
    if (isMissingSupabaseRelationError(error)) return []
    throw new Error(error.message)
  }

  return Array.isArray(data) ? data : []
}

async function fetchSearchFallbackResults(query, type, requestedGamesLimit, requestedFranchisesLimit, numericYear = null) {
  const requests = []

  if (type === 'all' || type === 'game') {
    const titleMatchesPromise = db
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
  const normalizedQuery = normalizeGlobalSearchText(query)
  const title = normalizeGlobalSearchText(result?.name || result?.title || '')
  if (!normalizedQuery || !title) return 0

  if (title === normalizedQuery) return 100
  if (title.startsWith(`${normalizedQuery} `)) return 96
  if (title.startsWith(normalizedQuery)) return 94
  if (title.endsWith(` ${normalizedQuery}`)) return 92
  if (title.includes(` ${normalizedQuery}`)) return 88
  if (title.includes(normalizedQuery)) return 84

  const queryTokens = tokenizeGlobalSearchText(normalizedQuery)
  const haystackTokens = collectGlobalSearchTokens(result)
  const titleTokens = tokenizeGlobalSearchText(title)
  let score = 0

  for (const token of queryTokens) {
    if (titleTokens.includes(token)) {
      score += 36
      continue
    }
    if (titleTokens.some((candidate) => candidate.startsWith(token))) {
      score += 28
      continue
    }
    if (haystackTokens.some((candidate) => candidate.includes(token))) {
      score += 16
      continue
    }
    if (haystackTokens.some((candidate) => isNearSearchTokenMatch(token, candidate))) {
      score += 22
    }
  }

  if (queryTokens.length === 1 && titleTokens.some((candidate) => isNearSearchTokenMatch(queryTokens[0], candidate))) {
    score = Math.max(score, 72)
  }

  return Math.min(score, 99)
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
    curation: {
      status: item.curation?.status || null,
      isPublished: Boolean(item.curation?.isPublished),
      passKey: item.curation?.passKey || null,
    },
    signals: {
      hasMaps: Boolean(item.signals?.hasMaps),
      hasManuals: Boolean(item.signals?.hasManuals),
      hasSprites: Boolean(item.signals?.hasSprites),
      hasEndings: Boolean(item.signals?.hasEndings),
    },
  }
}

async function searchCatalog(query, type, limit, scope) {
  const numericYear = /^\d{4}$/.test(query) ? Number.parseInt(query, 10) : null
  if (!query || query.length < 2) {
    return { ok: true, results: [], items: [], count: 0, query }
  }

  const requestedGamesLimit = type === 'all' ? Math.ceil(limit * 0.7) : limit
  const requestedFranchisesLimit = type === 'all' ? Math.ceil(limit * 0.3) : limit
  let results = []

  try {
    const indexRows = await fetchSearchIndexResults(query, Math.min(Math.max(limit * 2, limit), 200))
    results = filterPublishedSearchResults(indexRows
      .filter((row) => type === 'all' || row._type === type)
      .map((row) => (row._type === 'franchise' ? normalizeSearchFranchiseRow(row) : normalizeSearchGameRow(row))), scope)

    if (!results.length) {
      const fallback = await fetchSearchFallbackResults(
        query,
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
      query,
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
    const diff = scoreResult(b, query) - scoreResult(a, query)
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
  return {
    ok: true,
    results,
    items: results,
    count: results.length,
    query,
  }
}

async function searchGlobal(query, context, limit, scope) {
  if (query.length < 2) {
    return {
      ok: true,
      query,
      context,
      label: SEARCH_CONTEXT_LABELS[context] || SEARCH_CONTEXT_LABELS.all,
      items: [],
      count: 0,
      publication: buildPublicationSummary(scope, await getStats().catch(() => ({}))),
    }
  }

  const [gamesPayload, consoles, franchises, statsBase] = await Promise.all([
    queryGames({
      search: query,
      sort: 'title_asc',
      limit: Math.max(limit * 3, 20),
      offset: 0,
      ids: scope.enabled && scope.ids.length ? scope.ids : null,
    }),
    fetchGlobalConsoleResults(query, limit),
    fetchGlobalFranchiseResults(query, limit),
    getStats().catch(() => ({})),
  ])

  let hydratedGames = await hydrateGameCovers(filterPublishedGames(gamesPayload.items || [], scope))
  if (!hydratedGames.length && query.length >= 4) {
    const fuzzyGamesPayload = await queryGames({
      sort: 'title_asc',
      limit: 5000,
      offset: 0,
      ids: scope.enabled && scope.ids.length ? scope.ids : null,
    })

    hydratedGames = (await hydrateGameCovers(filterPublishedGames(fuzzyGamesPayload.items || [], scope)))
      .map((game) => ({ game, score: scoreResult(createGlobalGameResult(game, context), query) }))
      .filter((entry) => entry.score >= 60)
      .sort((left, right) => right.score - left.score
        || String(left.game?.title || '').localeCompare(String(right.game?.title || ''), 'fr', {
          sensitivity: 'base',
        }))
      .slice(0, Math.max(limit * 3, 20))
      .map((entry) => entry.game)
  }

  const [signalsMap, curationMap] = await Promise.all([
    fetchGameVisibilitySignals(hydratedGames.map((game) => game?.id)),
    fetchGameCurationStates(hydratedGames.map((game) => game?.id), scope),
  ])
  hydratedGames = attachVisibilityMetadata(hydratedGames, signalsMap, curationMap, scope)

  let items = [
    ...hydratedGames.map((game) => createGlobalGameResult(game, context)),
    ...consoles,
    ...franchises,
  ]

  if (context === 'retromarket' || context === 'collection') {
    items = items.filter((item) => item.type === 'game')
  }

  items = items
    .map((item) => ({ ...item, score: scoreResult(item, query) }))
    .sort(compareGlobalResults)
    .slice(0, limit)

  return {
    ok: true,
    query,
    context,
    label: SEARCH_CONTEXT_LABELS[context] || SEARCH_CONTEXT_LABELS.all,
    items,
    count: items.length,
    publication: buildPublicationSummary(scope, statsBase),
  }
}

async function listFranchises() {
  const { data, error } = await db
    .from('franchise_entries')
    .select('slug,name,synopsis,first_game_year,last_game_year,developer,genres,platforms,game_ids,heritage')
    .order('name', { ascending: true })

  if (error) {
    if (isMissingSupabaseRelationError(error)) {
      return { ok: true, items: [], franchises: [], count: 0 }
    }
    throw new Error(error.message)
  }

  const items = (data || []).map((franchise) => toFranchisePayload({
    ...franchise,
    id: franchise.slug,
  }))

  return {
    ok: true,
    items,
    franchises: items,
    count: items.length,
  }
}

async function getFranchiseBySlug(slug) {
  const { data, error } = await db
    .from('franchise_entries')
    .select('slug,name,synopsis,first_game_year,last_game_year,developer,genres,platforms,game_ids,heritage')
    .eq('slug', slug)
    .single()

  if ((error && isMissingSupabaseRelationError(error)) || !data) {
    return null
  }
  if (error) {
    throw new Error(error.message)
  }

  return {
    ok: true,
    franchise: toFranchisePayload({
      ...data,
      id: data.slug,
    }),
  }
}

async function listFranchiseGamesBySlug(slug) {
  let { data: franchise, error: franchiseError } = await db
    .from('franchise_entries')
    .select('slug,game_ids')
    .eq('slug', slug)
    .single()

  if (franchiseError && !isMissingSupabaseRelationError(franchiseError)) {
    throw new Error(franchiseError.message)
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

    if (error) throw new Error(error.message)
    games = data || []
  } else {
    const { data, error } = await db
      .from('games')
      .select('id,title,console,year,genre,rarity,slug,loose_price,cib_price,mint_price')
      .eq('franch_id', slug)
      .order('title', { ascending: true })

    if (error) throw new Error(error.message)
    games = data || []
  }

  return {
    ok: true,
    franchise: franchise?.slug || slug,
    items: games.map((game) => normalizeGameRecord(game)),
    count: games.length,
  }
}

module.exports = {
  SEARCH_CONTEXT_LABELS,
  searchDex,
  searchCatalog,
  searchGlobal,
  listFranchises,
  getFranchiseBySlug,
  listFranchiseGamesBySlug,
}
