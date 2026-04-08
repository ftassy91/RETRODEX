'use strict'

const { LRUCache } = require('../../lib/lru-cache')
const {
  buildGameDetailDataLayer,
  normalizeStoredProfile,
} = require('../../helpers/game-detail-data-layer')
const {
  fetchCanonicalGameById,
  fetchGameContentProfileRow,
  fetchGameKnowledgeDomains,
  buildArchivePayload,
  buildEncyclopediaPayload,
} = require('../public-game-reader')

const detailPayloadCache = new LRUCache(300, 2 * 60 * 1000)
const detailPayloadPromises = new Map()

function normalizeDetailScope(scope) {
  return String(scope || '').toLowerCase() === 'primary' ? 'primary' : 'full'
}

function getDetailPayloadCacheKey(gameId, scope) {
  return `${scope}:${gameId}`
}

function getDomainOptionsForScope(scope) {
  if (scope === 'primary') {
    return {
      includeProduction: true,
      includeMedia: false,
      includeMusic: false,
      includeCompetition: false,
    }
  }

  return {
    includeProduction: true,
    includeMedia: true,
    includeMusic: true,
    includeCompetition: true,
  }
}

function getDomainOptionsForFullProfile(storedProfile) {
  if (!storedProfile) {
    return getDomainOptionsForScope('full')
  }

  const profile = normalizeStoredProfile(storedProfile)
  return {
    includeProduction: true,
    includeMedia: Boolean(profile.manuals || profile.maps || profile.sprites || profile.endings || profile.covers),
    includeMusic: Boolean(profile.ost),
    includeCompetition: Boolean(profile.records),
  }
}

async function fetchGameDetailPayload(gameId, options = {}) {
  const normalizedGameId = String(gameId || '').trim()
  const scope = normalizeDetailScope(options.scope)
  if (!normalizedGameId) {
    return null
  }

  const cacheKey = getDetailPayloadCacheKey(normalizedGameId, scope)
  const cached = detailPayloadCache.get(cacheKey)
  if (cached) {
    return cached
  }

  if (detailPayloadPromises.has(cacheKey)) {
    return detailPayloadPromises.get(cacheKey)
  }

  const promise = (async () => {
    const game = await fetchCanonicalGameById(normalizedGameId)
    if (!game) {
      return null
    }

    const storedProfile = await fetchGameContentProfileRow(game.id).catch((err) => {
      console.error('[detail] content profile failed:', err.message)
      return null
    })
    const domains = await fetchGameKnowledgeDomains(
      game,
      scope === 'full'
        ? getDomainOptionsForFullProfile(storedProfile)
        : getDomainOptionsForScope(scope)
    )

    const payload = buildGameDetailDataLayer({
      game,
      archive: buildArchivePayload(game, domains),
      encyclopedia: buildEncyclopediaPayload(game, domains),
      storedProfile,
      includeLazyTabs: scope === 'full',
      scope,
    })

    detailPayloadCache.set(cacheKey, payload)
    return payload
  })()

  detailPayloadPromises.set(cacheKey, promise)

  try {
    return await promise
  } finally {
    detailPayloadPromises.delete(cacheKey)
  }
}

module.exports = {
  fetchGameDetailPayload,
}
