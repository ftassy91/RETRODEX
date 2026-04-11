'use strict'
// DATA: supabase via Supabase-only services and legacy-isolated helpers - Sequelize non utilise dans ce fichier

const { Router } = require('express')

const { handleAsync } = require('../../helpers/query')
const {
  fetchConsolesPayload,
  fetchConsoleDetailPayload,
} = require('../../services/public-runtime-payload-service')

const router = Router()

let _consolesCache = { data: null, ts: 0 }
const CONSOLES_TTL = 10 * 60 * 1000 // 10 min

router.get('/api/consoles', handleAsync(async (_req, res) => {
  const now = Date.now()
  if (_consolesCache.data && (now - _consolesCache.ts) < CONSOLES_TTL) {
    return res.json(_consolesCache.data)
  }

  const payload = await fetchConsolesPayload()
  _consolesCache = { data: payload, ts: now }
  return res.json(payload)
}))

router.get('/api/consoles/:id', handleAsync(async (req, res) => {
  const payload = await fetchConsoleDetailPayload(req.params.id)
  if (!payload) {
    return res.status(404).json({ ok: false, error: 'Console not found' })
  }

  return res.json(payload)
}))

module.exports = router
