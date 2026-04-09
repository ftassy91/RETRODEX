'use strict'

const { db, mode } = require('../../../db_supabase')

const USE_SUPABASE = mode === 'supabase'
const KNOWN_CONDITIONS = new Set(['Loose', 'CIB', 'Mint'])

function getSqlite() {
  return mode === 'sqlite' ? db?._sqlite : null
}

function isMissingPriceHistoryTable(error) {
  const message = String(error?.message || '').toLowerCase()
  const touchesPriceRuntime = ['price_history', 'price_observations'].some((token) => message.includes(token))
  return touchesPriceRuntime && (
    message.includes('does not exist')
    || message.includes('relation')
    || message.includes('schema cache')
  )
}

function isPriceSchemaCompatibilityError(error) {
  const message = String(error?.message || '').toLowerCase()
  const touchesPriceRuntime = ['price_history', 'price_observations'].some((token) => message.includes(token))
  if (!touchesPriceRuntime) {
    return false
  }

  return (
    message.includes('schema cache')
    || message.includes('does not exist')
    || message.includes('relation')
    || message.includes('column')
  )
}

function roundPrice(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) {
    return null
  }

  return Math.round(number * 100) / 100
}

function getCutoffStr(months) {
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - months)
  return cutoff.toISOString().slice(0, 10)
}

function sqliteTableExists(target) {
  const sqlite = getSqlite()
  if (!sqlite) {
    return false
  }

  const rows = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type IN ('table','view') AND lower(name) = lower(?) LIMIT 1")
    .all(String(target || ''))

  return Array.isArray(rows) && rows.length > 0
}

function sqliteColumnExists(tableName, columnName) {
  const sqlite = getSqlite()
  if (!sqlite || !sqliteTableExists(tableName)) {
    return false
  }

  const rows = sqlite.prepare(`PRAGMA table_info(${String(tableName)})`).all()
  return rows.some((row) => String(row?.name || '').toLowerCase() === String(columnName || '').toLowerCase())
}

function normalizeCondition(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'complete' || normalized === 'complete in box' || normalized === 'cib') {
    return 'CIB'
  }
  if (normalized === 'sealed' || normalized === 'new' || normalized === 'mint') {
    return 'Mint'
  }
  if (normalized === 'loose') {
    return 'Loose'
  }
  return 'Loose'
}

function normalizeSourceName(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) {
    return null
  }

  const sourceMap = {
    ebay: 'eBay',
    'pricecharting': 'PriceCharting',
    vgpc: 'VGPC',
    moby: 'MobyGames',
    mobygames: 'MobyGames',
    igdb: 'IGDB',
  }

  return sourceMap[normalized] || String(value).trim()
}

function normalizeTimestamp(value) {
  if (!value) {
    return null
  }

  const text = String(value).trim()
  if (!text) {
    return null
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text
  }

  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) {
    return text
  }

  return parsed.toISOString()
}

function computeFreshnessDays(value) {
  const timestamp = normalizeTimestamp(value)
  if (!timestamp) {
    return null
  }

  const parsed = new Date(timestamp)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return Math.max(0, Math.floor((Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24)))
}

function computeConfidencePct(row) {
  const confidenceCandidates = [
    row?.confidence_pct,
    row?.confidence_score,
    row?.source_confidence,
    row?.confidence,
  ]

  for (const candidate of confidenceCandidates) {
    const numeric = Number(candidate)
    if (!Number.isFinite(numeric)) {
      continue
    }

    if (numeric <= 1) {
      return Math.max(0, Math.min(100, Math.round(numeric * 100)))
    }

    return Math.max(0, Math.min(100, Math.round(numeric)))
  }

  if (row?.is_verified === true || row?.is_verified === 1) {
    return 90
  }

  return null
}

function parseRawPayload(rawPayload) {
  if (!rawPayload) {
    return null
  }

  if (typeof rawPayload === 'object') {
    return rawPayload
  }

  try {
    return JSON.parse(String(rawPayload))
  } catch (_error) {
    return null
  }
}

