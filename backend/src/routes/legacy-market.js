'use strict'
// DATA: legacy isolated route tree - not mounted by default in the canonical Supabase runtime
// LEGACY REVIEW 2026-03-31:
// - This file owns the remaining frontend-consumed market endpoints that are
//   not covered by the canonical `routes/market/*` tree:
//   `/api/accessories/types`, `/api/accessories`, `/api/index/:id`, `/api/reports`
// - Current callers include `backend/public/js/pages/accessories.js` and
//   `backend/public/js/pages/game-detail.js`.
// - Frontend consumer migration is explicitly deferred to Phase 5.

const { Router } = require('express')

const { handleAsync } = require('../helpers/query')
const {
  listLegacyAccessoryTypes,
  listLegacyAccessories,
} = require('../services/legacy-market-accessory-service')
const {
  fetchLegacyMarketIndex,
} = require('../services/legacy-market-index-service')
const {
  createLegacyMarketReport,
} = require('../services/legacy-market-report-service')

const router = Router()

router.get('/api/accessories/types', handleAsync(async (_req, res) => {
  const types = await listLegacyAccessoryTypes()

  res.json({
    ok: true,
    types,
  })
}))

router.get('/api/accessories', handleAsync(async (_req, res) => {
  res.json({
    ok: true,
    ...(await listLegacyAccessories()),
  })
}))

router.get('/api/index/:id', handleAsync(async (req, res) => {
  res.json({
    ok: true,
    ...(await fetchLegacyMarketIndex(req.params.id)),
  })
}))

router.post('/api/reports', handleAsync(async (req, res) => {
  try {
    return res.json({
      ok: true,
      ...(await createLegacyMarketReport(req.body || {})),
    })
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        ok: false,
        error: error.message,
      })
    }

    throw error
  }
}))

module.exports = router
