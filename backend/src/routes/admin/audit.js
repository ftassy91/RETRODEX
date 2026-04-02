'use strict'
// DATA: Sequelize via audit-service - non-canonical admin/back-office route, mounted only in local/admin runtime

const { Router } = require('express')

const { handleAsync, parseLimit } = require('../../helpers/query')
const {
  getAuditSummary,
  getGameAuditEntries,
  getConsoleAuditEntries,
  getMarketAudit,
  getLegacyCanonicalDivergenceReport,
  getPriorityQueue,
} = require('../../services/admin/audit-service')
const { getCompletionOverview } = require('../../services/admin/completion-service')

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

router.get('/api/audit/divergence', handleAsync(async (req, res) => {
  const limit = parseLimit(req.query.limit, 250, 5000)
  const report = await getLegacyCanonicalDivergenceReport({ limit })
  res.json({ ok: true, ...report })
}))

router.get('/api/audit/priorities', handleAsync(async (req, res) => {
  const limit = parseLimit(req.query.limit, 100, 1000)
  const entityType = String(req.query.entityType || 'all').trim().toLowerCase()
  const items = await getPriorityQueue({
    entityType,
    limit,
    persist: shouldPersist(req),
  })
  res.json({ ok: true, entityType, count: items.length, items })
}))

router.get('/api/audit/completion', handleAsync(async (_req, res) => {
  const overview = await getCompletionOverview()
  res.json({ ok: true, overview })
}))

module.exports = router
