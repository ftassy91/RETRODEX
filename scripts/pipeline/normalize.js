'use strict'
const LOOKUP = require('../../data/lookup_tables.json')

function generateSlug(name, platform) {
  return [name, platform].join('-')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function normalizePlatform(raw) {
  if (!raw) return null
  if (LOOKUP.platforms.includes(raw)) return raw
  return LOOKUP.platform_aliases[raw] || null
}

function normalizeGenre(raw) {
  if (!raw) return 'Other'
  if (LOOKUP.genres.includes(raw)) return raw
  return LOOKUP.genre_aliases[raw.toLowerCase()] || 'Other'
}

function normalizeGame(raw) {
  const platform = normalizePlatform(raw.platform)
  const name = (raw.name || raw.title || '').trim()
  return {
    slug:             platform && name ? generateSlug(name, platform) : null,
    name,
    platform,
    release_year:     parseInt(raw.year) || null,
    developer:        raw.developer?.trim() || null,
    genre:            normalizeGenre(raw.genre),
    region:           LOOKUP.regions.includes(raw.region) ? raw.region : 'WW',
    description:      (raw.summary || raw.description || '').slice(0, 200) || null,
    source:           raw._source || 'unknown',
    source_confidence: raw._source === 'wikidata' ? 0.70 : 0.50
  }
}

module.exports = { normalizeGame, generateSlug }
