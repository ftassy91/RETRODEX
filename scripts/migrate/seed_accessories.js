'use strict'
const path = require('path')
const db = require(path.join(__dirname, '../../backend/config/database'))
const sequelize = db.sequelize || db
const Accessory = require(path.join(__dirname, '../../backend/src/models/Accessory'))

async function main() {
  await Accessory.sync({ alter: true })

  await Accessory.bulkCreate([
    { id: 'super-nintendo-controller', name: 'Super Nintendo Controller', console_id: 'super-nintendo', manufacturer_id: 'nintendo', accessory_type: 'controller', region_code: 'WW', release_year: 1990, slug: 'super-nintendo-controller', source_confidence: 0.95 },
    { id: 'nes-zapper', name: 'NES Zapper Light Gun', console_id: 'nintendo-entertainment-system', manufacturer_id: 'nintendo', accessory_type: 'lightgun', region_code: 'US', release_year: 1985, slug: 'nes-zapper', source_confidence: 0.95 },
    { id: 'sega-genesis-6-button', name: 'Sega Genesis 6-Button Controller', console_id: 'sega-genesis', manufacturer_id: 'sega', accessory_type: 'controller', region_code: 'US', release_year: 1993, slug: 'sega-genesis-6-button', source_confidence: 0.90 },
    { id: 'playstation-memory-card', name: 'PlayStation Memory Card', console_id: 'playstation', manufacturer_id: 'sony', accessory_type: 'memory_card', region_code: 'WW', release_year: 1994, slug: 'playstation-memory-card', source_confidence: 0.90 },
    { id: 'game-boy-link-cable', name: 'Game Boy Link Cable', console_id: 'game-boy', manufacturer_id: 'nintendo', accessory_type: 'cable', region_code: 'WW', release_year: 1989, slug: 'game-boy-link-cable', source_confidence: 0.90 },
    { id: 'n64-rumble-pak', name: 'Nintendo 64 Rumble Pak', console_id: 'nintendo-64', manufacturer_id: 'nintendo', accessory_type: 'peripheral', region_code: 'WW', release_year: 1997, slug: 'n64-rumble-pak', source_confidence: 0.90 },
    { id: 'sega-saturn-arcade-stick', name: 'Sega Saturn Arcade Stick', console_id: 'sega-saturn', manufacturer_id: 'sega', accessory_type: 'controller', region_code: 'JP', release_year: 1995, slug: 'sega-saturn-arcade-stick', source_confidence: 0.85 },
    { id: 'gamecube-wavebird', name: 'GameCube WaveBird Controller', console_id: 'gamecube', manufacturer_id: 'nintendo', accessory_type: 'controller', region_code: 'WW', release_year: 2002, slug: 'gamecube-wavebird', source_confidence: 0.90 }
  ], { ignoreDuplicates: true })

  const count = await Accessory.count()
  console.log(`[OK] ${count} accessoires en base`)
  await sequelize.close()
}

main().catch(async err => {
  console.error('[FATAL]', err.message)
  try { await sequelize.close() } catch (_) {}
  process.exit(1)
})
