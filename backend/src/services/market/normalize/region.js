'use strict'

const { REGION_ALIASES } = require('./constants')

function normalizeKey(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9/]+/g, ' ')
    .trim()
}

function currencyToRegion(currency) {
  switch (String(currency || '').toUpperCase()) {
    case 'USD': return 'US'
    case 'EUR':
    case 'GBP': return 'EU'
    case 'JPY': return 'JP'
    default: return null
  }
}

function normalizeRegion(rawTitle, rawHint, currency) {
  const candidates = [rawHint, rawTitle]
  for (const candidate of candidates) {
    const normalized = normalizeKey(candidate)
    if (!normalized) continue

    for (const [alias, region] of Object.entries(REGION_ALIASES)) {
      if (normalized.includes(alias)) {
        return {
          region,
          confidence: candidate === rawHint ? 0.95 : 0.75,
          source: alias,
        }
      }
    }
  }

  const fallbackRegion = currencyToRegion(currency)
  return {
    region: fallbackRegion,
    confidence: fallbackRegion ? 0.55 : 0,
    source: fallbackRegion ? 'currency' : null,
  }
}

module.exports = {
  normalizeRegion,
}
