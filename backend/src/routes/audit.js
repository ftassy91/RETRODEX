'use strict'

const { Router } = require('express')

const { handleAsync, parseLimit } = require('../helpers/query')
const {
  getAuditSummary,
  getGameAuditEntries,
  getConsoleAuditEntries,
  getMarketAudit,
} = require('../services/audit-service')

const router = Router()

function shouldPersist(req) {
  return String(req.query.persist || '').trim() === '1'
}

router.get('/api/audit/summary', handleAsync(async (req, res) => {
  const summary = await getAuditSummary({ persist: shouldPersist(req) })
  res.json({ ok: true, summary })
}))

router.get('/api/audit/games', handleAsync(async (req, res) => {
  const limit = parseLimit(req.query.limit, 250, 5000)
  const entries = await getGameAuditEntries({
    limit,
    persist: shouldPersist(req),
  })
  res.json({ ok: true, count: entries.length, items: entries })
}))

router.get('/api/audit/consoles', handleAsync(async (req, res) => {
  const entries = await getConsoleAuditEntries({
    persist: shouldPersist(req),
  })
  res.json({ ok: true, count: entries.length, items: entries })
}))

router.get('/api/audit/market', handleAsync(async (_req, res) => {
  const market = await getMarketAudit()
  res.json({ ok: true, market })
}))

module.exports = router
