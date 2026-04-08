'use strict'

const { db } = require('../../db_supabase')
const { normalizeGameRecord } = require('../lib/normalize')
const {
  uniqueStrings,
  isMissingSupabaseRelationError,
  fetchRowsInBatches,
} = require('./public-supabase-utils')

const PUBLICATION_MEDIA_TYPES = ['map', 'manual', 'sprite_sheet', 'ending']
const DEFAULT_PUBLICATION_PASS_KEY = 'PASS 1 curated'

function buildPublicationSummary(scope = null, statsBase = null, extra = {}) {
  return {
    label: DEFAULT_PUBLICATION_PASS_KEY,
    passKey: scope?.passKey || DEFAULT_PUBLICATION_PASS_KEY,
    publishedGamesCount: Array.isArray(scope?.ids) ? scope.ids.length : 0,
    consoleCount: Array.isArray(scope?.consoleIds) ? scope.consoleIds.length : 0,
    catalogGamesCount: Number(statsBase?.total_games) || null,
    ...extra,
  }
}

function buildEmptySignals() {
  return {
    hasMaps: false,
    hasManuals: false,
    hasSprites: false,
    hasEndings: false,
  }
}

function buildEmptyCuration(scope = null, gameId = null) {
  const stringId = String(gameId || '')
  const isPublished = Boolean(scope?.set?.has(stringId))
  return {
    status: isPublished ? 'published' : null,
    isPublished,
    passKey: isPublished ? (scope?.passKey || DEFAULT_PUBLICATION_PASS_KEY) : null,
  }
}

async function fetchGameVisibilitySignals(gameIds = []) {
  const uniqueIds = uniqueStrings(gameIds)
  const signalMap = new Map(uniqueIds.map((gameId) => [gameId, buildEmptySignals()]))

  if (!uniqueIds.length) {
    return signalMap
  }

  let response = await db
    .from('media_references')
    .select('entity_id,media_type,ui_allowed,license_status')
    .eq('entity_type', 'game')
    .in('entity_id', uniqueIds)
    .in('media_type', PUBLICATION_MEDIA_TYPES)

  if (response.error) {
    if (!isMissingSupabaseRelationError(response.error)) {
      throw new Error(response.error.message)
    }

    response = await db
      .from('media_references')
      .select('entity_id,media_type')
      .eq('entity_type', 'game')
      .in('entity_id', uniqueIds)
      .in('media_type', PUBLICATION_MEDIA_TYPES)

    if (response.error) {
      if (isMissingSupabaseRelationError(response.error)) {
        return signalMap
      }
      throw new Error(response.error.message)
    }
  }

  for (const row of response.data || []) {
    const gameId = String(row.entity_id || '')
    if (!signalMap.has(gameId)) {
      signalMap.set(gameId, buildEmptySignals())
    }

    if (row.ui_allowed === false) {
      continue
    }

    if (String(row.license_status || '').toLowerCase() === 'blocked') {
      continue
    }

    const bucket = signalMap.get(gameId)
    const mediaType = String(row.media_type || '').toLowerCase()
    if (mediaType === 'map') bucket.hasMaps = true
    if (mediaType === 'manual') bucket.hasManuals = true
    if (mediaType === 'sprite_sheet') bucket.hasSprites = true
    if (mediaType === 'ending') bucket.hasEndings = true
  }

  return signalMap
}

async function fetchGameCurationStates(gameIds = [], scope = null) {
  const uniqueIds = uniqueStrings(gameIds)
  const curationMap = new Map(uniqueIds.map((gameId) => [gameId, buildEmptyCuration(scope, gameId)]))

  if (!uniqueIds.length) {
    return curationMap
  }

  const { data, error } = await db
    .from('game_curation_states')
    .select('game_id,status,pass_key,published_at')
    .in('game_id', uniqueIds)

  if (error) {
    if (isMissingSupabaseRelationError(error)) {
      return curationMap
    }
    throw new Error(error.message)
  }

  for (const row of data || []) {
    const gameId = String(row.game_id || '')
    if (!gameId) {
      continue
    }

    const fallback = curationMap.get(gameId) || buildEmptyCuration(scope, gameId)
    const status = row.status || fallback.status || null
    curationMap.set(gameId, {
      status,
      isPublished: fallback.isPublished || status === 'published' || row.published_at != null,
      passKey: row.pass_key || fallback.passKey || null,
    })
  }

  return curationMap
}

