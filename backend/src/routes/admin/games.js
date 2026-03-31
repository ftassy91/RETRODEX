'use strict'
// DATA: Sequelize plus manual local SQLite reads - non-canonical admin/back-office route, not mounted by default

const { Router } = require('express')
const { Sequelize } = require('sequelize')
const path = require('path')

require('./games-helpers')
const { handleAsync } = require('../../helpers/query')

const router = Router()

router.get('/api/admin/test-cover', handleAsync(async (req, res) => {
  const sequelize = req.app.locals.sequelize || require('../../database').sequelize
  const testUrl = 'https://images.igdb.com/igdb/image/upload/t_cover_big/cobalf.jpg'
  const testId = 'panzer-dragoon-saga-sega-saturn'

  await sequelize.query(
    'UPDATE games SET cover_url = :url WHERE id = :id',
    { replacements: { url: testUrl, id: testId } }
  )

  const [[row]] = await sequelize.query(
    'SELECT id, cover_url FROM games WHERE id = :id',
    { replacements: { id: testId } }
  )

  res.json({ written: testUrl, readBack: row })
}))

router.get('/api/admin/sync-covers', handleAsync(async (req, res) => {
  const sequelize = req.app.locals.sequelize || require('../../database').sequelize

  const sqliteSeq = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '../../../storage/retrodex.sqlite'),
    logging: false,
  })

  const [games] = await sqliteSeq.query(`
    SELECT id, "coverImage" as coverImage
    FROM games
    WHERE "coverImage" IS NOT NULL
  `)

  await sqliteSeq.close()

  let success = 0
  let errors = 0

  for (const game of games) {
    if (!game.coverImage) continue
    try {
      await sequelize.query(
        'UPDATE games SET cover_url = :url WHERE id = :id',
        { replacements: { url: game.coverImage, id: game.id } }
      )
      success++
    } catch (e) {
      errors++
      if (errors <= 3) console.error('[sync-covers]', game.id, e.message)
    }
  }

  res.json({ ok: true, total: games.length, success, errors })
}))

router.get('/api/admin/sync-lore', handleAsync(async (req, res) => {
  const sequelize = req.app.locals.sequelize || require('../../database').sequelize

  const sqliteSeq = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '../../../storage/retrodex.sqlite'),
    logging: false,
  })

  const [games] = await sqliteSeq.query(`
    SELECT id, lore, gameplay_description, characters,
           ost_composers, ost_notable_tracks,
           avg_duration_main, avg_duration_complete,
           speedrun_wr, "coverImage", manual_url
    FROM games
    WHERE lore IS NOT NULL
       OR ost_composers IS NOT NULL
       OR "coverImage" IS NOT NULL
  `)

  await sqliteSeq.close()

  let success = 0
  let errors = 0

  for (const game of games) {
    const updates = {}
    if (game.lore) updates.lore = game.lore
    if (game.gameplay_description) updates.gameplay_description = game.gameplay_description
    if (game.characters) updates.characters = game.characters
    if (game.ost_composers) updates.ost_composers = game.ost_composers
    if (game.ost_notable_tracks) updates.ost_notable_tracks = game.ost_notable_tracks
    if (game.avg_duration_main) updates.avg_duration_main = game.avg_duration_main
    if (game.avg_duration_complete) updates.avg_duration_complete = game.avg_duration_complete
    if (game.speedrun_wr) updates.speedrun_wr = game.speedrun_wr
    if (game.coverImage) {
      updates.coverImage = game.coverImage
      updates.cover_url = game.coverImage
    }
    if (game.manual_url) updates.manual_url = game.manual_url
    if (Object.keys(updates).length === 0) continue

    try {
      const sets = Object.keys(updates).map((k) => `"${k}" = :${k}`).join(', ')
      await sequelize.query(
        `UPDATE games SET ${sets} WHERE id = :id`,
        { replacements: { ...updates, id: game.id } }
      )
      success++
    } catch (_error) {
      errors++
    }
  }

  res.json({ ok: true, total: games.length, success, errors })
}))

module.exports = router
