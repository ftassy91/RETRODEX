'use strict'

const path = require('path')
const { sequelize } = require(path.join(__dirname, '../../backend/src/database'))
const Franchise = require(path.join(__dirname, '../../backend/src/models/Franchise'))
const data = require(path.join(__dirname, '../../data/franchises_seed.json'))

async function main() {
  await Franchise.sync({ alter: true })
  let ok = 0

  for (const entry of data) {
    await Franchise.upsert({
      ...entry,
      genres:       JSON.stringify(entry.genres),
      platforms:    JSON.stringify(entry.platforms),
      timeline:     JSON.stringify(entry.timeline),
      team_changes: JSON.stringify(entry.team_changes),
      trivia:       JSON.stringify(entry.trivia)
    })
    console.log(`[OK] ${entry.name}`)
    ok++
  }

  console.log(`\nFranchises seedées : ${ok}`)
  await sequelize.close()
}

main().catch(err => { console.error('[FATAL]', err.message); process.exit(1) })
