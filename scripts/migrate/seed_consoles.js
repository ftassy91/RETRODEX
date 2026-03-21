'use strict'
const path = require('path')
const db = require(path.join(__dirname, '../../backend/config/database'))
const sequelize = db.sequelize || db
const Game = require(path.join(__dirname, '../../backend/src/models/Game'))

async function main() {
  await sequelize.sync({ alter: false })

  const consoles = [
    { id: 'nintendo-entertainment-system', title: 'Nintendo Entertainment System', console: 'NES', year: 1983, type: 'console', slug: 'nintendo-entertainment-system', source_confidence: 0.95 },
    { id: 'super-nintendo', title: 'Super Nintendo', console: 'Super Nintendo', year: 1990, type: 'console', slug: 'super-nintendo', source_confidence: 0.95 },
    { id: 'nintendo-64', title: 'Nintendo 64', console: 'Nintendo 64', year: 1996, type: 'console', slug: 'nintendo-64', source_confidence: 0.95 },
    { id: 'game-boy', title: 'Game Boy', console: 'Game Boy', year: 1989, type: 'console', slug: 'game-boy', source_confidence: 0.95 },
    { id: 'game-boy-color', title: 'Game Boy Color', console: 'Game Boy Color', year: 1998, type: 'console', slug: 'game-boy-color', source_confidence: 0.95 },
    { id: 'game-boy-advance', title: 'Game Boy Advance', console: 'Game Boy Advance', year: 2001, type: 'console', slug: 'game-boy-advance', source_confidence: 0.95 },
    { id: 'sega-genesis', title: 'Sega Genesis', console: 'Sega Genesis', year: 1988, type: 'console', slug: 'sega-genesis', source_confidence: 0.95 },
    { id: 'sega-saturn', title: 'Sega Saturn', console: 'Sega Saturn', year: 1994, type: 'console', slug: 'sega-saturn', source_confidence: 0.95 },
    { id: 'sega-dreamcast', title: 'Sega Dreamcast', console: 'Dreamcast', year: 1998, type: 'console', slug: 'sega-dreamcast', source_confidence: 0.95 },
    { id: 'playstation', title: 'PlayStation', console: 'PlayStation', year: 1994, type: 'console', slug: 'playstation', source_confidence: 0.95 },
    { id: 'playstation-2', title: 'PlayStation 2', console: 'PlayStation 2', year: 2000, type: 'console', slug: 'playstation-2', source_confidence: 0.95 },
    { id: 'turbografx-16', title: 'TurboGrafx-16', console: 'TurboGrafx-16', year: 1987, type: 'console', slug: 'turbografx-16', source_confidence: 0.90 },
    { id: 'neo-geo', title: 'Neo Geo', console: 'Neo Geo', year: 1990, type: 'console', slug: 'neo-geo', source_confidence: 0.90 },
    { id: 'atari-2600', title: 'Atari 2600', console: 'Atari 2600', year: 1977, type: 'console', slug: 'atari-2600', source_confidence: 0.90 }
  ]

  let ok = 0
  for (const c of consoles) {
    await Game.upsert(c)
    ok++
  }
  console.log(`[OK] ${ok} consoles insérées avec type=console`)
  await sequelize.close()
}

main().catch(async err => {
  console.error('[FATAL]', err.message)
  try { await sequelize.close() } catch (_) {}
  process.exit(1)
})
