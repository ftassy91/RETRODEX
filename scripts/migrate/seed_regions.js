'use strict'
const path = require('path')
const db = require(path.join(__dirname, '../../backend/config/database'))
const sequelize = db.sequelize || db
const Region = require(path.join(__dirname, '../../backend/src/models/Region'))

async function main() {
  await sequelize.sync({ alter: false })
  await Region.sync({ force: false, alter: true })
  await Region.bulkCreate([
    { code: 'JP', name: 'Japan' },
    { code: 'US', name: 'North America' },
    { code: 'EU', name: 'Europe' },
    { code: 'WW', name: 'Worldwide' },
    { code: 'AU', name: 'Australia' }
  ], { ignoreDuplicates: true })
  const count = await Region.count()
  console.log(`[OK] ${count} régions en base`)
  await sequelize.close()
}

main().catch(async err => {
  console.error('[FATAL]', err.message)
  try { await sequelize.close() } catch (_) {}
  process.exit(1)
})
