'use strict'

const { createHash } = require('crypto')
const { LRUCache } = require('../../lib/lru-cache')
const { parseLimit } = require('../../helpers/query')
const {
  hydrateGameCovers,
  toItemPayload,
  fetchAllSupabaseGames,
} = require('../public-game-reader')
const {
  buildPublicationSummary,
  fetchGameVisibilitySignals,
  fetchGameCurationStates,
  attachVisibilityMetadata,
} = require('../public-publication-service')
const { compareGamesForSort } = require('../../lib/normalize')
const { fetchRowsInBatches, uniqueStrings } = require('../public-supabase-utils')

const publishedListingScopeCache = new LRUCache(1, 60 * 1000)
const itemsPayloadCache = new LRUCache(300, 120 * 1000)

function normalizeStringParam(value) {
  return String(value || '').trim()
}

function normalizeIntParam(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function buildItemsPayloadCacheKey(scopeVersion, params) {
  return [
    'items:v3',
    `scope=${scopeVersion || 'none'}`,
    `q=${params.q}`,
    `console=${params.console}`,
    `platform=${params.platform}`,
    `sort=${params.sort}`,
    `rarity=${params.rarity}`,
    `genre=${params.genre}`,
    `limit=${params.limit}`,
    `offset=${params.offset}`,
    `yearMin=${params.yearMin ?? ''}`,
    `yearMax=${params.yearMax ?? ''}`,
  ].join(':')
}

function buildPublishedListingScopeVersion(rows = []) {
  if (!Array.isArray(rows) || !rows.length) {
    return 'empty'
  }

  const digest = createHash('sha1')
  rows.forEach((row) => {
    digest.update(String(row.game_id || ''))
    digest.update(':')
    digest.update(String(row.pass_key || ''))
    digest.update('|')
  })

  return digest.digest('hex').slice(0, 16)
}

async function fetchPublishedListingScope() {
  const cached = publishedListingScopeCache.get('published-listing-scope')
  if (cached) {
    return cached
  }

  const rows = await fetchRowsInBatches(
    'game_curation_states',
    'game_id,pass_key',
    (query) => query.eq('status', 'published'),
    { column: 'game_id', options: { ascending: true }, batchSize: 2000 }
  )

  const ids = uniqueStrings(rows.map((row) => row.game_id))
  const scope = {
    enabled: true,
    ids,
    set: new Set(ids),
    passKey: String(rows[0]?.pass_key || '').trim() || 'pass1-premium-encyclopedic',
    version: buildPublishedListingScopeVersion(rows),
  }
  publishedListingScopeCache.set('published-listing-scope', scope)
  return scope
}

function filterCatalogItems(items = [], params, scope) {
  const search = String(params.q || '').toLowerCase()
  const consoleName = params.console || params.platform
  const rarity = params.rarity
  const genre = params.genre
  const yearMin = Number.isFinite(params.yearMin) ? params.yearMin : null
  const yearMax = Number.isFinite(params.yearMax) ? params.yearMax : null

  return (items || [])
    .filter((item) => scope.set.has(String(item?.id || '')))
    .filter((item) => {
      if (consoleName && String(item.console || '') !== consoleName) return false
      if (rarity && String(item.rarity || '') !== rarity) return false
      if (genre && String(item.genre || '') !== genre) return false
      if (search && !String(item.title || '').toLowerCase().includes(search)) return false

      const year = Number(item.year)
      if (yearMin !== null && (!Number.isFinite(year) || year < yearMin)) return false
      if (yearMax !== null && (!Number.isFinite(year) || year > yearMax)) return false

      return true
    })
    .sort((left, right) => compareGamesForSort(left, right, params.sort))
}

async function fetchItemsPayloadResult(query = {}) {
  const limit = parseLimit(query.limit, 20, 1000)
  const offset = normalizeIntParam(query.offset, 0) || 0
  const yearMin = normalizeIntParam(query.yearMin, null)
  const yearMax = normalizeIntParam(query.yearMax, null)
  const normalizedParams = {
    q: normalizeStringParam(query.q),
    console: normalizeStringParam(query.console),
    platform: normalizeStringParam(query.platform),
    sort: normalizeStringParam(query.sort) || 'title_asc',
    rarity: normalizeStringParam(query.rarity),
    genre: normalizeStringParam(query.genre),
    limit,
    offset,
    yearMin,
    yearMax,
  }
  const scope = await fetchPublishedListingScope()
  const cacheKey = buildItemsPayloadCacheKey(scope.version, normalizedParams)
  const cachedPayload = itemsPayloadCache.get(cacheKey)
  if (cachedPayload) {
    return { payload: cachedPayload, cacheStatus: 'hit' }
  }

  const allGames = await fetchAllSupabaseGames()
  const publishedCatalog = filterCatalogItems(allGames, normalizedParams, scope)
  const total = publishedCatalog.length
  const items = publishedCatalog.slice(offset, offset + limit)
  const publishedConsoleIds = uniqueStrings(
    allGames
      .filter((item) => scope.set.has(String(item?.id || '')))
      .map((item) => item.console)
  )

  const hydratedItems = await hydrateGameCovers(items)
  const [signalsMap, curationMap] = await Promise.all([
    fetchGameVisibilitySignals(hydratedItems.map((item) => item?.id)),
    fetchGameCurationStates(hydratedItems.map((item) => item?.id), scope),
  ])
  const visibleItems = attachVisibilityMetadata(hydratedItems, signalsMap, curationMap, scope)

  const payload = {
    ok: true,
    items: visibleItems.map(toItemPayload),
    total,
    limit,
    offset,
    publication: buildPublicationSummary(
      { ...scope, consoleIds: publishedConsoleIds },
      { total_games: allGames.length }
    ),
  }

  itemsPayloadCache.set(cacheKey, payload)
  return { payload, cacheStatus: 'miss' }
}

async function fetchItemsPayload(query = {}) {
  const { payload } = await fetchItemsPayloadResult(query)
  return payload
}

module.exports = {
  fetchItemsPayload,
  fetchItemsPayloadResult,
}
