'use strict'

const { Router } = require('express')

const { handleAsync } = require('../../helpers/query')
const { resolveRequestCollectionScope } = require('../../middleware/auth')
const {
  getCollectionStats,
} = require('../../services/public-collection-service')

const router = Router()

router.get('/api/collection/stats', handleAsync(async (req, res) => {
  const stats = await getCollectionStats(resolveRequestCollectionScope(req))
  return res.json({
    ...stats,
    total: stats.count,
  })
}))

module.exports = router
