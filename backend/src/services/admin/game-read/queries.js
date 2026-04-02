'use strict'

const { Op } = require('sequelize')

const Game = require('../../../models/Game')
const { getPublishedGameScope } = require('../../publication-service')

const {
  BASE_GAME_ATTRIBUTES,
  getSelectableGameAttributes,
} = require('./schema')
const {
  mergeGameRecord,
  hydrateGameRows,
} = require('./hydration')
const { loadCanonicalSupplements } = require('./supplements')

function normalizeSearchValue(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function rarityRankDescending(value) {
  switch (String(value || '').toUpperCase()) {
    case 'LEGENDARY': return 0
    case 'EPIC': return 1
    case 'RARE': return 2
    case 'UNCOMMON': return 3
    case 'COMMON': return 4
    default: return 5
  }
}

function rarityRankAscending(value) {
  switch (String(value || '').toUpperCase()) {
    case 'COMMON': return 0
    case 'UNCOMMON': return 1
    case 'RARE': return 2
    case 'EPIC': return 3
    case 'LEGENDARY': return 4
    default: return 5
  }
}

function compareNullableNumbers(left, right, ascending = true) {
  const leftEmpty = left == null || String(left).trim() === ''
  const rightEmpty = right == null || String(right).trim() === ''
  const leftNumber = Number(left)
  const rightNumber = Number(right)
  const leftMissing = leftEmpty || !Number.isFinite(leftNumber)
  const rightMissing = rightEmpty || !Number.isFinite(rightNumber)

  if (leftMissing && rightMissing) return 0
  if (leftMissing) return 1
  if (rightMissing) return -1

  return ascending ? leftNumber - rightNumber : rightNumber - leftNumber
}

function compareGamesForSort(leftGame, rightGame, sortKey) {
  const left = leftGame || {}
  const right = rightGame || {}
  const leftTitle = String(left.title || '')
  const rightTitle = String(right.title || '')

  switch (String(sortKey || '').trim()) {
    case 'title_desc':
      return rightTitle.localeCompare(leftTitle, 'fr', { sensitivity: 'base' })
    case 'price_asc':
      return compareNullableNumbers(left.loosePrice, right.loosePrice, true)
        || leftTitle.localeCompare(rightTitle, 'fr', { sensitivity: 'base' })
    case 'price_desc':
      return compareNullableNumbers(left.loosePrice, right.loosePrice, false)
        || leftTitle.localeCompare(rightTitle, 'fr', { sensitivity: 'base' })
    case 'year_asc':
      return compareNullableNumbers(left.year, right.year, true)
        || leftTitle.localeCompare(rightTitle, 'fr', { sensitivity: 'base' })
    case 'year_desc':
      return compareNullableNumbers(left.year, right.year, false)
        || leftTitle.localeCompare(rightTitle, 'fr', { sensitivity: 'base' })
    case 'meta_asc':
    case 'metascore_asc':
      return compareNullableNumbers(left.metascore, right.metascore, true)
        || leftTitle.localeCompare(rightTitle, 'fr', { sensitivity: 'base' })
    case 'meta_desc':
    case 'metascore_desc':
      return compareNullableNumbers(left.metascore, right.metascore, false)
        || leftTitle.localeCompare(rightTitle, 'fr', { sensitivity: 'base' })
    case 'rarity_desc':
      return rarityRankDescending(left.rarity) - rarityRankDescending(right.rarity)
        || compareNullableNumbers(left.loosePrice, right.loosePrice, false)
        || leftTitle.localeCompare(rightTitle, 'fr', { sensitivity: 'base' })
    case 'rarity_asc':
      return rarityRankAscending(left.rarity) - rarityRankAscending(right.rarity)
        || leftTitle.localeCompare(rightTitle, 'fr', { sensitivity: 'base' })
    case 'title_asc':
    default:
      return leftTitle.localeCompare(rightTitle, 'fr', { sensitivity: 'base' })
  }
}

function matchesSearch(game, search) {
  const query = normalizeSearchValue(search)
  if (!query) {
    return true
  }

  const fields = [
    game.title,
    game.developer,
    game.console,
    game.genre,
    game.summary,
    game.synopsis,
    game.lore,
    game.gameplay_description,
    game.tagline,
  ]

  return fields.some((value) => normalizeSearchValue(value).includes(query))
}

function matchesGenre(game, genreValue) {
  const genre = normalizeSearchValue(genreValue)
  if (!genre) {
    return true
  }
  return normalizeSearchValue(game.genre).includes(genre)
}

async function applyPublishedScope(games, options = {}) {
  if (!options.publishedOnly) {
    return games
  }

  const scope = await getPublishedGameScope({
    passKey: options.passKey || null,
  })

  if (!scope.enabled || !scope.ids.length) {
    return games
  }

  return (games || []).filter((game) => scope.set.has(String(game?.id || '')))
}

async function listHydratedGames(options = {}) {
  const limit = Math.max(1, Math.min(Number(options.limit || 20) || 20, 5000))
  const offset = Math.max(0, Number(options.offset || 0) || 0)
  const where = { type: 'game' }
  const selectableAttributes = await getSelectableGameAttributes(BASE_GAME_ATTRIBUTES)

  if (options.consoleId) {
    where.consoleId = String(options.consoleId)
  }
  if (options.consoleName) {
    where.console = String(options.consoleName)
  }
  if (options.franchiseId) {
    where.franch_id = String(options.franchiseId)
  }
  if (Array.isArray(options.ids) && options.ids.length) {
    where.id = {
      [Op.in]: Array.from(new Set(options.ids.filter(Boolean).map((value) => String(value)))),
    }
  }
  if (options.rarity) {
    where.rarity = String(options.rarity)
  }

  const rows = await Game.findAll({
    where,
    attributes: selectableAttributes,
  })

  let games = await hydrateGameRows(rows)

  games = await applyPublishedScope(games, options)

  if (options.search) {
    games = games.filter((game) => matchesSearch(game, options.search))
  }

  if (options.genreName) {
    games = games.filter((game) => matchesGenre(game, options.genreName))
  }

  games.sort((left, right) => compareGamesForSort(left, right, options.sort))

  const total = games.length
  const items = games.slice(offset, offset + limit)

  return {
    items,
    returned: items.length,
    total,
  }
}

async function getRandomHydratedGame(options = {}) {
  const payload = await listHydratedGames({
    ...options,
    limit: 5000,
    offset: 0,
  })

  if (!payload.items.length) {
    return null
  }

  const index = Math.floor(Math.random() * payload.items.length)
  return payload.items[index] || null
}

async function getHydratedGameById(gameId) {
  const selectableAttributes = await getSelectableGameAttributes(BASE_GAME_ATTRIBUTES)
  const record = await Game.findOne({
    where: { id: gameId },
    attributes: selectableAttributes,
  })
  if (!record) {
    return null
  }

  const supplement = await loadCanonicalSupplements(gameId)
  return mergeGameRecord(record.get({ plain: true }), supplement)
}

async function getHydratedGameByLookup(lookup) {
  const needle = String(lookup || '').trim()
  if (!needle) {
    return null
  }

  const selectableAttributes = await getSelectableGameAttributes(BASE_GAME_ATTRIBUTES)

  const record = await Game.findOne({
    where: {
      [Op.or]: [
        { id: needle },
        { slug: needle },
      ],
    },
    attributes: selectableAttributes,
  })

  if (!record) {
    return null
  }

  const supplement = await loadCanonicalSupplements(record.id)
  return mergeGameRecord(record.get({ plain: true }), supplement)
}

async function getHydratedGamesByIds(gameIds = [], { preserveOrder = true } = {}) {
  const ids = Array.from(new Set((gameIds || []).filter(Boolean).map((value) => String(value))))
  if (!ids.length) {
    return []
  }

  const selectableAttributes = await getSelectableGameAttributes(BASE_GAME_ATTRIBUTES)

  const rows = await Game.findAll({
    where: {
      id: {
        [Op.in]: ids,
      },
    },
    attributes: selectableAttributes,
  })

  const hydratedRows = await hydrateGameRows(rows)
  if (!preserveOrder) {
    return hydratedRows
  }

  const byId = new Map(hydratedRows.map((row) => [String(row.id), row]))
  return ids.map((id) => byId.get(String(id))).filter(Boolean)
}

async function listHydratedGamesByConsole(consoleRecord, options = {}) {
  const consoleId = consoleRecord?.id ? String(consoleRecord.id) : null
  const nameVariants = Array.from(new Set((options.nameVariants || [])
    .filter(Boolean)
    .map((value) => String(value))))
  const whereOr = []

  if (consoleId) {
    whereOr.push({ consoleId })
  }
  if (nameVariants.length) {
    whereOr.push({ console: { [Op.in]: nameVariants } })
  }

  if (!whereOr.length) {
    return {
      items: [],
      returned: 0,
      total: 0,
    }
  }

  const selectableAttributes = await getSelectableGameAttributes(BASE_GAME_ATTRIBUTES)

  const rows = await Game.findAll({
    where: {
      type: 'game',
      [Op.or]: whereOr,
    },
    attributes: selectableAttributes,
  })

  let items = await hydrateGameRows(rows)
  items = await applyPublishedScope(items, options)
  items.sort((left, right) => compareGamesForSort(left, right, options.sort))

  const offset = Math.max(0, Number(options.offset || 0) || 0)
  const limit = Math.max(1, Math.min(Number(options.limit || 24) || 24, 5000))
  const total = items.length

  return {
    items: items.slice(offset, offset + limit),
    returned: Math.max(0, Math.min(limit, total - offset)),
    total,
  }
}

async function listHydratedGamesByFranchise(franchiseId, options = {}) {
  return listHydratedGames({
    ...options,
    franchiseId,
  })
}

module.exports = {
  listHydratedGames,
  getRandomHydratedGame,
  getHydratedGameById,
  getHydratedGameByLookup,
  getHydratedGamesByIds,
  listHydratedGamesByConsole,
  listHydratedGamesByFranchise,
}
