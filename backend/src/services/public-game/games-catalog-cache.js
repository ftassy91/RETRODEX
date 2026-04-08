'use strict'

/**
 * In-memory catalog cache with stale-while-revalidate.
 * First load blocks until the cache is filled.
 * Subsequent loads return immediately and refresh in the background when stale.
 */

const { mode } = require('../../../db_supabase')
const { fetchRowsInBatches } = require('../public-supabase-utils')
const { normalizeGameRecord } = require('../../lib/normalize')

const TTL_MS = 5 * 60 * 1000

const BASE_COLUMNS = [
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
  'source_confidence',
  'slug',
  'cover_url',
  'loose_price',
  'cib_price',
  'mint_price',
]

const OPTIONAL_SUPABASE_COLUMNS = [
  'price_last_updated',
  'source_names',
]

const state = {
  items: null,
  fetchedAt: 0,
  refreshPromise: null,
}

function getCatalogColumns() {
  return [
    ...BASE_COLUMNS,
    ...(mode === 'supabase' ? OPTIONAL_SUPABASE_COLUMNS : []),
  ].join(',')
}

async function fetchFresh() {
  const rows = await fetchRowsInBatches(
    'games',
    getCatalogColumns(),
    (query) => query.eq('type', 'game'),
    { column: 'title', options: { ascending: true }, batchSize: 1000 }
  )

  return (rows || []).map(normalizeGameRecord)
}

async function refresh() {
  if (state.refreshPromise) {
    return state.refreshPromise
  }

  state.refreshPromise = (async () => {
    try {
      const items = await fetchFresh()
      state.items = items
      state.fetchedAt = Date.now()
      console.info(`[catalog-cache] Refreshed — ${items.length} games`)
    } catch (err) {
      console.error('[catalog-cache] Refresh failed', err)
    } finally {
      state.refreshPromise = null
    }
  })()

  return state.refreshPromise
}

async function getAll() {
  if (!state.items) {
    await refresh()
    return state.items || []
  }

  if (Date.now() - state.fetchedAt > TTL_MS) {
    refresh()
  }

  return state.items
}

async function warmUp() {
  if (state.items) return
  await refresh()
}

function invalidate() {
  state.items = null
  state.fetchedAt = 0
  state.refreshPromise = null
}

module.exports = { getAll, warmUp, invalidate }
