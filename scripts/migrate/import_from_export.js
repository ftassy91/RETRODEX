'use strict'

const path = require('path')
const fs = require('fs')

const ROOT = path.join(__dirname, '../..')
const sequelize = require(path.join(ROOT, 'backend', 'config', 'database'))
const DataTypes = sequelize.Sequelize
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

async function buildFranchiseImporter() {
  const queryInterface = sequelize.getQueryInterface()
  let table = {}

  try {
    table = await queryInterface.describeTable('franchises')
  } catch (_error) {
    table = {}
  }

  const hasLegacyTimestamps = !!table.created_at || !!table.updated_at
  if (!hasLegacyTimestamps) {
    return { Model: Franchise, hasLegacyTimestamps: false }
  }

  const FranchiseImport = sequelize.define('FranchiseImport', {
    id:           { type: DataTypes.STRING, primaryKey: true },
    name:         { type: DataTypes.STRING, allowNull: false },
    slug:         { type: DataTypes.STRING, allowNull: false, unique: true },
    description:  { type: DataTypes.TEXT },
    first_game:   { type: DataTypes.INTEGER },
    last_game:    { type: DataTypes.INTEGER },
    developer:    { type: DataTypes.STRING },
    publisher:    { type: DataTypes.STRING },
    genres:       { type: DataTypes.TEXT },
    platforms:    { type: DataTypes.TEXT },
    timeline:     { type: DataTypes.TEXT },
    team_changes: { type: DataTypes.TEXT },
    trivia:       { type: DataTypes.TEXT },
    legacy:       { type: DataTypes.TEXT },
    created_at:   { type: DataTypes.DATE, allowNull: false },
    updated_at:   { type: DataTypes.DATE, allowNull: false },
  }, { tableName: 'franchises', timestamps: false })

  return { Model: FranchiseImport, hasLegacyTimestamps: true }
}

async function main() {
  await sequelize.sync({ alter: false })

  const games = readExport('games_export.json')
  const franchises = readExport('franchises_export.json')
  const indexEntries = readExport('index_export.json')
  const gamesByType = summarizeByType(games)
  const franchiseImporter = await buildFranchiseImporter()

  for (const game of games) {
    await Game.upsert(game)
  }
  console.log(`[OK] ${games.length} lignes Game importees`)
  console.log(`[OK] Detail Game: ${Object.entries(gamesByType).map(([type, count]) => `${type}=${count}`).join(', ')}`)

  for (const franchise of franchises) {
    const payload = {
      ...franchise,
      genres: stringifyIfNeeded(franchise.genres),
      platforms: stringifyIfNeeded(franchise.platforms),
      timeline: stringifyIfNeeded(franchise.timeline),
      team_changes: stringifyIfNeeded(franchise.team_changes),
      trivia: stringifyIfNeeded(franchise.trivia),
    }

    if (franchiseImporter.hasLegacyTimestamps) {
      const now = new Date()
      payload.created_at = franchise.created_at || franchise.createdAt || now
      payload.updated_at = franchise.updated_at || franchise.updatedAt || now
    }

    await franchiseImporter.Model.upsert(payload)
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
