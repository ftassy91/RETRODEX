'use strict'
// DATA: Sequelize via ../models and legacy game-read helpers - not part of the canonical public runtime
// ROLE: legacy/back-office console payloads and related item listings
// CONSUMERS: curation-service and enrichment-backlog-service
// STATUS: retained non-canonical service; keep until console legacy/admin scope is reviewed separately

const { Op } = require('sequelize')

const Console = require('../models/Console')
const { getConsoleById, getRelatedConsoles, normalizeConsoleKey } = require('../lib/consoles')
const {
  listHydratedGames,
  listHydratedGamesByConsole,
} = require('./game-read-service')

const NAME_VARIANTS = {
  amiga: ['Amiga'],
  atari2600: ['Atari 2600'],
  lynx: ['Atari Lynx', 'Lynx'],
  atarist: ['Atari ST'],
  c64: ['Commodore 64', 'C64'],
  gb: ['Game Boy'],
  gba: ['Game Boy Advance', 'GBA'],
  gbc: ['Game Boy Color', 'GBC'],
  gg: ['Game Gear'],
  gc: ['GameCube', 'Nintendo GameCube'],
  msx: ['MSX'],
  nes: ['NES', 'Nintendo Entertainment System'],
  neogeo: ['Neo Geo', 'Neo-Geo'],
  n64: ['Nintendo 64', 'N64'],
  nds: ['Nintendo DS', 'DS'],
  ps1: ['PlayStation', 'Sony PlayStation', 'PS1', 'PSX'],
  ps2: ['PlayStation 2', 'PS2'],
  snes: ['SNES', 'Super Nintendo', 'Super Nintendo Entertainment System'],
  scd: ['Sega CD', 'Mega-CD'],
  dc: ['Dreamcast', 'Sega Dreamcast'],
  sms: ['Sega Master System', 'Master System'],
  md: ['Sega Mega Drive', 'Sega Genesis', 'Mega Drive', 'Genesis'],
  sat: ['Sega Saturn', 'Saturn'],
  tg16: ['TurboGrafx-16', 'PC Engine'],
  ws: ['WonderSwan'],
}

function parseMaybeJson(value, fallback = null) {
  if (value == null || value === '') {
    return fallback
  }

  if (Array.isArray(value) || typeof value === 'object') {
    return value
  }

  if (typeof value !== 'string') {
    return fallback
  }

  try {
    return JSON.parse(value)
  } catch (_error) {
    return fallback
  }
}

function roundNumber(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) {
    return null
  }

  return Math.round(number * 100) / 100
}

function average(values) {
  const numbers = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0)

  if (!numbers.length) {
    return null
  }

  return roundNumber(numbers.reduce((sum, value) => sum + value, 0) / numbers.length)
}

function toTier(score) {
  if (score >= 85) return 'Tier A'
  if (score >= 70) return 'Tier B'
  if (score >= 50) return 'Tier C'
  return 'Tier D'
}

function buildNameVariants(consoleRecord, knowledgeEntry) {
  const variants = new Set()
  const add = (value) => {
    if (!value) return
    variants.add(String(value))
  }

  add(consoleRecord?.name)
  add(knowledgeEntry?.name)
  add(consoleRecord?.slug)
  add(consoleRecord?.id)

  const staticVariants = NAME_VARIANTS[String(consoleRecord?.id || '')] || []
  for (const value of staticVariants) {
    add(value)
  }

  if (knowledgeEntry?.legacy?.notable_games?.length) {
    // no-op: keeps function signature extensible without mixing knowledge titles in name matching
  }

  return Array.from(variants)
}

function computeConsoleQuality({ consoleRecord, knowledgeEntry, gamesCount, pricedGamesCount, sources }) {
  const missingCriticalFields = []
  const identityFields = [
    ['name', consoleRecord?.name],
    ['manufacturer', consoleRecord?.manufacturer],
    ['releaseYear', consoleRecord?.releaseYear],
    ['slug', consoleRecord?.slug],
  ]

  const editorialFields = [
    ['overview', knowledgeEntry?.overview],
    ['development.context', knowledgeEntry?.development?.context],
    ['technical_specs.cpu', knowledgeEntry?.technical_specs?.cpu],
    ['technical_specs.media', knowledgeEntry?.technical_specs?.media],
  ]

  const identityScore = Math.round((identityFields.filter(([, value]) => Boolean(value)).length / identityFields.length) * 100)
  const editorialScore = Math.round((editorialFields.filter(([, value]) => Boolean(value)).length / editorialFields.length) * 100)
  const marketScore = gamesCount > 0
    ? Math.min(100, Math.round((pricedGamesCount / Math.max(gamesCount, 1)) * 70) + (pricedGamesCount > 0 ? 20 : 0) + (gamesCount >= 25 ? 10 : 0))
    : 0
  const sourceCoverage = Math.min(100, sources.length * 40)
  const structuralConsistency = consoleRecord?.id && consoleRecord?.slug ? 100 : 50

  for (const [key, value] of identityFields) {
    if (!value) {
      missingCriticalFields.push(key)
    }
  }

  if (!knowledgeEntry?.overview) {
    missingCriticalFields.push('overview')
  }

  const score = Math.round(
    (identityScore * 0.30)
    + (marketScore * 0.25)
    + (sourceCoverage * 0.20)
    + (editorialScore * 0.15)
    + (structuralConsistency * 0.10)
  )

  return {
    score,
    tier: toTier(score),
    completeness: Math.round((identityScore + editorialScore) / 2),
    confidence: Math.round((sourceCoverage + structuralConsistency) / 2),
    sourceCoverage,
    freshness: null,
    missingCriticalFields,
    breakdown: {
      identity: identityScore,
      market: marketScore,
      sourceTrust: sourceCoverage,
      editorial: editorialScore,
      structural: structuralConsistency,
    },
  }
}

