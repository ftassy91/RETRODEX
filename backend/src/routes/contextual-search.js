'use strict'

const { Router } = require('express')

const { db } = require('../../db_supabase')
const { handleAsync, parseLimit } = require('../helpers/query')
const { normalizeGameRecord, parseStoredJson } = require('../lib/normalize')
const { listCollectionItems } = require('../services/public-collection-service')

const router = Router()

function ensureDb() {
  if (!db || typeof db.from !== 'function') {
    throw new Error('Contextual search data source is unavailable')
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

const DEX_RARITY_ORDER = {
  LEGENDARY: 0,
  EPIC: 1,
  RARE: 2,
  UNCOMMON: 3,
  COMMON: 4,
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

function sortByQuery(query, items, valuesSelector) {
  return [...items].sort((left, right) => {
    const diff = scoreByQuery(query, valuesSelector(left)) - scoreByQuery(query, valuesSelector(right))
    if (diff !== 0) {
      return diff
    }
    return String(left.title || left.name || '').localeCompare(String(right.title || right.name || ''), 'fr', {
      sensitivity: 'base',
    })
  })
}

function editorialSignalCount(game) {
  const item = normalizeGameRecord(game)
  return [
    Boolean(item.synopsis || item.summary),
    parseStoredJson(item.dev_anecdotes).length > 0,
    parseStoredJson(item.dev_team).length > 0,
    parseStoredJson(item.cheat_codes).length > 0,
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

async function fetchGamesByField(field, query, limit, extraColumns = '') {
  const columns = [
    'id',
    'title',
    'console',
    'year',
    'genre',
    'developer',
    'metascore',
    'rarity',
    'summary',
    'synopsis',
    'tagline',
    'cover_url',
    'franch_id',
    'dev_anecdotes',
    'dev_team',
    'cheat_codes',
    'loose_price',
    'cib_price',
    'mint_price',
    extraColumns,
  ].filter(Boolean).join(',')

  const { data, error } = await db
    .from('games')
    .select(columns)
    .eq('type', 'game')
    .ilike(field, `%${query}%`)
    .limit(limit)

  if (error) {
    throw new Error(error.message)
  }

  return data || []
}

async function fetchGamesInBatches(limit) {
  const rows = []
  const batchSize = 1000
  let from = 0

  while (rows.length < limit) {
    const { data, error } = await db
      .from('games')
      .select('id,title,console,year,genre,developer,metascore,rarity,summary,synopsis,tagline,cover_url,franch_id,dev_anecdotes,dev_team,cheat_codes,loose_price,cib_price,mint_price')
      .eq('type', 'game')
      .order('title', { ascending: true })
      .range(from, from + batchSize - 1)

    if (error) {
      throw new Error(error.message)
    }

    if (!Array.isArray(data) || !data.length) {
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

async function fetchGameRowsByIds(ids) {
  const uniqueIds = [...new Set((ids || []).filter(Boolean))]
  if (!uniqueIds.length) {
    return []
  }

  const { data, error } = await db
    .from('games')
    .select('id,title,console,year,genre,developer,metascore,rarity,summary,synopsis,tagline,cover_url,franch_id,dev_anecdotes,dev_team,cheat_codes,loose_price,cib_price,mint_price')
    .in('id', uniqueIds)

  if (error) {
    throw new Error(error.message)
  }

  return data || []
}

function serializeMarketResult(game) {
  const item = normalizeGameRecord(game)
  const loose = Number(item.loosePrice || 0)
  const signal = item.rarity === 'LEGENDARY' || item.rarity === 'EPIC'
    ? 'premium'
    : loose >= 100
      ? 'watch'
      : 'baseline'

  return {
    id: item.id,
    title: item.title,
    console: item.console || null,
    year: item.year ?? null,
    rarity: item.rarity || null,
    loosePrice: item.loosePrice,
    cibPrice: item.cibPrice,
    mintPrice: item.mintPrice,
    signal,
  }
}

function serializeDexResult(game) {
  const item = normalizeGameRecord(game)
  const team = parseStoredJson(item.dev_team, []) || []
  const anecdotes = parseStoredJson(item.dev_anecdotes, []) || []
  const codes = parseStoredJson(item.cheat_codes, []) || []

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

async function searchMarket(query, limit) {
  if (!query) {
    return []
  }

  const fetchLimit = Math.min(Math.max(limit * 3, limit), 120)
  const numericYear = /^\d{4}$/.test(query) ? Number.parseInt(query, 10) : null

  const [titleRows, consoleRows, yearRows] = await Promise.all([
    fetchGamesByField('title', query, fetchLimit),
    fetchGamesByField('console', query, fetchLimit),
    numericYear
      ? db
        .from('games')
        .select('id,title,console,year,genre,developer,metascore,rarity,summary,synopsis,tagline,cover_url,franch_id,dev_anecdotes,dev_team,cheat_codes,loose_price,cib_price,mint_price')
        .eq('type', 'game')
        .eq('year', numericYear)
        .limit(fetchLimit)
        .then(({ data, error }) => {
          if (error) throw new Error(error.message)
          return data || []
        })
      : Promise.resolve([]),
  ])

  const rows = uniqueBy([
    ...titleRows,
    ...consoleRows,
    ...yearRows,
  ], (item) => item.id)

  return [...rows]
    .sort((left, right) => {
      const diff = scoreByQuery(query, [left.title, left.console]) - scoreByQuery(query, [right.title, right.console])
      if (diff !== 0) {
        return diff
      }

      return Number(right.loose_price || 0) - Number(left.loose_price || 0)
        || String(left.title || '').localeCompare(String(right.title || ''), 'fr', { sensitivity: 'base' })
    })
    .slice(0, limit)
    .map(serializeMarketResult)
}

async function searchDex(query, limit) {
  if (!query) {
    return (await fetchGamesInBatches(Math.max(limit, 1000)))
      .filter((game) => Boolean(game.synopsis || game.dev_anecdotes || game.dev_team || game.cheat_codes))
      .sort(compareDexPriority)
      .slice(0, limit)
      .map(serializeDexResult)
  }

  const fetchLimit = Math.min(Math.max(limit * 3, limit), 200)
  const [titleRows, consoleRows, synopsisRows, summaryRows, taglineRows] = await Promise.all([
    fetchGamesByField('title', query, fetchLimit),
    fetchGamesByField('console', query, fetchLimit),
    fetchGamesByField('synopsis', query, fetchLimit),
    fetchGamesByField('summary', query, fetchLimit),
    fetchGamesByField('tagline', query, fetchLimit),
  ])

  const rows = uniqueBy([
    ...titleRows,
    ...consoleRows,
    ...synopsisRows,
    ...summaryRows,
    ...taglineRows,
  ], (item) => item.id).filter((game) => Boolean(game.synopsis || game.dev_anecdotes || game.dev_team || game.cheat_codes))

  return sortByQuery(query, rows, (item) => [item.title, item.console, item.tagline, item.summary, item.synopsis])
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

async function searchCollection({ query, listType, consoleName, sort, limit, userId }) {
  const filtered = (await listCollectionItems({ listType, userId }))
    .filter((item) => item.game)
    .filter((item) => {
      const game = item.game
      if (consoleName && game.console !== consoleName) {
        return false
      }

      if (!query) {
        return true
      }

      const haystack = [
        game.title,
        game.console,
        item.notes,
        game.summary,
        game.synopsis,
      ].filter(Boolean).join(' ').toLowerCase()

      return haystack.includes(String(query).toLowerCase())
    })

  const sorted = [...filtered].sort((left, right) => {
    const leftGame = left.game || {}
    const rightGame = right.game || {}
    const titleCompare = String(leftGame.title || '').localeCompare(String(rightGame.title || ''), 'fr', {
      sensitivity: 'base',
    })

    if (sort === 'paid_desc') {
      return Number(right.price_paid || 0) - Number(left.price_paid || 0) || titleCompare
    }

    if (sort === 'paid_asc') {
      return Number(left.price_paid || 0) - Number(right.price_paid || 0) || titleCompare
    }

    if (sort === 'value_desc') {
      return Number(rightGame.loosePrice || 0) - Number(leftGame.loosePrice || 0) || titleCompare
    }

    if (sort === 'title_desc') {
      return String(rightGame.title || '').localeCompare(String(leftGame.title || ''), 'fr', { sensitivity: 'base' })
    }

    return titleCompare
  })

  return sorted.slice(0, limit)
}

router.get('/api/market/search', handleAsync(async (req, res) => {
  ensureDb()
  const q = String(req.query.q || '').trim()
  const limit = parseLimit(req.query.limit, 20, 50)
  const items = await searchMarket(q, limit)

  res.json({
    ok: true,
    scope: 'market',
    query: q,
    items,
    count: items.length,
  })
}))

router.get('/api/dex/search', handleAsync(async (req, res) => {
  ensureDb()
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

router.get('/api/collection/search', handleAsync(async (req, res) => {
  ensureDb()
  const q = String(req.query.q || '').trim()
  const listType = String(req.query.list_type || '').trim().toLowerCase() || null
  const consoleName = String(req.query.console || '').trim() || null
  const sort = String(req.query.sort || 'title_asc').trim()
  const limit = parseLimit(req.query.limit, 200, 1000)
  const userId = String(req.headers['x-retrodex-user-id'] || req.headers['x-user-id'] || req.query.user_id || '').trim() || undefined
  const items = await searchCollection({
    query: q,
    listType,
    consoleName,
    sort,
    limit,
    userId,
  })

  res.json({
    ok: true,
    scope: 'collection',
    query: q,
    items,
    count: items.length,
  })
}))

module.exports = router
