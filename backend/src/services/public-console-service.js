'use strict'

const { db } = require('../../db_supabase')
const { getConsoleById, listConsoles, normalizeConsoleKey } = require('../lib/consoles')
const { normalizeGameRecord } = require('../lib/normalize')
const { isMissingSupabaseRelationError } = require('./public-supabase-utils')
const { fetchAllSupabaseGames } = require('./public-game-reader')
const { fetchPublishedGameScope, filterPublishedGames } = require('./public-publication-service')

function roundConsoleNumber(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) {
    return null
  }

  return Math.round(number * 100) / 100
}

function averageConsoleValues(values) {
  const numbers = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0)

  if (!numbers.length) {
    return null
  }

  return roundConsoleNumber(numbers.reduce((sum, value) => sum + value, 0) / numbers.length)
}

function toConsoleTier(score) {
  if (score >= 85) return 'Tier A'
  if (score >= 70) return 'Tier B'
  if (score >= 50) return 'Tier C'
  return 'Tier D'
}

function buildStaticConsoleRecord(entry) {
  return {
    id: entry.id,
    slug: entry.id,
    name: entry.name,
    title: entry.name,
    platform: entry.name,
    manufacturer: entry.manufacturer || null,
    releaseYear: entry.release_year ?? null,
    generation: entry.generation || null,
    summary: entry.overview || null,
    mediaType: entry?.technical_specs?.media || null,
    overview: entry.overview || null,
    development: entry.development || null,
    team: entry.team || [],
    technicalSpecs: entry.technical_specs || {},
    legacy: entry.legacy || null,
    anecdotes: entry.anecdotes || [],
    marketNotes: entry.market || null,
    knowledgeEntry: entry,
  }
}

function buildPublishedConsoleRecord(row) {
  const knowledgeEntry = getConsoleById(row.id) || getConsoleById(row.title) || getConsoleById(row.platform)
  const fallback = knowledgeEntry ? buildStaticConsoleRecord(knowledgeEntry) : {}
  const name = row.title || row.platform || fallback.name || row.id
  return {
    ...fallback,
    id: row.id || fallback.id || normalizeConsoleKey(name),
    slug: fallback.slug || normalizeConsoleKey(name),
    name,
    title: name,
    platform: row.platform || name,
    manufacturer: row.manufacturer || fallback.manufacturer || null,
    releaseYear: row.year ?? fallback.releaseYear ?? null,
    mediaType: row.media_type || fallback.mediaType || null,
    knowledgeEntry: knowledgeEntry || fallback.knowledgeEntry || null,
  }
}

function buildConsoleAliases(consoleItem) {
  const values = [
    consoleItem?.id,
    consoleItem?.slug,
    consoleItem?.name,
    consoleItem?.title,
    consoleItem?.platform,
    consoleItem?.knowledgeEntry?.id,
    consoleItem?.knowledgeEntry?.name,
  ]

  const primaryName = normalizeConsoleKey(consoleItem?.name || consoleItem?.platform || consoleItem?.title)
  if (primaryName === 'super-nintendo' || primaryName === 'snes') {
    values.push('SNES', 'Super Nintendo', 'Super Nintendo Entertainment System')
  }
  if (primaryName === 'nes' || primaryName === 'nintendo-entertainment-system') {
    values.push('NES', 'Nintendo Entertainment System', 'Famicom')
  }
  if (primaryName === 'sega-mega-drive' || primaryName === 'sega-genesis' || primaryName === 'mega-drive' || primaryName === 'genesis') {
    values.push('Mega Drive', 'Sega Mega Drive', 'Genesis', 'Sega Genesis')
  }
  if (primaryName === 'playstation' || primaryName === 'ps1') {
    values.push('PS1', 'PSX', 'Sony PlayStation')
  }
  if (primaryName === 'game-boy') {
    values.push('GB')
  }
  if (primaryName === 'game-boy-advance') {
    values.push('GBA')
  }
  if (primaryName === 'nintendo-64') {
    values.push('N64')
  }
  if (primaryName === 'nintendo-ds') {
    values.push('DS')
  }
  if (primaryName === 'turbografx-16') {
    values.push('PC Engine')
  }
  if (primaryName === 'neo-geo') {
    values.push('Neo Geo', 'Neo-Geo')
  }
  if (primaryName === 'dreamcast' || primaryName === 'sega-dreamcast') {
    values.push('Dreamcast', 'Sega Dreamcast')
  }
  if (primaryName === 'sega-master-system') {
    values.push('Master System')
  }

  return Array.from(new Set(values.map((value) => normalizeConsoleKey(value)).filter(Boolean)))
}

