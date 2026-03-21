'use strict'
const path = require('path')
const db = require(path.join(__dirname, '../../backend/config/database'))
const sequelize = db.sequelize || db
const Game = require(path.join(__dirname, '../../backend/src/models/Game'))

function generateSlug(title, platform) {
  return [title, platform].join('-')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100)
}

async function main() {
  await sequelize.sync({ alter: false })
  const games = await Game.findAll()
  console.log(`[INFO] ${games.length} jeux à mettre à jour`)

  let ok = 0, skip = 0
  for (const game of games) {
    if (game.slug) { skip++; continue }
    const slug = generateSlug(game.title || '', game.platform || game.console || '')
    await game.update({
      slug,
      source_confidence: 0.70,
      type: game.type || 'game'
    })
    ok++
  }

  console.log(`[OK] ${ok} slugs générés, ${skip} déjà remplis`)
  await sequelize.close()
}

main().catch(async err => {
  console.error('[FATAL]', err.message)
  try { await sequelize.close() } catch (_) {}
  process.exit(1)
})
