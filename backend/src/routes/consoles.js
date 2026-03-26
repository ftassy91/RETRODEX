const { Router } = require('express')
const Console = require('../models/Console')
const { handleAsync } = require('../helpers/query')
const {
  buildConsolePayload,
  listConsoleItems,
} = require('../services/console-service')

const router = Router()

router.get('/consoles', async (_req, res) => {
  try {
    const consoles = await Console.findAll({
      attributes: ['id', 'name', 'manufacturer', 'generation', 'releaseYear', 'slug'],
      order: [['generation', 'ASC'], ['name', 'ASC']],
    })
    res.json(consoles)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/api/consoles', handleAsync(async (_req, res) => {
  const items = await listConsoleItems()
  res.json({ ok: true, items, count: items.length })
}))

router.get('/api/consoles/:id', handleAsync(async (req, res) => {
  const payload = await buildConsolePayload(req.params.id, {
    gamesLimit: 24,
  })

  if (!payload) {
    return res.status(404).json({ ok: false, error: 'Console not found' })
  }

  res.json({
    ok: true,
    ...payload,
  })
}))

module.exports = router