function attachVisibilityMetadata(games = [], signalsMap = new Map(), curationMap = new Map(), scope = null) {
  return (games || []).map((game) => {
    const normalized = normalizeGameRecord(game)
    const gameId = String(normalized?.id || '')
    return {
      ...normalized,
      signals: signalsMap.get(gameId) || buildEmptySignals(),
      curation: curationMap.get(gameId) || buildEmptyCuration(scope, gameId),
    }
  })
}

async function fetchPublishedGameScope() {
  let data = []

  try {
    data = await fetchRowsInBatches(
      'console_publication_slots',
      'game_id,console_id,slot_rank,pass_key',
      (query) => query.eq('is_active', true),
      { column: 'slot_rank', options: { ascending: true } }
    )
  } catch (error) {
    if (isMissingSupabaseRelationError(error)) {
      return {
        enabled: false,
        ids: [],
        set: new Set(),
        consoleIds: [],
        slotRows: [],
        passKey: DEFAULT_PUBLICATION_PASS_KEY,
      }
    }

    throw error
  }

  const slotRows = (data || [])
    .map((row) => ({
      game_id: String(row.game_id || ''),
      console_id: String(row.console_id || ''),
      slot_rank: Number(row.slot_rank || 999),
      pass_key: String(row.pass_key || '').trim() || DEFAULT_PUBLICATION_PASS_KEY,
    }))
    .filter((row) => row.game_id && row.console_id)
    .sort((left, right) => Number(left.slot_rank || 999) - Number(right.slot_rank || 999)
      || left.console_id.localeCompare(right.console_id)
      || left.game_id.localeCompare(right.game_id))

  const ids = uniqueStrings(slotRows.map((row) => row.game_id))
  const consoleIds = uniqueStrings(slotRows.map((row) => row.console_id))
  const passKeys = uniqueStrings(slotRows.map((row) => row.pass_key))

  return {
    enabled: true,
    ids,
    set: new Set(ids),
    consoleIds,
    slotRows,
    passKey: passKeys[0] || DEFAULT_PUBLICATION_PASS_KEY,
  }
}

function filterPublishedGames(games = [], scope = null) {
  if (!scope?.enabled || !scope.ids.length) {
    return games
  }

  return (games || []).filter((game) => scope.set.has(String(game?.id || '')))
}

function filterPublishedSearchResults(results = [], scope = null) {
  if (!scope?.enabled || !scope.ids.length) {
    return results
  }

  return (results || []).filter((item) => item?._type !== 'game' || scope.set.has(String(item.id || '')))
}

function buildConsoleDemoGamesPayload(consoleItem, games = [], scope = null) {
  const consoleId = String(consoleItem?.id || '')
  const gameMap = new Map((games || []).map((game) => [String(game?.id || ''), game]))
  const slotRows = Array.isArray(scope?.slotRows)
    ? scope.slotRows
      .filter((row) => String(row.console_id || '') === consoleId)
      .sort((left, right) => Number(left.slot_rank || 999) - Number(right.slot_rank || 999))
    : []

  const orderedGames = slotRows.length
    ? slotRows.map((row) => gameMap.get(String(row.game_id || ''))).filter(Boolean)
    : [...(games || [])]

  return orderedGames.slice(0, 5).map((game, index) => ({
    id: game.id,
    title: game.title,
    year: game.year ?? null,
    rarity: game.rarity || null,
    console: game.console || null,
    coverImage: game.coverImage || game.cover_url || null,
    slotRank: index + 1,
    signals: {
      hasMaps: Boolean(game.signals?.hasMaps),
      hasManuals: Boolean(game.signals?.hasManuals),
      hasSprites: Boolean(game.signals?.hasSprites),
      hasEndings: Boolean(game.signals?.hasEndings),
    },
    curation: {
      status: game.curation?.status || null,
      isPublished: Boolean(game.curation?.isPublished),
      passKey: game.curation?.passKey || null,
    },
  }))
}

module.exports = {
  DEFAULT_PUBLICATION_PASS_KEY,
  buildPublicationSummary,
  fetchGameVisibilitySignals,
  fetchGameCurationStates,
  attachVisibilityMetadata,
  fetchPublishedGameScope,
  filterPublishedGames,
  filterPublishedSearchResults,
  buildConsoleDemoGamesPayload,
}
