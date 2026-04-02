'use strict'

function normalizeGameRecord(game) {
  if (!game || typeof game !== 'object') {
    return game
  }

  const coverUrl = game.cover_url ?? game.coverImage ?? game.coverimage ?? null

  return {
    ...game,
    loosePrice: game.loosePrice ?? game.loose_price ?? null,
    cibPrice: game.cibPrice ?? game.cib_price ?? null,
    mintPrice: game.mintPrice ?? game.mint_price ?? null,
    cover_url: coverUrl,
    coverImage: coverUrl,
  }
}

function parseStoredJson(value, fallback = null) {
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

function compareGamesForSort(leftGame, rightGame, sortKey) {
  const left = normalizeGameRecord(leftGame)
  const right = normalizeGameRecord(rightGame)
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

function toGameSummary(game) {
  const item = normalizeGameRecord(game)

  return {
    id: item.id,
    title: item.title,
    console: item.console,
    year: item.year,
    genre: item.genre,
    developer: item.developer,
    metascore: item.metascore,
    rarity: item.rarity,
    summary: item.summary || item.synopsis || null,
    prices: {
      loose: item.loosePrice,
      cib: item.cibPrice,
      mint: item.mintPrice,
    },
  }
}

module.exports = {
  normalizeGameRecord,
  parseStoredJson,
  compareNullableNumbers,
  rarityRankDescending,
  rarityRankAscending,
  compareGamesForSort,
  toGameSummary,
}
