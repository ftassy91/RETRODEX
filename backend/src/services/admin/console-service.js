'use strict'
// DATA: Sequelize via ../../models and admin game-read helpers - not part of the canonical public runtime
// ROLE: admin console read-model orchestration for curation and enrichment workflows
// CONSUMERS: curation-service and enrichment-backlog-service
// STATUS: isolated admin service; keep focused on console payload composition and listings

const { Op } = require('sequelize')

const Console = require('../../models/Console')
const { getConsoleById, getRelatedConsoles, normalizeConsoleKey } = require('../../lib/consoles')
const {
  buildNameVariants,
  computeConsoleQuality,
  toGamePayload,
  matchNotableGames,
  getStaticNameVariants,
  buildMarketPayload,
  buildOverviewPayload,
  buildHardwarePayload,
  buildSourcesPayload,
} = require('./console-profile')
const {
  listHydratedGames,
  listHydratedGamesByConsole,
} = require('./game-read-service')

async function findConsoleRecord(idOrSlug) {
  const needle = String(idOrSlug || '').trim()
  if (!needle) {
    return null
  }

  let consoleRecord = await Console.findOne({
    where: {
      [Op.or]: [
        { id: needle },
        { slug: needle },
      ],
    },
  })

  if (consoleRecord) {
    return consoleRecord
  }

  const normalizedNeedle = normalizeConsoleKey(needle)
  const records = await Console.findAll({
    attributes: ['id', 'name', 'manufacturer', 'generation', 'releaseYear', 'slug'],
  })

  return records.find((record) => (
    normalizeConsoleKey(record.name) === normalizedNeedle
    || normalizeConsoleKey(record.slug) === normalizedNeedle
    || normalizeConsoleKey(record.id) === normalizedNeedle
  )) || null
}

async function loadConsoleGames(consoleRecord, knowledgeEntry, limit = 24, { publishedOnly = false } = {}) {
  const names = buildNameVariants(consoleRecord, knowledgeEntry)
  const payload = await listHydratedGamesByConsole(consoleRecord, {
    nameVariants: names,
    limit,
    sort: 'year_asc',
    publishedOnly,
  })

  return {
    total: payload.total,
    items: (payload.items || []).map((game) => toGamePayload(game)),
  }
}

async function buildConsolePayload(idOrSlug, { gamesLimit = 24, publishedOnly = false } = {}) {
  const consoleRecord = await findConsoleRecord(idOrSlug)
  if (!consoleRecord) {
    return null
  }

  const knowledgeEntry = getConsoleById(consoleRecord.slug || consoleRecord.name || consoleRecord.id)
  const gamesBundle = await loadConsoleGames(consoleRecord, knowledgeEntry, gamesLimit, { publishedOnly })
  if (publishedOnly && Number(gamesBundle.total || 0) <= 0) {
    return null
  }
  const market = buildMarketPayload(gamesBundle.items, gamesBundle.total)
  const overview = buildOverviewPayload(consoleRecord, knowledgeEntry, market)
  const hardware = buildHardwarePayload(consoleRecord, knowledgeEntry)
  const sources = buildSourcesPayload(consoleRecord, knowledgeEntry, market)
  const quality = computeConsoleQuality({
    consoleRecord,
    knowledgeEntry,
    gamesCount: gamesBundle.total,
    pricedGamesCount: market.pricedGames,
    sources,
  })

  return {
    console: {
      id: consoleRecord.id,
      slug: consoleRecord.slug,
      name: consoleRecord.name,
      manufacturer: consoleRecord.manufacturer,
      generation: consoleRecord.generation,
      releaseYear: consoleRecord.releaseYear,
      summary: overview.summary,
      gamesCount: gamesBundle.total,
      shortTechnicalIdentity: overview.shortTechnicalIdentity,
      imageRef: knowledgeEntry?.id || consoleRecord.slug,
    },
    overview,
    market,
    games: gamesBundle.items,
    hardware,
    quality,
    sources,
    relatedConsoles: getRelatedConsoles(knowledgeEntry, 4).map((entry) => ({
      id: entry.id,
      name: entry.name,
      manufacturer: entry.manufacturer,
      releaseYear: entry.release_year,
    })),
    notableGames: matchNotableGames(knowledgeEntry?.legacy?.notable_games || [], gamesBundle.items),
  }
}

async function listConsoleItems({ publishedOnly = false } = {}) {
  const consoleRecords = await Console.findAll({
    attributes: ['id', 'name', 'manufacturer', 'generation', 'releaseYear', 'slug'],
    order: [['name', 'ASC']],
  })
  const catalog = await listHydratedGames({
    limit: 5000,
    offset: 0,
    publishedOnly,
  })
  const games = catalog.items || []

  const countsById = new Map()
  const countsByName = new Map()
  const pricedById = new Map()
  const pricedByName = new Map()

  for (const game of games) {
    const isPriced = Number(game.loosePrice || game.cibPrice || game.mintPrice) > 0
    if (game.consoleId) {
      const key = String(game.consoleId)
      countsById.set(key, (countsById.get(key) || 0) + 1)
      if (isPriced) {
        pricedById.set(key, (pricedById.get(key) || 0) + 1)
      }
    }

    if (game.console) {
      const key = String(game.console)
      countsByName.set(key, (countsByName.get(key) || 0) + 1)
      if (isPriced) {
        pricedByName.set(key, (pricedByName.get(key) || 0) + 1)
      }
    }
  }

  const items = consoleRecords.map((record) => {
    const plain = record.get({ plain: true })
    const knowledgeEntry = getConsoleById(plain.slug || plain.name || plain.id)
    const gamesCount = countsById.get(String(plain.id))
      || countsByName.get(String(plain.name))
      || countsByName.get(String(getStaticNameVariants(plain.id)[0] || ''))
      || 0
    const pricedGamesCount = pricedById.get(String(plain.id))
      || pricedByName.get(String(plain.name))
      || pricedByName.get(String(getStaticNameVariants(plain.id)[0] || ''))
      || 0
    const sources = buildSourcesPayload(plain, knowledgeEntry, { pricedGames: pricedGamesCount })
    const quality = computeConsoleQuality({
      consoleRecord: plain,
      knowledgeEntry,
      gamesCount,
      pricedGamesCount,
      sources,
    })

    return {
      id: plain.id,
      slug: plain.slug,
      name: plain.name,
      manufacturer: plain.manufacturer,
      generation: plain.generation,
      releaseYear: plain.releaseYear,
      gamesCount,
      shortTechnicalIdentity: knowledgeEntry?.technical_specs?.media || null,
      summary: knowledgeEntry?.overview || null,
      quality,
    }
  })

  return publishedOnly
    ? items.filter((item) => Number(item.gamesCount || 0) > 0)
    : items
}

module.exports = {
  buildConsolePayload,
  listConsoleItems,
}
