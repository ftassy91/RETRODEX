'use strict'
// DATA: supabase via canonical route tree and isolated accessory service - Sequelize non utilise pas dans ce fichier

const { Router } = require('express')

const { handleAsync } = require('../../helpers/query')
const {
  listAccessoryTypes,
  listAccessories,
} = require('../../services/public-accessory-service')

const router = Router()

router.get('/api/market/accessories/types', handleAsync(async (_req, res) => {
  const types = await listAccessoryTypes()

  return res.json({
    ok: true,
    types,
  })
}))

router.get('/api/market/accessories', handleAsync(async (_req, res) => {
  return res.json({
    ok: true,
    ...(await listAccessories()),
  })
}))

module.exports = router