function getConsoleCatalogKey(consoleItem) {
  if (consoleItem?.knowledgeEntry?.id) {
    return consoleItem.knowledgeEntry.id
  }

  return normalizeConsoleKey(consoleItem?.name || consoleItem?.platform || consoleItem?.title || consoleItem?.id)
}

function buildConsoleGamesMap(games = [], catalog = []) {
  const map = new Map()
  const aliasMap = new Map()

  ;(catalog || []).forEach((consoleItem) => {
    const key = getConsoleCatalogKey(consoleItem)
    for (const alias of buildConsoleAliases(consoleItem)) {
      if (!aliasMap.has(alias)) {
        aliasMap.set(alias, key)
      }
    }
  })

  games.forEach((game) => {
    const knowledgeEntry = getConsoleById(game.console)
    const key = knowledgeEntry?.id || aliasMap.get(normalizeConsoleKey(game.console)) || normalizeConsoleKey(game.console)
    if (!key) {
      return
    }

    if (!map.has(key)) {
      map.set(key, [])
    }

    map.get(key).push(normalizeGameRecord(game))
  })

  return map
}

function buildConsoleMarketPayload(games = []) {
  const pricedGames = games.filter((game) => Number(game.loosePrice || game.cibPrice || game.mintPrice) > 0)
  const legendaryCount = games.filter((game) => String(game.rarity || '').toUpperCase() === 'LEGENDARY').length
  const epicCount = games.filter((game) => String(game.rarity || '').toUpperCase() === 'EPIC').length

  return {
    gamesCount: games.length,
    pricedGames: pricedGames.length,
    priceCoverage: games.length ? Math.round((pricedGames.length / games.length) * 100) : 0,
    avgLoose: averageConsoleValues(games.map((game) => game.loosePrice)),
    avgCib: averageConsoleValues(games.map((game) => game.cibPrice)),
    avgMint: averageConsoleValues(games.map((game) => game.mintPrice)),
    legendaryCount,
    epicCount,
  }
}

function buildConsoleQualityPayload(consoleItem, market) {
  let score = 0

  if (consoleItem?.name) score += 20
  if (consoleItem?.manufacturer) score += 15
  if (consoleItem?.releaseYear) score += 15
  if (consoleItem?.summary) score += 20
  if (consoleItem?.generation || consoleItem?.mediaType) score += 10
  if (market.gamesCount > 0) score += 10
  if (market.pricedGames > 0) score += 10

  return {
    score,
    tier: toConsoleTier(score),
  }
}

function buildConsoleSourcesPayload(consoleItem, market) {
  const sources = [
    {
      id: 'supabase-consoles',
      label: 'Supabase consoles',
      status: 'published',
      type: 'runtime',
    },
  ]

  if (consoleItem?.knowledgeEntry) {
    sources.push({
      id: 'console-registry',
      label: 'Console registry',
      status: 'versioned',
      type: 'knowledge',
    })
  }

  if (market.pricedGames > 0) {
    sources.push({
      id: 'games-market',
      label: 'Games market',
      status: 'derived',
      type: 'market',
    })
  }

  return sources
}

