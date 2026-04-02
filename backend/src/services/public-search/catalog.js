'use strict'

const { db } = require('../../../db_supabase')
const { dedupeSearchResults } = require('../../helpers/search')
const { isMissingSupabaseRelationError } = require('../public-supabase-utils')
const { filterPublishedSearchResults } = require('../public-publication-service')
const {
  normalizeSearchGameRow,
  normalizeSearchFranchiseRow,
  scoreResult,
} = require('./base')

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

module.exports = {
  searchCatalog,
}
