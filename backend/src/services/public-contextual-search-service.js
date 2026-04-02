'use strict'

const { db } = require('../../db_supabase')
const { scoreByQuery, uniqueBy } = require('../helpers/search')
const { normalizeGameRecord } = require('../lib/normalize')
const { listCollectionItems } = require('./public-collection-service')
const { searchDex } = require('./public-search-service')

const GAME_SEARCH_COLUMNS = [
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
].join(',')

function ensureDb() {
  if (!db || typeof db.from !== 'function') {
    throw new Error('Contextual search data source is unavailable')
  }
}

async function fetchGamesByField(field, query, limit) {
  const { data, error } = await db
    .from('games')
    .select(GAME_SEARCH_COLUMNS)
    .eq('type', 'game')
    .ilike(field, `%${query}%`)
    .limit(limit)

  if (error) {
    throw new Error(error.message)
  }

  return data || []
}

async function fetchGamesByYear(year, limit) {
  const { data, error } = await db
    .from('games')
    .select(GAME_SEARCH_COLUMNS)
    .eq('type', 'game')
    .eq('year', year)
    .limit(limit)

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

async function searchMarket(query, limit) {
  if (!query) {
    return []
  }

  ensureDb()

  const fetchLimit = Math.min(Math.max(limit * 3, limit), 120)
  const numericYear = /^\d{4}$/.test(query) ? Number.parseInt(query, 10) : null
  const [titleRows, consoleRows, yearRows] = await Promise.all([
    fetchGamesByField('title', query, fetchLimit),
    fetchGamesByField('console', query, fetchLimit),
    numericYear ? fetchGamesByYear(numericYear, fetchLimit) : Promise.resolve([]),
  ])

  return uniqueBy([
    ...titleRows,
    ...consoleRows,
    ...yearRows,
  ], (item) => item.id)
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

async function fetchMarketSearchPayload(query, limit) {
  const items = await searchMarket(query, limit)

  return {
    ok: true,
    scope: 'market',
    query,
    items,
    count: items.length,
  }
}

async function fetchDexSearchPayload(query, limit) {
  ensureDb()
  const items = await searchDex(query, limit)

  return {
    ok: true,
    scope: 'dex',
    query,
    items,
    count: items.length,
    total: items.length,
  }
}

async function fetchCollectionSearchPayload({ query, listType, consoleName, sort, limit, userId }) {
  const items = await searchCollection({
    query,
    listType,
    consoleName,
    sort,
    limit,
    userId,
  })

  return {
    ok: true,
    scope: 'collection',
    query,
    items,
    count: items.length,
  }
}

module.exports = {
  fetchMarketSearchPayload,
  fetchDexSearchPayload,
  fetchCollectionSearchPayload,
}
