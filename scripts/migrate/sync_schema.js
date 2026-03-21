'use strict'
const path = require('path')
const db = require(path.join(__dirname, '../../backend/config/database'))
const sequelize = db.sequelize || db
const ConsoleVariant = require(path.join(__dirname, '../../backend/src/models/ConsoleVariant'))
const Accessory = require(path.join(__dirname, '../../backend/src/models/Accessory'))
const OST = require(path.join(__dirname, '../../backend/src/models/OST'))
const CollectorEdition = require(path.join(__dirname, '../../backend/src/models/CollectorEdition'))
const CRTDisplay = require(path.join(__dirname, '../../backend/src/models/CRTDisplay'))

async function main() {
  await ConsoleVariant.sync({ alter: true })
  console.log('[OK] table console_variants créée')
  await Accessory.sync({ alter: true })
  console.log('[OK] table accessories créée')
  await OST.sync({ alter: true })
  console.log('[OK] table osts créée')
  await CollectorEdition.sync({ alter: true })
  console.log('[OK] table collector_editions créée')
  await CRTDisplay.sync({ alter: true })
  console.log('[OK] table crt_displays créée')
  await sequelize.close()
}

main().catch(async err => {
  console.error('[FATAL]', err.message)
  try {
    await sequelize.close()
  } catch (_) {}
  process.exit(1)
})
