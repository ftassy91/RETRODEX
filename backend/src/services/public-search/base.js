'use strict'

const { normalizeGameRecord, parseStoredJson } = require('../../lib/normalize')

const SEARCH_CONTEXT_LABELS = {
  all: 'TOUS',
  retrodex: 'RETRODEX',
  retromarket: 'RETROMARKET',
  collection: 'COLLECTION',
  neoretro: 'NEORETRO',
}

function normalizeSearchGameRow(row) {
  const item = normalizeGameRecord(row)
  return {
    id: item.id,
    title: item.title || item.name || null,
    console: item.console || null,
    year: item.year ?? null,
    rarity: item.rarity || null,
    loosePrice: item.loosePrice ?? null,
    slug: item.slug || null,
    franch_id: item.franch_id || null,
    source_confidence: item.source_confidence ?? null,
    _type: 'game',
  }
}

function normalizeSearchFranchiseRow(row) {
  return {
    id: row.id || row.slug,
    name: row.name,
    slug: row.slug || null,
    first_game: row.first_game ?? row.first_game_year ?? null,
    last_game: row.last_game ?? row.last_game_year ?? null,
    developer: row.developer || null,
    _type: 'franchise',
  }
}

function buildExcerpt(value, maxLength = 160) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text) return null
  if (text.length <= maxLength) return text

  const sliced = text.slice(0, maxLength)
  const lastSpace = sliced.lastIndexOf(' ')
  const safeSlice = lastSpace > 40 ? sliced.slice(0, lastSpace) : sliced
  return `${safeSlice}...`
}

