'use strict'

const { Router } = require('express')

const { handleAsync } = require('../../helpers/query')
const {
  fetchConsolesPayload,
  fetchConsoleDetailPayload,
} = require('../../services/public-runtime-payload-service')

const router = Router()

router.get('/api/consoles', handleAsync(async (_req, res) => {
  return res.json(await fetchConsolesPayload())
}))

router.get('/api/consoles/:id', handleAsync(async (req, res) => {
  const payload = await fetchConsoleDetailPayload(req.params.id)
  if (!payload) {
    return res.status(404).json({ ok: false, error: 'Console not found' })
  }

  return res.json(payload)
}))

module.exports = router
