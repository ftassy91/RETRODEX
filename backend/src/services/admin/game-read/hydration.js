'use strict'

const { loadCanonicalSupplementsMap } = require('./supplements')

function parseMaybeJson(value, fallback = null) {
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

function mergeGameRecord(game, supplement) {
  if (!game) {
    return null
  }

  const editorial = supplement.editorial || {}
  const people = supplement.people || { devTeam: [], composers: [] }
  const media = supplement.media || {}
  const snapshot = supplement.snapshot || {}
  const quality = supplement.quality || null
  const release = supplement.release || {}

  return {
    ...game,
    summary: editorial.summary || game.summary || null,
    synopsis: editorial.synopsis || game.synopsis || editorial.lore || null,
    lore: editorial.lore || game.lore || null,
    dev_anecdotes: editorial.devNotes || game.dev_anecdotes || null,
    cheat_codes: parseMaybeJson(editorial.cheatCodes) || parseMaybeJson(game.cheat_codes) || null,
    characters: parseMaybeJson(editorial.characters) || parseMaybeJson(game.characters) || null,
    gameplay_description: editorial.gameplayDescription || game.gameplay_description || null,
    dev_team: people.devTeam.length ? people.devTeam : parseMaybeJson(game.dev_team) || null,
    ost_composers: people.composers.length ? people.composers : parseMaybeJson(game.ost_composers) || null,
    ost_notable_tracks: parseMaybeJson(game.ost_notable_tracks) || null,
    versions: parseMaybeJson(game.versions) || null,
    avg_duration_main: game.avg_duration_main ?? null,
    avg_duration_complete: game.avg_duration_complete ?? null,
    speedrun_wr: parseMaybeJson(game.speedrun_wr) || null,
    loosePrice: snapshot.loosePrice ?? game.loosePrice ?? game.loose_price ?? null,
    cibPrice: snapshot.cibPrice ?? game.cibPrice ?? game.cib_price ?? null,
    mintPrice: snapshot.mintPrice ?? game.mintPrice ?? game.mint_price ?? null,
    coverImage: media.cover || game.cover_url || game.coverImage || null,
    cover_url: media.cover || game.cover_url || game.coverImage || null,
    manual_url: media.manual || game.manual_url || null,
    releaseDate: release.releaseDate || game.releaseDate || null,
    quality: quality ? {
      completenessScore: Number(quality.completenessScore || 0),
      confidenceScore: Number(quality.confidenceScore || 0),
      sourceCoverageScore: Number(quality.sourceCoverageScore || 0),
      freshnessScore: Number(quality.freshnessScore || 0),
      overallScore: Number(quality.overallScore || 0),
      tier: quality.tier,
      missingCriticalFields: parseMaybeJson(quality.missingCriticalFields, []) || [],
      breakdown: parseMaybeJson(quality.breakdownJson, {}) || {},
      priorityScore: Number(quality.priorityScore || 0),
    } : null,
    market: snapshot ? {
      observationCount: Number(snapshot.observationCount || 0),
      lastObservedAt: snapshot.lastObservedAt || null,
      trendSignal: snapshot.trendSignal || null,
      confidenceScore: Number(snapshot.confidenceScore || 0),
      sourceCoverage: Number(snapshot.sourceCoverage || 0),
    } : null,
  }
}

async function hydrateGameRows(rows) {
  const plainRows = (rows || []).map((row) => (
    typeof row?.get === 'function' ? row.get({ plain: true }) : row
  ))

  if (!plainRows.length) {
    return []
  }

  const supplements = await loadCanonicalSupplementsMap(plainRows.map((row) => row.id))
  return plainRows.map((row) => mergeGameRecord(row, supplements.get(String(row.id)) || {}))
}

module.exports = {
  parseMaybeJson,
  mergeGameRecord,
  hydrateGameRows,
}