function normalizeGlobalSearchText(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function tokenizeGlobalSearchText(value) {
  return normalizeGlobalSearchText(value)
    .split(/\s+/)
    .filter(Boolean)
}

function levenshteinDistance(left, right) {
  const a = String(left || '')
  const b = String(right || '')
  if (!a) return b.length
  if (!b) return a.length

  const previous = new Array(b.length + 1)
  const current = new Array(b.length + 1)

  for (let column = 0; column <= b.length; column += 1) {
    previous[column] = column
  }

  for (let row = 1; row <= a.length; row += 1) {
    current[0] = row
    for (let column = 1; column <= b.length; column += 1) {
      const cost = a[row - 1] === b[column - 1] ? 0 : 1
      current[column] = Math.min(
        previous[column] + 1,
        current[column - 1] + 1,
        previous[column - 1] + cost
      )
    }

    for (let column = 0; column <= b.length; column += 1) {
      previous[column] = current[column]
    }
  }

  return previous[b.length]
}

function isNearSearchTokenMatch(token, candidate) {
  const queryToken = String(token || '')
  const candidateToken = String(candidate || '')
  if (!queryToken || !candidateToken) return false
  if (candidateToken === queryToken) return true
  if (candidateToken.startsWith(queryToken) || queryToken.startsWith(candidateToken)) return true

  const maxLength = Math.max(queryToken.length, candidateToken.length)
  if (maxLength < 4) return false

  const maxDistance = maxLength >= 8 ? 2 : 1
  return levenshteinDistance(queryToken, candidateToken) <= maxDistance
}

function collectGlobalSearchTokens(result) {
  return tokenizeGlobalSearchText([
    result?.name,
    result?.title,
    result?.subtitle,
    result?.meta?.console,
    result?.meta?.genre,
    result?.meta?.developer,
    result?.meta?.manufacturer,
    result?.meta?.summary,
    result?.meta?.synopsis,
  ].filter(Boolean).join(' '))
}

function scoreResult(result, query) {
  const normalizedQuery = normalizeGlobalSearchText(query)
  const title = normalizeGlobalSearchText(result?.name || result?.title || '')
  if (!normalizedQuery || !title) return 0

  if (title === normalizedQuery) return 100
  if (title.startsWith(`${normalizedQuery} `)) return 96
  if (title.startsWith(normalizedQuery)) return 94
  if (title.endsWith(` ${normalizedQuery}`)) return 92
  if (title.includes(` ${normalizedQuery}`)) return 88
  if (title.includes(normalizedQuery)) return 84

  const queryTokens = tokenizeGlobalSearchText(normalizedQuery)
  const haystackTokens = collectGlobalSearchTokens(result)
  const titleTokens = tokenizeGlobalSearchText(title)
  let score = 0

  for (const token of queryTokens) {
    if (titleTokens.includes(token)) {
      score += 36
      continue
    }
    if (titleTokens.some((candidate) => candidate.startsWith(token))) {
      score += 28
      continue
    }
    if (haystackTokens.some((candidate) => candidate.includes(token))) {
      score += 16
      continue
    }
    if (haystackTokens.some((candidate) => isNearSearchTokenMatch(token, candidate))) {
      score += 22
    }
  }

  if (queryTokens.length === 1 && titleTokens.some((candidate) => isNearSearchTokenMatch(queryTokens[0], candidate))) {
    score = Math.max(score, 72)
  }

  return Math.min(score, 99)
}

function compareGlobalResults(left, right) {
  return (right.score || 0) - (left.score || 0)
    || String(left.title || '').localeCompare(String(right.title || ''), 'fr', {
      sensitivity: 'base',
    })
}

function createGlobalGameResult(game, context = 'all') {
  const item = normalizeGameRecord(game)
  const marketHref = `/stats.html?q=${encodeURIComponent(item.title || '')}`
  const detailHref = `/game-detail.html?id=${encodeURIComponent(item.id || '')}`

  return {
    id: item.id,
    type: 'game',
    title: item.title || '',
    subtitle: [item.console, item.year].filter(Boolean).join(' Â· '),
    href: context === 'retromarket' ? marketHref : detailHref,
    marketHref,
    detailHref,
    product: context === 'retromarket' ? 'retromarket' : 'retrodex',
    meta: {
      console: item.console || null,
      year: item.year ?? null,
      genre: item.genre || null,
      developer: item.developer || null,
      metascore: item.metascore ?? null,
      rarity: item.rarity || null,
      summary: item.summary || item.synopsis || null,
      synopsis: item.synopsis || null,
      coverImage: item.coverImage || item.cover_url || null,
      loosePrice: item.loosePrice ?? item.loose_price ?? null,
      cibPrice: item.cibPrice ?? item.cib_price ?? null,
      mintPrice: item.mintPrice ?? item.mint_price ?? null,
      priceCurrency: item.priceCurrency ?? item.price_currency ?? null,
      qualityScore: Number(item.source_confidence || 0) || null,
    },
    curation: {
      status: item.curation?.status || null,
      isPublished: Boolean(item.curation?.isPublished),
      passKey: item.curation?.passKey || null,
    },
    signals: {
      hasMaps: Boolean(item.signals?.hasMaps),
      hasManuals: Boolean(item.signals?.hasManuals),
      hasSprites: Boolean(item.signals?.hasSprites),
      hasEndings: Boolean(item.signals?.hasEndings),
    },
  }
}

function toFranchisePayload(franchise) {
  return {
    id: franchise.id || franchise.slug,
    name: franchise.name,
    slug: franchise.slug || null,
    description: franchise.description || franchise.synopsis || null,
    first_game: franchise.first_game ?? franchise.first_game_year ?? null,
    last_game: franchise.last_game ?? franchise.last_game_year ?? null,
    developer: franchise.developer || null,
    publisher: franchise.publisher || null,
    genres: parseStoredJson(franchise.genres),
    platforms: parseStoredJson(franchise.platforms),
    timeline: parseStoredJson(franchise.timeline),
    team_changes: parseStoredJson(franchise.team_changes),
    trivia: parseStoredJson(franchise.trivia),
    legacy: franchise.legacy || franchise.heritage || null,
  }
}

module.exports = {
  SEARCH_CONTEXT_LABELS,
  buildExcerpt,
  compareGlobalResults,
  createGlobalGameResult,
  normalizeSearchGameRow,
  normalizeSearchFranchiseRow,
  normalizeGlobalSearchText,
  scoreResult,
  toFranchisePayload,
}
