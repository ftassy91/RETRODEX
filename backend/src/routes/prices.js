'use strict';
// SYNC: A6 - migre le 2026-03-23 - routes /api/prices lues via Supabase
// Décision source : SYNC.md § A6

const { Router } = require('express');
const { QueryTypes } = require('sequelize');

process.env.SUPABASE_URL = process.env.SUPABASE_URL || process.env.SUPERDATA_Project_URL;
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
  || process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPERDATA_SERVICE_KEY;
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPERDATA_Anon_Key;

const { db, mode } = require('../../db_supabase');
const { sequelize, databaseMode } = require('../database');

const router = Router();
const USE_SUPABASE = mode === 'supabase';

function tableNamesMatch(tableName, target) {
  return String(tableName || '').replace(/"/g, '').toLowerCase() === String(target).toLowerCase();
}

async function tableExists(target) {
  const tables = await sequelize.getQueryInterface().showAllTables();
  return (tables || []).some((tableName) => tableNamesMatch(tableName, target));
}

function isMissingPriceHistoryTable(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('price_history') && (
    message.includes('does not exist')
    || message.includes('relation')
    || message.includes('schema cache')
  );
}

function sortConditionOrder(left, right) {
  const rank = { loose: 0, cib: 1, mint: 2 };
  return (rank[left] ?? 99) - (rank[right] ?? 99);
}

function roundPrice(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return null;
  }
  return Math.round(number * 100) / 100;
}

function getCutoffStr(months) {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  return cutoff.toISOString().slice(0, 10);
}

async function ensureLocalPriceHistoryTable() {
  if (databaseMode !== 'sqlite') {
    return;
  }

  await sequelize.query(`
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
  `);
}

async function queryLocalPriceHistoryRows(gameId, cutoffStr, limit = 2000) {
  if (await tableExists('price_observations')) {
    return sequelize.query(
      `SELECT price,
              LOWER(condition) AS condition,
              observed_at AS sale_date
       FROM price_observations
       WHERE game_id = :gameId
         AND observed_at >= :cutoffStr
       ORDER BY observed_at DESC
       LIMIT :limit`,
      {
        replacements: { gameId, cutoffStr, limit },
        type: QueryTypes.SELECT,
      }
    );
  }

  await ensureLocalPriceHistoryTable();

  return sequelize.query(
    `SELECT price, condition, sale_date
     FROM price_history
     WHERE game_id = :gameId
       AND sale_date >= :cutoffStr
     ORDER BY sale_date DESC
     LIMIT :limit`,
    {
      replacements: { gameId, cutoffStr, limit },
      type: QueryTypes.SELECT,
    }
  );
}

async function queryLocalPriceSales(gameId, condition = null, limit = 200) {
  const replacements = { gameId, limit };
  let conditionClause = '';
  if (condition) {
    conditionClause = ' AND condition = :condition';
    replacements.condition = condition;
  }

  if (await tableExists('price_observations')) {
    return sequelize.query(
      `SELECT id,
              game_id,
              price,
              LOWER(condition) AS condition,
              observed_at AS sale_date,
              source_name AS source,
              listing_url,
              listing_reference AS listing_title,
              observed_at AS created_at
       FROM price_observations
       WHERE game_id = :gameId${conditionClause}
       ORDER BY observed_at DESC
       LIMIT :limit`,
      {
        replacements,
        type: QueryTypes.SELECT,
      }
    );
  }

  await ensureLocalPriceHistoryTable();

  return sequelize.query(
    `SELECT id, game_id, price, condition, sale_date, source, listing_url, listing_title, created_at
     FROM price_history
     WHERE game_id = :gameId${conditionClause}
     ORDER BY sale_date DESC
     LIMIT :limit`,
    {
      replacements,
      type: QueryTypes.SELECT,
    }
  );
}

async function fetchGamesMap(gameIds) {
  const uniqueIds = Array.from(new Set(gameIds.filter(Boolean)));
  if (!uniqueIds.length) {
    return new Map();
  }

  const { data, error } = await db
    .from('games')
    .select('id,title,console,rarity')
    .in('id', uniqueIds);

  if (error) {
    throw new Error(error.message);
  }

  return new Map((data || []).map((game) => [game.id, game]));
}

router.get('/recent', async (req, res) => {
  const limit = Math.min(Number.parseInt(String(req.query.limit || '20'), 10) || 20, 100);

  try {
    const { data, error } = await db
      .from('price_history')
      .select('id,game_id,price,condition,sale_date,source')
      .eq('source', 'ebay')
      .order('sale_date', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(error.message);
    }

    const sales = data || [];
    const gamesMap = await fetchGamesMap(sales.map((sale) => sale.game_id));
    const rows = sales.map((sale) => {
      const game = gamesMap.get(sale.game_id) || {};
      return {
        ...sale,
        title: game.title || null,
        console: game.console || null,
        rarity: game.rarity || null,
      };
    });

    return res.json({ ok: true, count: rows.length, sales: rows });
  } catch (error) {
    if (isMissingPriceHistoryTable(error)) {
      return res.json({ ok: true, count: 0, sales: [] });
    }
    console.error('/api/prices/recent', error);
    return res.status(500).json({ ok: false, error: 'Erreur base de données' });
  }
});

