'use strict'

const SOURCE_POLICY = {
  ebay: {
    name: 'eBay Developer APIs',
    status: 'approved',
    legalFeasibility: 1,
    sourceAvailability: 1,
  },
  pricecharting: {
    name: 'PriceCharting API',
    status: 'approved_with_review',
    legalFeasibility: 0.75,
    sourceAvailability: 0.8,
  },
  igdb: {
    name: 'IGDB / Twitch',
    status: 'approved_with_review',
    legalFeasibility: 0.75,
    sourceAvailability: 0.85,
  },
  twitch: {
    name: 'IGDB / Twitch',
    status: 'approved_with_review',
    legalFeasibility: 0.75,
    sourceAvailability: 0.85,
  },
  internet_archive: {
    name: 'Internet Archive',
    status: 'reference_only',
    legalFeasibility: 0.5,
    sourceAvailability: 0.7,
  },
  youtube: {
    name: 'YouTube',
    status: 'reference_only',
    legalFeasibility: 0.5,
    sourceAvailability: 0.85,
  },
  wikidata: {
    name: 'Wikidata',
    status: 'approved',
    legalFeasibility: 1,
    sourceAvailability: 0.95,
  },
  internal: {
    name: 'RETRODEX internal',
    status: 'approved',
    legalFeasibility: 1,
    sourceAvailability: 1,
  },
  unknown: {
    name: 'Unknown source',
    status: 'blocked',
    legalFeasibility: 0,
    sourceAvailability: 0,
  },
}

function normalizeSourceKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function getSourcePolicy(value) {
  const key = normalizeSourceKey(value)
  return SOURCE_POLICY[key] || SOURCE_POLICY.unknown
}

module.exports = {
  SOURCE_POLICY,
  getSourcePolicy,
  normalizeSourceKey,
}
