'use strict'

const path = require('path')
const fs = require('fs')

const ROOT = path.join(__dirname, '../..')
const sequelize = require(path.join(ROOT, 'backend', 'config', 'database'))
const Game = require(path.join(ROOT, 'backend', 'src', 'models', 'Game'))
const Franchise = require(path.join(ROOT, 'backend', 'src', 'models', 'Franchise'))
const RetrodexIndex = require(path.join(ROOT, 'backend', 'models', 'RetrodexIndex'))

function readExport(filename) {
  const filePath = path.join(ROOT, 'data', 'exports', filename)
  if (!fs.existsSync(filePath)) {
    throw new Error(`Export file missing: ${filePath}`)
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function stringifyIfNeeded(value) {
  if (value == null) {
    return null
  }

  return typeof value === 'string' ? value : JSON.stringify(value)
}

function summarizeByType(items) {
  return items.reduce((summary, item) => {
    const type = item.type || 'unknown'
    summary[type] = (summary[type] || 0) + 1
    return summary
  }, {})
}

async function main() {
  await sequelize.sync({ alter: false })

  const games = readExport('games_export.json')
  const franchises = readExport('franchises_export.json')
  const indexEntries = readExport('index_export.json')
  const gamesByType = summarizeByType(games)

  for (const game of games) {
    await Game.upsert(game)
  }
  console.log(`[OK] ${games.length} lignes Game importees`)
  console.log(`[OK] Detail Game: ${Object.entries(gamesByType).map(([type, count]) => `${type}=${count}`).join(', ')}`)

  for (const franchise of franchises) {
    await Franchise.upsert({
      ...franchise,
      genres: stringifyIfNeeded(franchise.genres),
      platforms: stringifyIfNeeded(franchise.platforms),
      timeline: stringifyIfNeeded(franchise.timeline),
      team_changes: stringifyIfNeeded(franchise.team_changes),
      trivia: stringifyIfNeeded(franchise.trivia),
    })
  }
  console.log(`[OK] ${franchises.length} franchises importees`)

  for (const entry of indexEntries) {
    await RetrodexIndex.upsert(entry)
  }
  console.log(`[OK] ${indexEntries.length} index importes`)

  await sequelize.close()
}

main().catch(async (err) => {
  console.error('[FATAL]', err.message)
  try {
    await sequelize.close()
  } catch (_error) {}
  process.exit(1)
})