function toGamePayload(game) {
  return {
    id: game.id,
    title: game.title,
    console: game.console,
    year: game.year,
    rarity: game.rarity || null,
    metascore: game.metascore ?? null,
    loosePrice: roundNumber(game.loosePrice),
    cibPrice: roundNumber(game.cibPrice),
    mintPrice: roundNumber(game.mintPrice),
    coverImage: game.cover_url || game.coverImage || null,
    developer: game.developer || null,
    summary: game.summary || null,
  }
}

function matchNotableGames(names, games) {
  if (!Array.isArray(names) || !names.length) {
    return []
  }

  const normalizedGames = games.map((game) => ({
    ...game,
    _normalizedTitle: normalizeConsoleKey(game.title),
  }))

  return names.slice(0, 8).map((name) => {
    const normalizedName = normalizeConsoleKey(name)
    const matched = normalizedGames.find((game) => (
      game._normalizedTitle === normalizedName
      || game._normalizedTitle.includes(normalizedName)
      || normalizedName.includes(game._normalizedTitle)
    ))

    return {
      title: name,
      game: matched ? {
        id: matched.id,
        title: matched.title,
        year: matched.year,
      } : null,
    }
  })
}

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

function buildMarketPayload(games, totalGames) {
  const pricedGames = games.filter((game) => Number(game.loosePrice || game.cibPrice || game.mintPrice) > 0)
  const looseValues = games.map((game) => game.loosePrice)
  const cibValues = games.map((game) => game.cibPrice)
  const mintValues = games.map((game) => game.mintPrice)
  const legendaryCount = games.filter((game) => game.rarity === 'LEGENDARY').length
  const epicCount = games.filter((game) => game.rarity === 'EPIC').length

  return {
    gamesCount: totalGames,
    pricedGames: pricedGames.length,
    priceCoverage: totalGames > 0 ? Math.round((pricedGames.length / totalGames) * 100) : 0,
    avgLoose: average(looseValues),
    avgCib: average(cibValues),
    avgMint: average(mintValues),
    legendaryCount,
    epicCount,
  }
}

function buildOverviewPayload(consoleRecord, knowledgeEntry, market) {
  const technicalSpecs = knowledgeEntry?.technical_specs || {}
  return {
    summary: knowledgeEntry?.overview || null,
    generation: knowledgeEntry?.generation || consoleRecord?.generation || null,
    development: knowledgeEntry?.development || null,
    team: knowledgeEntry?.team || [],
    technicalSpecs,
    legacy: knowledgeEntry?.legacy || null,
    anecdotes: knowledgeEntry?.anecdotes || [],
    shortTechnicalIdentity: [
      technicalSpecs.cpu,
      technicalSpecs.gpu,
      technicalSpecs.media,
    ].filter(Boolean).join(' | ') || null,
    marketNotes: knowledgeEntry?.market || null,
    marketCoverage: market.priceCoverage,
  }
}

function buildHardwarePayload(consoleRecord, knowledgeEntry) {
  const technicalSpecs = knowledgeEntry?.technical_specs || {}
  return {
    referenceId: knowledgeEntry?.id || consoleRecord?.slug || consoleRecord?.id,
    cpu: technicalSpecs.cpu || null,
    gpu: technicalSpecs.gpu || null,
    memory: technicalSpecs.memory || null,
    media: technicalSpecs.media || null,
    notableFeatures: technicalSpecs.notable_features || [],
    mods: [],
  }
}

function buildSourcesPayload(consoleRecord, knowledgeEntry, market) {
  const sources = [
    {
      id: 'retrodex-console-registry',
      label: 'RETRODEX console registry',
      type: 'internal_table',
      status: 'approved',
      lastVerifiedAt: null,
    },
  ]

  if (knowledgeEntry) {
    sources.push({
      id: 'retrodex-curated-console-notes',
      label: 'RETRODEX curated hardware notes',
      type: 'curated_reference',
      status: 'approved',
      lastVerifiedAt: null,
    })
  }

  if (market.pricedGames > 0) {
    sources.push({
      id: 'retrodex-market-derived',
      label: 'RETRODEX catalog market derivation',
      type: 'derived_internal',
      status: 'approved',
      lastVerifiedAt: null,
    })
  }

  return sources
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
      || countsByName.get(String((NAME_VARIANTS[plain.id] || [])[0] || ''))
      || 0
    const pricedGamesCount = pricedById.get(String(plain.id))
      || pricedByName.get(String(plain.name))
      || pricedByName.get(String((NAME_VARIANTS[plain.id] || [])[0] || ''))
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
