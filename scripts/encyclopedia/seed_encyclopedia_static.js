'use strict'
const path = require('path')
const sequelize = require(path.join(__dirname, '../../backend/config/database'))
const Game = require(path.join(__dirname, '../../backend/src/models/Game'))
const data = require(path.join(__dirname, '../../data/encyclopedia_seed.json'))

async function main() {
  await sequelize.sync({ alter: false })
  let ok = 0, notFound = 0

  for (const entry of data) {
    const game = await Game.findOne({ where: { id: entry.id } })
    if (!game) { console.log(`[WARN] not found: ${entry.id}`); notFound++; continue }

    await game.update({
      synopsis: entry.synopsis || null,
      dev_anecdotes: entry.dev_anecdotes ? JSON.stringify(entry.dev_anecdotes) : null,
      dev_team: entry.dev_team ? JSON.stringify(entry.dev_team) : null,
      cheat_codes: entry.cheat_codes ? JSON.stringify(entry.cheat_codes) : null
    })
    console.log(`[OK] ${game.title}`)
    ok++
  }

  console.log(`\nEnrichis : ${ok} | Non trouvés : ${notFound}`)
  await sequelize.close()
}

main().catch(err => { console.error('[FATAL]', err.message); process.exit(1) })
