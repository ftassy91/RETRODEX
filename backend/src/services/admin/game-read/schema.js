'use strict'

const Game = require('../../../models/Game')
const { sequelize } = require('../../../database')

const BASE_GAME_ATTRIBUTES = [
  'id',
  'type',
  'title',
  'console',
  'consoleId',
  'year',
  'developer',
  'developerId',
  'publisherId',
  'genre',
  'metascore',
  'rarity',
  'summary',
  'synopsis',
  'tagline',
  'cover_url',
  'coverImage',
  'franch_id',
  'dev_anecdotes',
  'dev_team',
  'cheat_codes',
  'source_confidence',
  'loosePrice',
  'cibPrice',
  'mintPrice',
  'releaseDate',
  'lore',
  'gameplay_description',
  'characters',
  'manual_url',
  'youtube_id',
  'youtube_verified',
  'archive_id',
  'archive_verified',
  'ost_composers',
  'ost_notable_tracks',
  'versions',
  'avg_duration_main',
  'avg_duration_complete',
  'speedrun_wr',
  'slug',
]

function tableNamesMatch(tableName, target) {
  return String(tableName || '').replace(/"/g, '').toLowerCase() === String(target).toLowerCase()
}

let tableNamesPromise = null
let gameColumnsPromise = null

async function getTableNames() {
  if (!tableNamesPromise) {
    tableNamesPromise = sequelize.getQueryInterface()
      .showAllTables()
      .then((tables) => new Set((tables || []).map((tableName) => String(tableName || '').replace(/"/g, '').toLowerCase())))
      .catch(() => new Set())
  }

  return tableNamesPromise
}

async function tableExists(target) {
  const tables = await getTableNames()
  return tables.has(String(target || '').toLowerCase())
}

async function getGameColumnNames() {
  if (!gameColumnsPromise) {
    gameColumnsPromise = sequelize.getQueryInterface()
      .describeTable('games')
      .then((columns) => new Set(Object.keys(columns || {}).map((name) => String(name || '').toLowerCase())))
      .catch(() => new Set())
  }

  return gameColumnsPromise
}

async function getSelectableGameAttributes(attributes = BASE_GAME_ATTRIBUTES) {
  const columns = await getGameColumnNames()
  if (!columns.size) {
    return attributes.filter((attribute) => attribute !== 'coverImage')
  }

  return attributes.filter((attribute) => {
    const field = Game.rawAttributes?.[attribute]?.field || attribute
    return columns.has(String(field || '').toLowerCase())
  })
}

module.exports = {
  BASE_GAME_ATTRIBUTES,
  tableNamesMatch,
  getTableNames,
  tableExists,
  getGameColumnNames,
  getSelectableGameAttributes,
}
