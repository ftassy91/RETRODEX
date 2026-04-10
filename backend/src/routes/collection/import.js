'use strict'

const { Router } = require('express')
const { handleAsync } = require('../../helpers/query')
const { resolveRequestCollectionScope } = require('../../middleware/auth')
const { importCsvCollection } = require('../../services/public-collection/import')

const router = Router()

// POST /api/collection/import
// Body: { csv: "title,console,condition,price_paid\n..." }
router.post('/import', handleAsync(async (req, res) => {
  const scope = resolveRequestCollectionScope(req)
  const csvText = String(req.body?.csv || '')

  if (!csvText.trim()) {
    return res.status(400).json({ error: 'CSV text is required in body.csv' })
  }

  const result = await importCsvCollection({
    ...scope,
    csvText,
  })

  res.json(result)
}))

module.exports = router
