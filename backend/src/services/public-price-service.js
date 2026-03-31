'use strict'

const { db, mode } = require('../../db_supabase')

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

async function ensureLocalPriceHistoryTable() {
  const sqlite = getSqlite()
  if (!sqlite) {
    return
  }

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT NOT NULL,
      price REAL NOT NULL,
      condition TEXT CHECK(condition IN ('loose','cib','mint')) DEFAULT 'loose',
      sale_date TEXT,
      source TEXT DEFAULT 'seed',
      listing_title TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE
    )
  `)
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

  await ensureLocalPriceHistoryTable()

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

  await ensureLocalPriceHistoryTable()

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

  await ensureLocalPriceHistoryTable()

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

async function fetchRecentPriceSalesPayload(limit) {
  try {
    const sales = await fetchRecentSales(limit)
    const gamesMap = await fetchGamesMap(sales.map((sale) => sale.game_id))
    const rows = sales.map((sale) => {
      const game = gamesMap.get(sale.game_id) || {}
      return {
        ...sale,
        title: game.title || null,
        console: game.console || null,
        rarity: game.rarity || null,
      }
    })

    return { ok: true, count: rows.length, sales: rows }
  } catch (error) {
    if (isMissingPriceHistoryTable(error)) {
      return { ok: true, count: 0, sales: [] }
    }

    throw error
  }
}

async function fetchGamePriceSummaryPayload(gameId, months) {
  try {
    const rows = await fetchPriceSummaryRows(gameId, getCutoffStr(months))
    const buckets = {}

    for (const row of rows) {
      const condition = String(row.condition || 'loose').toLowerCase()
      if (!['loose', 'cib', 'mint'].includes(condition)) {
        continue
      }

      if (!buckets[condition]) {
        buckets[condition] = { prices: [], dates: [] }
      }

      buckets[condition].prices.push(Number(row.price))
      buckets[condition].dates.push(row.sale_date)
    }

    const byCondition = ['loose', 'cib', 'mint']
      .filter((condition) => buckets[condition] && buckets[condition].prices.length > 0)
      .map((condition) => {
        const prices = buckets[condition].prices.filter((price) => Number.isFinite(price))
        const dates = [...buckets[condition].dates].sort()
        const sorted = [...prices].sort((left, right) => left - right)
        const total = sorted.length
        const middle = Math.floor(total / 2)
        const median = total % 2 === 0
          ? (sorted[middle - 1] + sorted[middle]) / 2
          : sorted[middle]

        return {
          condition,
          count: total,
          min: total ? roundPrice(sorted[0]) : null,
          max: total ? roundPrice(sorted[total - 1]) : null,
          median: total ? roundPrice(median) : null,
          avg: total ? roundPrice(sorted.reduce((sum, price) => sum + price, 0) / total) : null,
          firstDate: dates[0] || null,
          lastDate: dates[dates.length - 1] || null,
        }
      })

    const allPrices = rows
      .map((row) => Number(row.price))
      .filter((price) => Number.isFinite(price))

    return {
      ok: true,
      gameId,
      period: `${months} months`,
      totalSales: rows.length,
      lastSale: rows[0]?.sale_date || null,
      minPrice: allPrices.length ? roundPrice(Math.min(...allPrices)) : null,
      maxPrice: allPrices.length ? roundPrice(Math.max(...allPrices)) : null,
      byCondition,
    }
  } catch (error) {
    if (isMissingPriceHistoryTable(error)) {
      return {
        ok: true,
        gameId,
        period: `${months} months`,
        totalSales: 0,
        lastSale: null,
        minPrice: null,
        maxPrice: null,
        byCondition: [],
      }
    }

    throw error
  }
}

async function fetchGamePriceSalesPayload(gameId, condition, limit) {
  try {
    const sales = await fetchPriceSales(gameId, condition, limit)

    return {
      ok: true,
      gameId,
      count: sales.length,
      sales,
    }
  } catch (error) {
    if (isMissingPriceHistoryTable(error)) {
      return {
        ok: true,
        gameId,
        count: 0,
        sales: [],
      }
    }

    throw error
  }
}

module.exports = {
  fetchRecentPriceSalesPayload,
  fetchGamePriceSummaryPayload,
  fetchGamePriceSalesPayload,
}
