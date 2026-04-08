'use strict'

const { Router } = require('express')
const { handleAsync } = require('../../helpers/query')
const { resolveRequestCollectionScope } = require('../../middleware/auth')
const { getCollectionCockpit } = require('../../services/public-collection/cockpit')

const router = Router()

router.get('/api/collection/cockpit', handleAsync(async (req, res) => {
  const scope = resolveRequestCollectionScope(req)
  const signals = await getCollectionCockpit(scope)
  res.set('Cache-Control', 'private, no-store')
  return res.json(signals)
}))

module.exports = router