function buildConsoleOverviewPayload(consoleItem, market) {
  const technicalSpecs = consoleItem?.technicalSpecs || {}

  return {
    summary: consoleItem?.overview || consoleItem?.summary || null,
    generation: consoleItem?.generation || null,
    development: consoleItem?.development || null,
    team: consoleItem?.team || [],
    technicalSpecs,
    legacy: consoleItem?.legacy || null,
    anecdotes: consoleItem?.anecdotes || [],
    shortTechnicalIdentity: [
      technicalSpecs.cpu,
      technicalSpecs.gpu,
      technicalSpecs.media || consoleItem?.mediaType,
    ].filter(Boolean).join(' | ') || null,
    marketNotes: consoleItem?.marketNotes || null,
    marketCoverage: market.priceCoverage,
  }
}

function buildConsoleHardwarePayload(consoleItem) {
  const technicalSpecs = consoleItem?.technicalSpecs || {}

  return {
    referenceId: consoleItem?.slug || consoleItem?.id,
    cpu: technicalSpecs.cpu || null,
    gpu: technicalSpecs.gpu || null,
    memory: technicalSpecs.memory || null,
    media: technicalSpecs.media || consoleItem?.mediaType || null,
    notableFeatures: technicalSpecs.notable_features || [],
  }
}

function buildRelatedConsolePayload(catalog = [], consoleItem, limit = 4) {
  return catalog
    .filter((candidate) => candidate.id !== consoleItem.id)
    .filter((candidate) => (
      candidate.manufacturer === consoleItem.manufacturer
      || candidate.generation === consoleItem.generation
    ))
    .sort((left, right) => {
      const byMaker = Number(right.manufacturer === consoleItem.manufacturer) - Number(left.manufacturer === consoleItem.manufacturer)
      if (byMaker !== 0) return byMaker
      return Number(left.releaseYear || 0) - Number(right.releaseYear || 0)
    })
    .slice(0, limit)
    .map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      releaseYear: candidate.releaseYear || null,
    }))
}

function buildNotableGamesPayload(consoleItem, games = []) {
  const names = consoleItem?.legacy?.notable_games || []
  if (!Array.isArray(names) || !names.length) {
    return []
  }

  return names.slice(0, 8).map((title) => {
    const normalized = normalizeConsoleKey(title)
    const matched = games.find((game) => {
      const normalizedTitle = normalizeConsoleKey(game.title)
      return normalizedTitle === normalized
        || normalizedTitle.includes(normalized)
        || normalized.includes(normalizedTitle)
    })

    return {
      title,
      game: matched ? {
        id: matched.id,
        title: matched.title,
        year: matched.year,
      } : null,
    }
  })
}

async function fetchPublishedConsoles() {
  const scope = await fetchPublishedGameScope().catch(() => ({
    enabled: false,
    ids: [],
    set: new Set(),
    consoleIds: [],
  }))
  const fallback = listConsoles().map((entry) => buildStaticConsoleRecord(entry))
  const { data, error } = await db
    .from('consoles')
    .select('id,title,platform,year,manufacturer,media_type')
    .order('platform', { ascending: true })

  if (error) {
    if (isMissingSupabaseRelationError(error)) {
      return fallback
    }

    throw new Error(error.message)
  }

  const published = (data || []).map((row) => buildPublishedConsoleRecord(row))
  const filtered = scope.enabled && scope.consoleIds.length
    ? published.filter((row) => scope.consoleIds.includes(String(row.id || '')))
    : published

  if (filtered.length) {
    return filtered
  }

  if (scope.enabled && scope.consoleIds.length) {
    return fallback.filter((row) => scope.consoleIds.includes(String(row.id || '')))
  }

  return published.length ? published : fallback
}

function buildConsoleListItem(consoleItem, games = []) {
  const market = buildConsoleMarketPayload(games)
  const quality = buildConsoleQualityPayload(consoleItem, market)

  return {
    id: consoleItem.id,
    slug: consoleItem.slug || null,
    name: consoleItem.name,
    title: consoleItem.name,
    platform: consoleItem.platform || consoleItem.name,
    manufacturer: consoleItem.manufacturer || null,
    releaseYear: consoleItem.releaseYear || null,
    generation: consoleItem.generation || null,
    summary: consoleItem.summary || null,
    gamesCount: market.gamesCount,
    quality,
  }
}

