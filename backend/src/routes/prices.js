'use strict'

const { Router } = require('express')
const { QueryTypes } = require('sequelize')
const { sequelize } = require('../database')

const router = Router()

function isMissingPriceHistoryTable(error) {
  const message = String(error?.message || '').toLowerCase()
  return message.includes('price_history') && (
    message.includes('no such table')
    || message.includes('does not exist')
    || message.includes('unknown table')
  )
}

async function selectAll(sql, replacements = {}) {
  return sequelize.query(sql, {
    replacements,
    type: QueryTypes.SELECT,
  })
}

router.get('/recent', async (req, res) => {
  const limit = Math.min(Number.parseInt(String(req.query.limit || '20'), 10) || 20, 100)

  try {
    const rows = await selectAll(`
      SELECT
        ph.id,
        ph.game_id,
        ph.price,
        ph.condition,
        ph.sale_date,
        ph.source,
        g.title,
        g.console,
        g.rarity
      FROM price_history ph
      JOIN games g ON g.id = ph.game_id
      WHERE ph.source = 'ebay'
      ORDER BY ph.sale_date DESC
      LIMIT :limit
    `, { limit })

    return res.json({ ok: true, count: rows.length, sales: rows })
  } catch (error) {
    if (isMissingPriceHistoryTable(error)) {
      return res.json({ ok: true, count: 0, sales: [] })
    }
    console.error('/api/prices/recent', error)
    return res.status(500).json({ ok: false, error: 'Erreur base de données' })
  }
})

router.get('/:gameId/summary', async (req, res) => {
  const { gameId } = req.params
  const threshold = new Date(Date.now() - (1000 * 60 * 60 * 24 * 30 * 6)).toISOString()

  try {
    const rows = await selectAll(`
      SELECT
        condition,
        COUNT(*) AS sales_count,
        ROUND(AVG(price), 2) AS avg_price,
        MIN(price) AS min_price,
        MAX(price) AS max_price,
        MAX(sale_date) AS last_sale_date
      FROM price_history
      WHERE game_id = :gameId
        AND source = 'ebay'
        AND sale_date >= :threshold
      GROUP BY condition
      ORDER BY CASE condition
        WHEN 'loose' THEN 0
        WHEN 'cib' THEN 1
        WHEN 'mint' THEN 2
        ELSE 3
      END
    `, { gameId, threshold })

    return res.json({
      ok: true,
      gameId,
      period: '6 months',
      byCondition: rows,
    })
  } catch (error) {
    if (isMissingPriceHistoryTable(error)) {
      return res.json({
        ok: true,
        gameId,
        period: '6 months',
        byCondition: [],
      })
    }
    console.error('/api/prices/:gameId/summary', error)
    return res.status(500).json({ ok: false, error: 'Erreur base de données' })
  }
})

router.get('/:gameId', async (req, res) => {
  const { gameId } = req.params
  const limit = Math.min(Number.parseInt(String(req.query.limit || '50'), 10) || 50, 200)
  const condition = String(req.query.condition || '').trim().toLowerCase()
  const allowedCondition = ['loose', 'cib', 'mint'].includes(condition) ? condition : null

  try {
    const rows = await selectAll(`
      SELECT
        id,
        game_id,
        price,
        condition,
        sale_date,
        source,
        listing_url,
        listing_title,
        created_at
      FROM price_history
      WHERE game_id = :gameId
        ${allowedCondition ? 'AND condition = :condition' : ''}
      ORDER BY sale_date DESC
      LIMIT :limit
    `, {
      gameId,
      limit,
      ...(allowedCondition ? { condition: allowedCondition } : {}),
    })

    return res.json({
      ok: true,
      gameId,
      count: rows.length,
      sales: rows,
    })
  } catch (error) {
    if (isMissingPriceHistoryTable(error)) {
      return res.json({
        ok: true,
        gameId,
        count: 0,
        sales: [],
      })
    }
    console.error('/api/prices/:gameId', error)
    return res.status(500).json({ ok: false, error: 'Erreur base de données' })
  }
})

module.exports = router
