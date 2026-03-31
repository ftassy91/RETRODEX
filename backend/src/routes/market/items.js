'use strict'

const { Router } = require('express')

const { handleAsync } = require('../../helpers/query')
const {
  fetchItemsPayload,
} = require('../../services/public-runtime-payload-service')

const router = Router()

router.get('/api/items', handleAsync(async (req, res) => {
  return res.json(await fetchItemsPayload(req.query))
}))

module.exports = router
