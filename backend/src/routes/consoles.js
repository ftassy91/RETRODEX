const { Router } = require("express");
const Game = require("../models/Game");
const Console = require("../models/Console");
const { handleAsync } = require("../helpers/query");

const router = Router();

router.get("/consoles", async (_req, res) => {
  try {
    const consoles = await Console.findAll({
      attributes: ["id", "name", "manufacturer", "generation", "releaseYear", "slug"],
      order: [["generation", "ASC"], ["name", "ASC"]]
    })
    res.json(consoles)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/api/consoles', handleAsync(async (_req, res) => {
  const Console = require('../models/Console')

  const consoles = await Console.findAll({ order: [['name', 'ASC']] })

  const games = await Game.findAll({ attributes: ['console'] })
  const counts = new Map()
  for (const g of games) {
    if (g.console) counts.set(g.console, (counts.get(g.console) || 0) + 1)
  }

  const items = consoles.map((c) => ({
    id: c.id,
    name: c.name || c.platform,
    maker: c.maker || c.manufacturer,
    gen: c.gen || c.generation,
    type: c.type,
    year: c.year || c.release_year,
    gamesCount: counts.get(c.name || c.platform) || counts.get(c.id) || 0,
  }))

  res.json({ items, count: items.length })
}))

router.get('/api/consoles/:id', handleAsync(async (req, res) => {
  const Console = require('../models/Console')
  const consoleRecord = await Console.findOne({ where: { id: req.params.id } })
  if (!consoleRecord) return res.status(404).json({ ok: false, error: 'Console not found' })
  res.json(consoleRecord)
}))

module.exports = router;
