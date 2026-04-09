'use strict'

const { normalizeText, tokenize } = require('../normalize')
const { normalizePlatformKey } = require('../normalize/platform')

function buildCatalogIndex(catalogRows = []) {
  return catalogRows
    .filter((row) => row && String(row.id || '').trim())
    .map((row) => ({
      ...row,
      normalizedTitle: normalizeText(row.title),
      titleTokens: new Set(tokenize(row.title)),
      normalizedPlatform: normalizePlatformKey(row.console || row.platform || ''),
    }))
}

function computeTokenOverlap(recordTokens = [], gameTokenSet = new Set()) {
  if (!recordTokens.length || !gameTokenSet.size) return 0
  const overlap = recordTokens.filter((token) => gameTokenSet.has(token)).length
  return overlap / Math.max(gameTokenSet.size, 1)
}

function matchNormalizedSoldRecord(record, catalogIndex = [], options = {}) {
  const minimumScore = Number(options.minimumScore || 0.4)
  const directTargetId = String(options.targetGameId || record.seed_game_id || '').trim()
  const directTargetTitle = normalizeText(options.targetTitle || record.query_text || '')
  if (directTargetId) {
    const direct = catalogIndex.find((game) => String(game.id) === directTargetId)
    if (direct) {
      return {
        game: direct,
        score: 1,
        components: {
          title: 1,
          platform: record.normalized_platform && direct.normalizedPlatform === record.normalized_platform_key ? 1 : 0.7,
          direct: 1,
        },
      }
    }
  }

  if (directTargetTitle) {
    const directByTitle = catalogIndex.find((game) => game.normalizedTitle === directTargetTitle)
    if (directByTitle) {
      return {
        game: directByTitle,
        score: 0.98,
        components: {
          title: 1,
          platform: record.normalized_platform && directByTitle.normalizedPlatform === record.normalized_platform_key ? 1 : 0.7,
          direct: 0.95,
        },
      }
    }
  }

  let best = null
  for (const game of catalogIndex) {
    const titleOverlap = computeTokenOverlap(record.titleTokens, game.titleTokens)
    const substringBonus = record.matchableTitle.includes(game.normalizedTitle) || game.normalizedTitle.includes(record.matchableTitle)
      ? 0.15
      : 0
    const platformScore = !record.normalized_platform_key || !game.normalizedPlatform
      ? 0.5
      : game.normalizedPlatform === record.normalized_platform_key
        ? 1
        : 0
    const score = Math.max(0, Math.min(1, (titleOverlap * 0.75) + (platformScore * 0.25) + substringBonus))

    if (!best || score > best.score) {
      best = {
        game,
        score,
        components: {
          title: Number(titleOverlap.toFixed(4)),
          platform: Number(platformScore.toFixed(4)),
          direct: 0,
        },
      }
    }
  }

  if (!best || best.score < minimumScore) {
    return {
      game: null,
      score: best ? best.score : 0,
      components: best ? best.components : { title: 0, platform: 0, direct: 0 },
    }
  }

  return best || {
    game: null,
    score: 0,
    components: { title: 0, platform: 0, direct: 0 },
  }
}

module.exports = {
  buildCatalogIndex,
  matchNormalizedSoldRecord,
}
