'use strict'
// DATA: local prototype -> SQLite sync route.
// STATUS: non-canonical admin/back-office endpoint, not mounted by default and never part of the public runtime contract.

const { Router } = require('express')

const { syncGamesFromPrototype } = require('../../syncGames')
const { handleAsync } = require('../../helpers/query')

const router = Router()

router.post('/api/sync', handleAsync(async (req, res) => {
  const secret = process.env.SYNC_SECRET

  if (!secret) {
    console.error('POST /api/sync rejected: SYNC_SECRET is not configured')
    return res.status(500).json({ ok: false, error: 'Sync endpoint is not configured' })
  }

  if (req.headers['x-sync-secret'] !== secret) {
    console.warn('POST /api/sync rejected: invalid secret')
    return res.status(403).json({ ok: false, error: 'Forbidden' })
  }

  const result = await syncGamesFromPrototype({ force: true })

  res.json({ ok: true, ...result })
}))

module.exports = router
