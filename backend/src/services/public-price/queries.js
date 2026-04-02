'use strict'

const { db, mode } = require('../../../db_supabase')

const USE_SUPABASE = mode === 'supabase'

function getSqlite() {
  return mode === 'sqlite' ? db?._sqlite : null
}

function isMissingPriceHistoryTable(error) {
  const message = String(error?.message || '').toLowerCase()
  return message.includes('price_history') && (
    message.includes('does not exist')
    || message.includes('relation')
    || message.includes('schema cache')
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

async function queryLocalPriceHistoryRows(gameId, cutoffStr, limit = 2000) {
  const sqlite = getSqlite()
  if (!sqlite) {
    return []
  }

  if (sqliteTableExists('price_observations')) {
    return sqlite.prepare(`
      SELECT price,
             LOWER(condition) AS condition,
             observed_at AS sale_date
      FROM price_observations
      WHERE game_id = ?
        AND observed_at >= ?
      ORDER BY observed_at DESC
      LIMIT ?
    `).all(gameId, cutoffStr, limit)
  }

  if (!sqliteTableExists('price_history')) {
    return []
  }

  return sqlite.prepare(`
    SELECT price, condition, sale_date
    FROM price_history
    WHERE game_id = ?
      AND sale_date >= ?
    ORDER BY sale_date DESC
    LIMIT ?
  `).all(gameId, cutoffStr, limit)
}

async function queryLocalPriceSales(gameId, condition = null, limit = 200) {
  const sqlite = getSqlite()
  if (!sqlite) {
    return []
  }

  const params = [gameId]
  let conditionClause = ''
  if (condition) {
    conditionClause = ' AND condition = ?'
    params.push(condition)
  }

  if (sqliteTableExists('price_observations')) {
    return sqlite.prepare(`
      SELECT id,
             game_id,
             price,
             LOWER(condition) AS condition,
             observed_at AS sale_date,
             source_name AS source,
             listing_url,
             listing_reference AS listing_title,
             observed_at AS created_at
      FROM price_observations
      WHERE game_id = ?${conditionClause}
      ORDER BY observed_at DESC
      LIMIT ?
    `).all(...params, limit)
  }

  if (!sqliteTableExists('price_history')) {
    return []
  }

  return sqlite.prepare(`
    SELECT id, game_id, price, condition, sale_date, source, listing_url, listing_title, created_at
    FROM price_history
    WHERE game_id = ?${conditionClause}
    ORDER BY sale_date DESC
    LIMIT ?
  `).all(...params, limit)
}

async function queryLocalRecentSales(limit) {
  const sqlite = getSqlite()
  if (!sqlite) {
    return []
  }

  if (sqliteTableExists('price_observations')) {
    return sqlite.prepare(`
      SELECT id,
             game_id,
             price,
             LOWER(condition) AS condition,
             observed_at AS sale_date,
             source_name AS source
      FROM price_observations
      WHERE LOWER(source_name) = 'ebay'
      ORDER BY observed_at DESC
      LIMIT ?
    `).all(limit)
  }

  if (!sqliteTableExists('price_history')) {
    return []
  }

  return sqlite.prepare(`
    SELECT id, game_id, price, condition, sale_date, source
    FROM price_history
    WHERE LOWER(source) = 'ebay'
    ORDER BY sale_date DESC
    LIMIT ?
  `).all(limit)
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
    const { data, error } = await db
      .from('price_history')
      .select('id,game_id,price,condition,sale_date,source')
      .eq('source', 'ebay')
      .order('sale_date', { ascending: false })
      .limit(limit)

    if (error) {
      throw new Error(error.message)
    }

    return data || []
  }

  return queryLocalRecentSales(limit)
}

async function fetchPriceSummaryRows(gameId, cutoffStr) {
  if (USE_SUPABASE) {
    const { data, error } = await db
      .from('price_history')
      .select('price,condition,sale_date')
      .eq('game_id', gameId)
      .gte('sale_date', cutoffStr)
      .order('sale_date', { ascending: false })
      .limit(2000)

    if (error) {
      throw new Error(error.message)
    }

    return data || []
  }

  return queryLocalPriceHistoryRows(gameId, cutoffStr, 2000)
}

async function fetchPriceSales(gameId, condition, limit) {
  if (USE_SUPABASE) {
    let query = db
      .from('price_history')
      .select('id,game_id,price,condition,sale_date,source,listing_url,listing_title,created_at')
      .eq('game_id', gameId)
      .order('sale_date', { ascending: false })
      .limit(limit)

    if (condition) {
      query = query.eq('condition', condition)
    }

    const { data, error } = await query
    if (error) {
      throw new Error(error.message)
    }

    return data || []
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