function findConsoleInCatalog(catalog = [], requestedId) {
  const needle = normalizeConsoleKey(requestedId)
  if (!needle) {
    return null
  }

  return catalog.find((consoleItem) => buildConsoleAliases(consoleItem).includes(needle)) || null
}

function createGlobalConsoleResult(consoleItem, gamesCount = 0) {
  const releaseYear = consoleItem.releaseYear ?? consoleItem.release_year ?? null

  return {
    id: `console-${consoleItem.id}`,
    type: 'console',
    title: consoleItem.name || '',
    subtitle: [consoleItem.manufacturer, releaseYear, gamesCount ? `${gamesCount} jeux` : null]
      .filter(Boolean)
      .join(' · '),
    href: `/console-detail.html?id=${encodeURIComponent(consoleItem.id || '')}`,
    marketHref: `/stats.html?q=${encodeURIComponent(consoleItem.name || '')}`,
    product: 'retrodex',
    meta: {
      manufacturer: consoleItem.manufacturer || null,
      console: consoleItem.name || null,
      year: releaseYear,
      gamesCount,
    },
  }
}

function createGlobalFranchiseResult(franchise) {
  return {
    id: `franchise-${franchise.slug || franchise.id}`,
    type: 'franchise',
    title: franchise.name || '',
    subtitle: [franchise.developer, franchise.first_game_year, franchise.last_game_year ? `→ ${franchise.last_game_year}` : null]
      .filter(Boolean)
      .join(' · '),
    href: `/franchises.html?slug=${encodeURIComponent(franchise.slug || franchise.id || '')}`,
    product: 'retrodex',
    meta: {
      developer: franchise.developer || null,
      summary: franchise.synopsis || null,
    },
  }
}

async function fetchGlobalConsoleResults(query, limit) {
  const normalizedQuery = String(query || '').trim().toLowerCase()
  if (!normalizedQuery) {
    return []
  }

  const [consoles, games, scope] = await Promise.all([
    fetchPublishedConsoles(),
    fetchAllSupabaseGames(),
    fetchPublishedGameScope(),
  ])
  const gamesByConsole = buildConsoleGamesMap(filterPublishedGames(games, scope), consoles)

  return consoles
    .filter((consoleItem) => {
      const haystack = [
        consoleItem.id,
        consoleItem.name,
        consoleItem.manufacturer,
        consoleItem.generation,
        consoleItem.summary,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(normalizedQuery)
    })
    .slice(0, Math.max(limit, 10))
    .map((consoleItem) => createGlobalConsoleResult(
      consoleItem,
      (gamesByConsole.get(getConsoleCatalogKey(consoleItem)) || []).length
    ))
}

async function fetchGlobalFranchiseResults(query, limit) {
  const { data, error } = await db
    .from('franchise_entries')
    .select('slug,name,synopsis,first_game_year,last_game_year,developer')
    .ilike('name', `%${query}%`)
    .limit(Math.max(limit, 10))

  if (error) {
    if (isMissingSupabaseRelationError(error)) {
      return []
    }
    throw new Error(error.message)
  }

  return (data || []).map(createGlobalFranchiseResult)
}

module.exports = {
  buildConsoleGamesMap,
  buildConsoleMarketPayload,
  buildConsoleQualityPayload,
  buildConsoleSourcesPayload,
  buildConsoleOverviewPayload,
  buildConsoleHardwarePayload,
  buildRelatedConsolePayload,
  buildNotableGamesPayload,
  fetchPublishedConsoles,
  buildConsoleListItem,
  findConsoleInCatalog,
  fetchGlobalConsoleResults,
  fetchGlobalFranchiseResults,
  getConsoleCatalogKey,
}
