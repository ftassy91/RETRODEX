'use strict';
// SYNC: A6 - migre le 2026-03-23 - routes /api/prices lues via Supabase
// Décision source : SYNC.md § A6

const { Router } = require('express');

process.env.SUPABASE_URL = process.env.SUPABASE_URL || process.env.SUPERDATA_Project_URL;
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
  || process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPERDATA_SERVICE_KEY;
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPERDATA_Anon_Key;

const { db } = require('../../db_supabase');

const router = Router();

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
  const threshold = new Date(Date.now() - (1000 * 60 * 60 * 24 * 30 * 6)).toISOString();

  try {
    const { data, error } = await db
      .from('price_history')
      .select('condition,price,sale_date')
      .eq('game_id', gameId)
      .eq('source', 'ebay')
      .gte('sale_date', threshold)
      .order('sale_date', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const grouped = new Map();
    for (const sale of data || []) {
      const condition = sale.condition || 'unknown';
      if (!grouped.has(condition)) {
        grouped.set(condition, []);
      }
      grouped.get(condition).push(sale);
    }

    const byCondition = Array.from(grouped.entries())
      .sort(([left], [right]) => sortConditionOrder(left, right))
      .map(([condition, sales]) => {
        const prices = sales
          .map((sale) => Number(sale.price))
          .filter((price) => Number.isFinite(price));
        return {
          condition,
          sales_count: sales.length,
          avg_price: prices.length
            ? roundPrice(prices.reduce((sum, price) => sum + price, 0) / prices.length)
            : null,
          min_price: prices.length ? Math.min(...prices) : null,
          max_price: prices.length ? Math.max(...prices) : null,
          last_sale_date: sales[0]?.sale_date || null,
        };
      });

    return res.json({
      ok: true,
      gameId,
      period: '6 months',
      byCondition,
    });
  } catch (error) {
    if (isMissingPriceHistoryTable(error)) {
      return res.json({
        ok: true,
        gameId,
        period: '6 months',
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

    return res.json({
      ok: true,
      gameId,
      count: (data || []).length,
      sales: data || [],
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
