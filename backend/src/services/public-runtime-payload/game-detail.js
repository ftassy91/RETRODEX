'use strict'

const { LRUCache } = require('../../lib/lru-cache')
const { buildGameDetailDataLayer } = require('../../helpers/game-detail-data-layer')
const {
  fetchCanonicalGameById,
  fetchGameContentProfileRow,
  fetchGameKnowledgeDomains,
  buildArchivePayload,
  buildEncyclopediaPayload,
} = require('../public-game-reader')

const detailPayloadCache = new LRUCache(300, 2 * 60 * 1000)
const detailPayloadPromises = new Map()

async function fetchGameDetailPayload(gameId) {
  const normalizedGameId = String(gameId || '').trim()
  if (!normalizedGameId) {
    return null
  }

  const cached = detailPayloadCache.get(normalizedGameId)
  if (cached) {
    return cached
  }

  if (detailPayloadPromises.has(normalizedGameId)) {
    return detailPayloadPromises.get(normalizedGameId)
  }

  const promise = (async () => {
    const game = await fetchCanonicalGameById(normalizedGameId)
    if (!game) {
      return null
    }

    const [domains, storedProfile] = await Promise.all([
      fetchGameKnowledgeDomains(game),
      fetchGameContentProfileRow(game.id).catch((err) => {
        console.error('[detail] content profile failed:', err.message)
        return null
      }),
    ])

    const payload = buildGameDetailDataLayer({
      game,
      archive: buildArchivePayload(game, domains),
      encyclopedia: buildEncyclopediaPayload(game, domains),
      storedProfile,
    })

    detailPayloadCache.set(normalizedGameId, payload)
    return payload
  })()

  detailPayloadPromises.set(normalizedGameId, promise)

  try {
    return await promise
  } finally {
    detailPayloadPromises.delete(normalizedGameId)
  }
}

module.exports = {
  fetchGameDetailPayload,
}
