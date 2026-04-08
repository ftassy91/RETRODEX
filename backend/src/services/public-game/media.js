'use strict'

const { db } = require('../../../db_supabase')
const { LRUCache } = require('../../lib/lru-cache')
const { isMissingSupabaseRelationError } = require('../public-supabase-utils')

const contentProfileCache = new LRUCache(300, 5 * 60 * 1000)
const contentProfilePromises = new Map()

async function fetchGameMediaMap(gameIds = []) {
  const uniqueIds = Array.from(new Set((gameIds || []).filter(Boolean).map((value) => String(value))))
  if (!uniqueIds.length) {
    return new Map()
  }

  const { data, error } = await db
    .from('media_references')
    .select('entity_id,media_type,url')
    .eq('entity_type', 'game')
    .in('entity_id', uniqueIds)

  if (error) {
    if (isMissingSupabaseRelationError(error)) {
      return new Map()
    }
    throw new Error(error.message)
  }

  const mediaMap = new Map()
  for (const row of data || []) {
    const gameId = String(row.entity_id || '')
    if (!gameId) {
      continue
    }

    if (!mediaMap.has(gameId)) {
      mediaMap.set(gameId, {})
    }

    mediaMap.get(gameId)[String(row.media_type || '').toLowerCase()] = row.url
  }

  return mediaMap
}

async function fetchGameMediaRows(gameId) {
  const query = db
    .from('media_references')
    .select('media_type,url,provider,compliance_status,storage_mode,title,preview_url,asset_subtype,license_status,ui_allowed,healthcheck_status,notes,source_context')
    .eq('entity_type', 'game')
    .eq('entity_id', String(gameId || ''))

  const { data, error } = await query

  if (error) {
    if (isMissingSupabaseRelationError(error)) {
      return []
    }

    const fallback = await db
      .from('media_references')
      .select('media_type,url,provider,compliance_status,storage_mode')
      .eq('entity_type', 'game')
      .eq('entity_id', String(gameId || ''))

    if (fallback.error) {
      if (isMissingSupabaseRelationError(fallback.error)) {
        return []
      }
      throw new Error(fallback.error.message)
    }

    return Array.isArray(fallback.data) ? fallback.data : []
  }

  return Array.isArray(data) ? data : []
}

async function fetchGameEditorialRow(gameId) {
  const query = db
    .from('game_editorial')
    .select('summary,synopsis,lore,gameplay_description,characters,dev_anecdotes,cheat_codes,versions,avg_duration_main,avg_duration_complete,speedrun_wr')
    .eq('game_id', String(gameId || ''))
    .limit(1)
    .single()

  const { data, error } = await query
  if (error) {
    if (isMissingSupabaseRelationError(error)) {
      return null
    }

    const fallback = await db
      .from('game_editorial')
      .select('summary,synopsis,lore,gameplay_description,characters,cheat_codes')
      .eq('game_id', String(gameId || ''))
      .limit(1)
      .single()

    if (fallback.error) {
      if (isMissingSupabaseRelationError(fallback.error)) {
        return null
      }
      throw new Error(fallback.error.message)
    }

    return fallback.data || null
  }

  return data || null
}

async function fetchGameContentProfileRow(gameId) {
  const normalizedGameId = String(gameId || '').trim()
  if (!normalizedGameId) {
    return null
  }

  const cached = contentProfileCache.get(normalizedGameId)
  if (cached) {
    return cached
  }

  if (contentProfilePromises.has(normalizedGameId)) {
    return contentProfilePromises.get(normalizedGameId)
  }

  const promise = (async () => {
  const { data, error } = await db
    .from('game_content_profiles')
    .select('content_profile_json,profile_version,profile_mode,profile_basis_json,relevant_expected,updated_at')
    .eq('game_id', normalizedGameId)
    .limit(1)
    .single()

    if (error) {
      if (isMissingSupabaseRelationError(error)) {
        contentProfileCache.set(normalizedGameId, null)
        return null
      }
      throw new Error(error.message)
    }

    const result = data || null
    contentProfileCache.set(normalizedGameId, result)
    return result
  })()

  contentProfilePromises.set(normalizedGameId, promise)

  try {
    return await promise
  } finally {
    contentProfilePromises.delete(normalizedGameId)
  }
}

module.exports = {
  fetchGameMediaMap,
  fetchGameMediaRows,
  fetchGameEditorialRow,
  fetchGameContentProfileRow,
}
