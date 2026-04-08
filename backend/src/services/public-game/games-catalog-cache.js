'use strict'

/**
 * In-memory catalog cache — stale-while-revalidate.
 *
 * Cold start: first call blocks until Supabase responds (~500ms–1s).
 * All subsequent calls return from memory immediately (<1ms).
 * When TTL expires, stale data is returned immediately while a background
 * refresh updates the cache — no request ever waits for a refresh.
 */

const { mode } = require('../../../db_supabase')
const { fetchRowsInBatches } = require('../public-supabase-utils')
const { normalizeGameRecord } = require('../../lib/normalize')

const TTL_MS = 5 * 60 * 1000 // 5 minutes

const state = {
  items: null,       // normalized game records; null until first load
  fetchedAt: 0,
  refreshing: false,
}

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

async function fetchFresh() {
  const rows = await fetchRowsInBatches(
    'games',
    [...BASE_COLUMNS, ...(mode === 'supabase' ? OPTIONAL_SUPABASE_COLUMNS : [])].join(','),
    (query) => query.eq('type', 'game'),
    { column: 'title', options: { ascending: true }, batchSize: 1000 }
  )

  return (rows || []).map(normalizeGameRecord)
}

async function refresh() {
  if (state.refreshing) return
  state.refreshing = true
  try {
    const items = await fetchFresh()
    state.items = items
    state.fetchedAt = Date.now()
    console.info(`[catalog-cache] Refreshed — ${items.length} games`)
  } catch (err) {
    console.error('[catalog-cache] Refresh failed', err)
  } finally {
    state.refreshing = false
  }
}

/**
 * Returns all cached game records.
 * - First call blocks until loaded.
 * - Subsequent calls return immediately; background refresh when stale.
 */
async function getAll() {
  if (!state.items) {
    await refresh()
    return state.items || []
  }

  if (Date.now() - state.fetchedAt > TTL_MS) {
    refresh() // fire-and-forget — stale data returned immediately
  }

  return state.items
}

/**
 * Call once on server start to pre-populate the cache before the first
 * request arrives, eliminating the cold-start penalty entirely.
 */
async function warmUp() {
  if (state.items) return
  await refresh()
}

/** Force-expire the cache (e.g. after a data write operation). */
function invalidate() {
  state.items = null
  state.fetchedAt = 0
}

module.exports = { getAll, warmUp, invalidate }