function normalizePriceRow(row) {
  const rawPayload = parseRawPayload(row?.raw_payload)
  const saleDate = normalizeTimestamp(row?.sold_at || row?.sale_date || row?.observed_at || row?.created_at)
  const createdAt = normalizeTimestamp(row?.created_at || row?.observed_at || row?.sale_date)
  const source = normalizeSourceName(row?.source_name || row?.source)
  const listingReference = row?.listing_reference || rawPayload?.listing_reference || rawPayload?.legacyListingReference || null
  const listingTitle = row?.title_raw || row?.listing_title || row?.listing_reference || rawPayload?.listing_title || rawPayload?.legacyListingTitle || null
  const freshnessDays = computeFreshnessDays(saleDate)
  const confidencePct = computeConfidencePct(row)

  return {
    ...row,
    price: roundPrice(row?.price),
    condition: normalizeCondition(row?.condition),
    sale_date: saleDate,
    observed_at: normalizeTimestamp(row?.observed_at || row?.sale_date || row?.created_at),
    created_at: createdAt,
    source,
    source_name: source,
    listing_reference: listingReference,
    listing_title: listingTitle,
    confidence_pct: confidencePct,
    freshness_days: freshnessDays,
    is_verified: row?.is_verified == null ? null : Boolean(row.is_verified),
  }
}

async function runSupabaseFallbackQueries(queryFactories) {
  let lastCompatibilityError = null

  for (const queryFactory of queryFactories) {
    const { data, error } = await queryFactory()
    if (!error) {
      return data || []
    }

    if (!isPriceSchemaCompatibilityError(error)) {
      throw new Error(error.message)
    }

    lastCompatibilityError = error
  }

  if (lastCompatibilityError) {
    throw new Error(lastCompatibilityError.message)
  }

  return []
}

async function queryLocalPriceHistoryRows(gameId, cutoffStr, limit = 2000) {
  const sqlite = getSqlite()
  if (!sqlite) {
    return []
  }

  if (sqliteTableExists('price_observations')) {
    const verifiedFilter = sqliteColumnExists('price_observations', 'is_verified')
      ? ' AND (is_verified = 1 OR LOWER(source_name) = \'ebay\')'
      : ''
    return sqlite.prepare(`
      SELECT price,
             LOWER(condition) AS condition,
             observed_at AS sale_date,
             observed_at,
             source_name,
             confidence,
             is_verified
      FROM price_observations
      WHERE game_id = ?
        AND observed_at >= ?${verifiedFilter}
      ORDER BY observed_at DESC
      LIMIT ?
    `).all(gameId, cutoffStr, limit).map(normalizePriceRow)
  }

  if (!sqliteTableExists('price_history')) {
    return []
  }

  const realSaleFilter = sqliteColumnExists('price_history', 'is_real_sale')
    ? ' AND is_real_sale = 1'
    : ' AND LOWER(source) = \'ebay\''
  return sqlite.prepare(`
    SELECT price,
           condition,
           sale_date,
           source
    FROM price_history
    WHERE game_id = ?
      AND sale_date >= ?${realSaleFilter}
    ORDER BY sale_date DESC
    LIMIT ?
  `).all(gameId, cutoffStr, limit).map(normalizePriceRow)
}

async function queryLocalPriceSales(gameId, condition = null, limit = 200) {
  const sqlite = getSqlite()
  if (!sqlite) {
    return []
  }

  const params = [gameId]
  let conditionClause = ''
  if (condition) {
    conditionClause = ' AND LOWER(condition) = ?'
    params.push(String(condition).toLowerCase())
  }

  if (sqliteTableExists('price_observations')) {
    const verifiedFilter = sqliteColumnExists('price_observations', 'is_verified')
      ? ' AND (is_verified = 1 OR LOWER(source_name) = \'ebay\')'
      : ''
    return sqlite.prepare(`
      SELECT id,
             game_id,
             price,
             LOWER(condition) AS condition,
             observed_at AS sale_date,
             observed_at,
             source_name AS source,
             listing_url,
             listing_reference,
             observed_at AS created_at,
             confidence,
             is_verified,
             raw_payload
      FROM price_observations
      WHERE game_id = ?${conditionClause}${verifiedFilter}
      ORDER BY observed_at DESC
      LIMIT ?
    `).all(...params, limit).map(normalizePriceRow)
  }

  if (!sqliteTableExists('price_history')) {
    return []
  }

  const realSaleFilter = sqliteColumnExists('price_history', 'is_real_sale')
    ? ' AND is_real_sale = 1'
    : ' AND LOWER(source) = \'ebay\''
  return sqlite.prepare(`
    SELECT id, game_id, price, condition, sale_date, source, listing_url, listing_title, created_at
    FROM price_history
    WHERE game_id = ?${conditionClause}${realSaleFilter}
    ORDER BY sale_date DESC
    LIMIT ?
  `).all(...params, limit).map(normalizePriceRow)
}

