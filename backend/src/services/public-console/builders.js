'use strict'

const { getConsoleById } = require('../../lib/consoles')

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

module.exports = {
  buildConsoleMarketPayload,
  buildConsoleQualityPayload,
  buildConsoleSourcesPayload,
  buildConsoleOverviewPayload,
  buildConsoleHardwarePayload,
  buildRelatedConsolePayload,
  buildNotableGamesPayload,
  buildConsoleListItem,
  buildPublishedConsoleRecord,
  buildStaticConsoleRecord,
}
