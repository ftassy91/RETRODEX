'use strict'

function normalizeSearchIdentityPart(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function buildSearchResultDedupeKey(item) {
  const entityType = String(item?._type || item?.type || 'game').trim().toLowerCase()
  const title = normalizeSearchIdentityPart(item?.title || item?.name || '')
  const platform = normalizeSearchIdentityPart(item?.console || item?.platform || '')
  const year = item?.year == null ? '' : String(item.year).trim()

  return [entityType, title, platform, year].join('|')
}

function rarityRank(rarity) {
  const value = String(rarity || '').trim().toUpperCase()
  if (value === 'LEGENDARY') return 5
  if (value === 'EPIC') return 4
  if (value === 'RARE') return 3
  if (value === 'UNCOMMON') return 2
  if (value === 'COMMON') return 1
  return 0
}

function buildSearchResultPreferenceScore(item) {
  let score = 0

  if (item?.slug) score += 64
  if (item?.franch_id) score += 16
  if (item?.rarity) score += 8
  if (item?.loosePrice != null && Number(item.loosePrice) > 0) score += 4

  const confidence = Number(item?.source_confidence)
  if (Number.isFinite(confidence)) {
    score += Math.round(confidence * 100)
  }

  score += rarityRank(item?.rarity)
  score += Math.min(String(item?.title || item?.name || '').length, 120) / 1000

  return score
}

function compareSearchResultPreference(left, right) {
  const scoreDelta = buildSearchResultPreferenceScore(right) - buildSearchResultPreferenceScore(left)
  if (scoreDelta !== 0) {
    return scoreDelta
  }

  return String(left?.id || left?.slug || left?.title || left?.name || '').localeCompare(
    String(right?.id || right?.slug || right?.title || right?.name || ''),
    'en',
    { sensitivity: 'base' }
  )
}

function dedupeSearchResults(items = []) {
  const chosenByKey = new Map()

  for (const item of items) {
    const key = buildSearchResultDedupeKey(item)
    const current = chosenByKey.get(key)

    if (!current || compareSearchResultPreference(current, item) > 0) {
      chosenByKey.set(key, item)
    }
  }

  return Array.from(chosenByKey.values())
}

module.exports = {
  buildSearchResultDedupeKey,
  buildSearchResultPreferenceScore,
  compareSearchResultPreference,
  dedupeSearchResults,
  normalizeSearchIdentityPart,
}