router.get('/:gameId/summary', async (req, res) => {
  const { gameId } = req.params;
  const months = Math.min(Number.parseInt(String(req.query.months || '24'), 10) || 24, 60);

  try {
    const cutoffStr = getCutoffStr(months);
    let rows = [];

    if (USE_SUPABASE) {
      const { data, error } = await db
        .from('price_history')
        .select('price,condition,sale_date')
        .eq('game_id', gameId)
        .gte('sale_date', cutoffStr)
        .order('sale_date', { ascending: false })
        .limit(2000);

      if (error) {
        throw new Error(error.message);
      }

      rows = data || [];
    } else {
      rows = await queryLocalPriceHistoryRows(gameId, cutoffStr, 2000);
    }

    const buckets = {};
    for (const row of rows) {
      const condition = String(row.condition || 'loose').toLowerCase();
      if (!['loose', 'cib', 'mint'].includes(condition)) {
        continue;
      }
      if (!buckets[condition]) {
        buckets[condition] = { prices: [], dates: [] };
      }
      buckets[condition].prices.push(Number(row.price));
      buckets[condition].dates.push(row.sale_date);
    }

    const byCondition = ['loose', 'cib', 'mint']
      .filter((condition) => buckets[condition] && buckets[condition].prices.length > 0)
      .map((condition) => {
        const prices = buckets[condition].prices.filter((price) => Number.isFinite(price));
        const dates = [...buckets[condition].dates].sort();
        const sorted = [...prices].sort((left, right) => left - right);
        const total = sorted.length;
        const middle = Math.floor(total / 2);
        const median = total % 2 === 0
          ? (sorted[middle - 1] + sorted[middle]) / 2
          : sorted[middle];

        return {
          condition,
          count: total,
          min: total ? roundPrice(sorted[0]) : null,
          max: total ? roundPrice(sorted[total - 1]) : null,
          median: total ? roundPrice(median) : null,
          avg: total ? roundPrice(sorted.reduce((sum, price) => sum + price, 0) / total) : null,
          firstDate: dates[0] || null,
          lastDate: dates[dates.length - 1] || null,
        };
      });

    const allPrices = rows
      .map((row) => Number(row.price))
      .filter((price) => Number.isFinite(price));

    return res.json({
      ok: true,
      gameId,
      period: `${months} months`,
      totalSales: rows.length,
      lastSale: rows[0]?.sale_date || null,
      minPrice: allPrices.length ? roundPrice(Math.min(...allPrices)) : null,
      maxPrice: allPrices.length ? roundPrice(Math.max(...allPrices)) : null,
      byCondition,
    });
  } catch (error) {
    if (isMissingPriceHistoryTable(error)) {
      return res.json({
        ok: true,
        gameId,
        period: `${months} months`,
        totalSales: 0,
        lastSale: null,
        minPrice: null,
        maxPrice: null,
        byCondition: [],
      });
    }
    console.error('/api/prices/:gameId/summary', error);
    return res.status(500).json({ ok: false, error: 'Erreur base de données' });
  }
});

router.get('/:gameId', async (req, res) => {
  const { gameId } = req.params;
  const limit = Math.min(Number.parseInt(String(req.query.limit || '50'), 10) || 50, 200);
  const condition = String(req.query.condition || '').trim().toLowerCase();
  const allowedCondition = ['loose', 'cib', 'mint'].includes(condition) ? condition : null;

  try {
    let sales = [];

    if (USE_SUPABASE) {
      let query = db
        .from('price_history')
        .select('id,game_id,price,condition,sale_date,source,listing_url,listing_title,created_at')
        .eq('game_id', gameId)
        .order('sale_date', { ascending: false })
        .limit(limit);

      if (allowedCondition) {
        query = query.eq('condition', allowedCondition);
      }

      const { data, error } = await query;
      if (error) {
        throw new Error(error.message);
      }
      sales = data || [];
    } else {
      sales = await queryLocalPriceSales(gameId, allowedCondition, limit);
    }

    return res.json({
      ok: true,
      gameId,
      count: sales.length,
      sales,
    });
  } catch (error) {
    if (isMissingPriceHistoryTable(error)) {
      return res.json({
        ok: true,
        gameId,
        count: 0,
        sales: [],
      });
    }
    console.error('/api/prices/:gameId', error);
    return res.status(500).json({ ok: false, error: 'Erreur base de données' });
  }
});

module.exports = router;