async function queryLocalRecentSales(limit) {
  const sqlite = getSqlite()
  if (!sqlite) {
    return []
  }

  if (sqliteTableExists('price_observations')) {
    const verifiedFilter = sqliteColumnExists('price_observations', 'is_verified')
      ? 'WHERE is_verified = 1 OR LOWER(source_name) = \'ebay\''
      : ''
    return sqlite.prepare(`
      SELECT id,
             game_id,
             price,
             LOWER(condition) AS condition,
             observed_at AS sale_date,
             observed_at,
             source_name AS source,
             listing_url,
             listing_reference,
             observed_at AS created_at,
             confidence,
             is_verified,
             raw_payload
      FROM price_observations
      ${verifiedFilter}
      ORDER BY observed_at DESC
      LIMIT ?
    `).all(limit).map(normalizePriceRow)
  }

  if (!sqliteTableExists('price_history')) {
    return []
  }

  const realSaleFilter = sqliteColumnExists('price_history', 'is_real_sale')
    ? 'WHERE is_real_sale = 1'
    : 'WHERE LOWER(source) = \'ebay\''
  return sqlite.prepare(`
    SELECT id, game_id, price, condition, sale_date, source, listing_url, listing_title, created_at
    FROM price_history
    ${realSaleFilter}
    ORDER BY sale_date DESC
    LIMIT ?
  `).all(limit).map(normalizePriceRow)
}

async function fetchGamesMap(gameIds) {
  const uniqueIds = Array.from(new Set((gameIds || []).filter(Boolean)))
  if (!uniqueIds.length) {
    return new Map()
  }

  const { data, error } = await db
    .from('games')
    .select('id,title,console,rarity')
    .in('id', uniqueIds)

  if (error) {
    throw new Error(error.message)
  }

  return new Map((data || []).map((game) => [game.id, game]))
}

async function fetchRecentSales(limit) {
  if (USE_SUPABASE) {
    const rows = await runSupabaseFallbackQueries([
      () => db
        .from('price_history')
        .select('id,game_id,price,condition,sale_date,source,listing_url,listing_title,created_at,is_real_sale,sale_type,listing_reference,sold_at,currency,price_original,price_eur,title_raw,condition_normalized,normalized_region,country_code,match_confidence,source_confidence,raw_payload')
        .eq('is_real_sale', true)
        .order('sold_at', { ascending: false })
        .limit(limit),
      () => db
        .from('price_observations')
        .select('id,game_id,price,condition,observed_at,source_name,listing_url,listing_reference,created_at,confidence,is_verified,raw_payload')
        .eq('is_verified', true)
        .order('observed_at', { ascending: false })
        .limit(limit),
      () => db
        .from('price_observations')
        .select('id,game_id,price,condition,observed_at,source_name,listing_url,listing_reference,created_at')
        .eq('is_verified', true)
        .order('observed_at', { ascending: false })
        .limit(limit),
      () => db
        .from('price_observations')
        .select('id,game_id,price,condition,observed_at,source_name')
        .eq('is_verified', true)
        .order('observed_at', { ascending: false })
        .limit(limit),
      () => db
        .from('price_history')
        .select('id,game_id,price,condition,sale_date,source,listing_url,listing_title,created_at')
        .eq('source', 'ebay')
        .order('sale_date', { ascending: false })
        .limit(limit),
      () => db
        .from('price_history')
        .select('id,game_id,price,condition,sale_date,source')
        .eq('source', 'ebay')
        .order('sale_date', { ascending: false })
        .limit(limit),
    ])

    return rows.map(normalizePriceRow)
  }

  return queryLocalRecentSales(limit)
}

