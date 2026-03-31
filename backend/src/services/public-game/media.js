'use strict'

const { db } = require('../../../db_supabase')
const { isMissingSupabaseRelationError } = require('../public-supabase-utils')

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
  const { data, error } = await db
    .from('game_content_profiles')
    .select('content_profile_json,profile_version,profile_mode,profile_basis_json,relevant_expected,updated_at')
    .eq('game_id', String(gameId || ''))
    .limit(1)
    .single()

  if (error) {
    if (isMissingSupabaseRelationError(error)) {
      return null
    }
    throw new Error(error.message)
  }

  return data || null
}

module.exports = {
  fetchGameMediaMap,
  fetchGameMediaRows,
  fetchGameEditorialRow,
  fetchGameContentProfileRow,
}
