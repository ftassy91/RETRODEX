'use strict'
// DATA: supabase via Supabase-only services - Sequelize non utilise dans ce fichier

const { Router } = require('express')

const { handleAsync, parseLimit } = require('../../helpers/query')
const {
  fetchRecentPriceSalesPayload,
  fetchGamePriceSummaryPayload,
  fetchGamePriceSalesPayload,
} = require('../../services/public-price-service')

const router = Router()

async function runPriceOperation(res, label, operation) {
  try {
    return await operation()
  } catch (error) {
    console.error(label, error)
    res.status(500).json({ ok: false, error: 'Erreur base de donnees' })
    return null
  }
}

router.get('/api/prices/recent', handleAsync(async (req, res) => {
  const limit = parseLimit(req.query.limit, 20, 100)
  const payload = await runPriceOperation(res, '/api/prices/recent', () => fetchRecentPriceSalesPayload(limit))
  if (!payload) {
    return
  }

  return res.json(payload)
}))

router.get('/api/prices/:gameId/summary', handleAsync(async (req, res) => {
  const months = Math.min(Number.parseInt(String(req.query.months || '24'), 10) || 24, 60)
  const payload = await runPriceOperation(
    res,
    '/api/prices/:gameId/summary',
    () => fetchGamePriceSummaryPayload(req.params.gameId, months)
  )
  if (!payload) {
    return
  }

  return res.json(payload)
}))

router.get('/api/prices/:gameId', handleAsync(async (req, res) => {
  const limit = parseLimit(req.query.limit, 50, 200)
  const condition = String(req.query.condition || '').trim().toLowerCase()
  const allowedCondition = ['loose', 'cib', 'mint'].includes(condition) ? condition : null
  const payload = await runPriceOperation(
    res,
    '/api/prices/:gameId',
    () => fetchGamePriceSalesPayload(req.params.gameId, allowedCondition, limit)
  )
  if (!payload) {
    return
  }

  return res.json(payload)
}))

module.exports = router