async function fetchPriceSummaryRows(gameId, cutoffStr) {
  if (USE_SUPABASE) {
    const rows = await runSupabaseFallbackQueries([
      () => db
        .from('price_history')
        .select('price,condition,sale_date,source,is_real_sale,sold_at,source_confidence')
        .eq('game_id', gameId)
        .eq('is_real_sale', true)
        .gte('sold_at', cutoffStr)
        .order('sold_at', { ascending: false })
        .limit(2000),
      () => db
        .from('price_observations')
        .select('price,condition,observed_at,source_name,confidence,is_verified')
        .eq('game_id', gameId)
        .eq('is_verified', true)
        .gte('observed_at', cutoffStr)
        .order('observed_at', { ascending: false })
        .limit(2000),
      () => db
        .from('price_observations')
        .select('price,condition,observed_at')
        .eq('game_id', gameId)
        .eq('is_verified', true)
        .gte('observed_at', cutoffStr)
        .order('observed_at', { ascending: false })
        .limit(2000),
      () => db
        .from('price_history')
        .select('price,condition,sale_date,source')
        .eq('game_id', gameId)
        .eq('source', 'ebay')
        .gte('sale_date', cutoffStr)
        .order('sale_date', { ascending: false })
        .limit(2000),
      () => db
        .from('price_history')
        .select('price,condition,sale_date')
        .eq('game_id', gameId)
        .gte('sale_date', cutoffStr)
        .order('sale_date', { ascending: false })
        .limit(2000),
    ])

    return rows.map(normalizePriceRow)
  }

  return queryLocalPriceHistoryRows(gameId, cutoffStr, 2000)
}

async function fetchPriceSales(gameId, condition, limit) {
  if (USE_SUPABASE) {
    const buildRealHistoryQuery = (selectClause) => {
      let query = db
        .from('price_history')
        .select(selectClause)
        .eq('game_id', gameId)
        .eq('is_real_sale', true)
        .order('sold_at', { ascending: false })
        .limit(limit)

      if (condition) {
        query = query.ilike('condition_normalized', condition)
      }

      return query
    }

    const buildObservationQuery = (selectClause) => {
      let query = db
        .from('price_observations')
        .select(selectClause)
        .eq('game_id', gameId)
        .eq('is_verified', true)
        .order('observed_at', { ascending: false })
        .limit(limit)

      if (condition) {
        query = query.ilike('condition', condition)
      }

      return query
    }

    const buildHistoryQuery = (selectClause) => {
      let query = db
        .from('price_history')
        .select(selectClause)
        .eq('game_id', gameId)
        .eq('source', 'ebay')
        .order('sale_date', { ascending: false })
        .limit(limit)

      if (condition) {
        query = query.ilike('condition', condition)
      }

      return query
    }

    const rows = await runSupabaseFallbackQueries([
      () => buildRealHistoryQuery('id,game_id,price,condition,sale_date,source,listing_url,listing_title,created_at,is_real_sale,sale_type,listing_reference,sold_at,currency,price_original,price_eur,title_raw,condition_normalized,normalized_region,country_code,match_confidence,source_confidence,raw_payload'),
      () => buildObservationQuery('id,game_id,price,condition,observed_at,source_name,listing_url,listing_reference,created_at,confidence,is_verified,raw_payload'),
      () => buildObservationQuery('id,game_id,price,condition,observed_at,source_name,listing_url,listing_reference,created_at'),
      () => buildObservationQuery('id,game_id,price,condition,observed_at,source_name'),
      () => buildHistoryQuery('id,game_id,price,condition,sale_date,source,listing_url,listing_title,created_at'),
      () => buildHistoryQuery('id,game_id,price,condition,sale_date,source'),
    ])

    return rows.map(normalizePriceRow)
  }

  return queryLocalPriceSales(gameId, condition, limit)
}

module.exports = {
  fetchGamesMap,
  fetchRecentSales,
  fetchPriceSummaryRows,
  fetchPriceSales,
  getCutoffStr,
  isMissingPriceHistoryTable,
  roundPrice,
}
