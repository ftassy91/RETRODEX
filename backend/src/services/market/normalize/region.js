'use strict'

const { REGION_ALIASES } = require('./constants')

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ' ')
    .replace(/[^a-z0-9/+-]+/g, ' ')
    .trim()
}

function defaultRegionForMarket(sourceMarket) {
  switch (String(sourceMarket || '').toLowerCase()) {
    case 'jp':
      return 'NTSC-J'
    case 'us':
      return 'NTSC-U'
    case 'eu':
      return 'PAL'
    default:
      return 'unknown'
  }
}

function normalizeRegion(rawTitle, rawHint, sourceMarket) {
  const hint = normalizeText(rawHint)
  const title = normalizeText(rawTitle)
  const combined = [hint, title].filter(Boolean).join(' ')

  for (const [alias, region] of Object.entries(REGION_ALIASES)) {
    const normalizedAlias = normalizeText(alias)
    if (!normalizedAlias) {
      continue
    }

    if (hint && hint.includes(normalizedAlias)) {
      return {
        region,
        confidence: 1,
        source: `hint:${alias}`,
      }
    }

    if (combined.includes(normalizedAlias)) {
      return {
        region,
        confidence: 0.82,
        source: `title:${alias}`,
      }
    }
  }

  const fallbackRegion = defaultRegionForMarket(sourceMarket)
  return {
    region: fallbackRegion,
    confidence: fallbackRegion === 'unknown' ? 0 : 0.55,
    source: fallbackRegion === 'unknown' ? null : 'market-default',
  }
}

module.exports = {
  normalizeRegion,
}
