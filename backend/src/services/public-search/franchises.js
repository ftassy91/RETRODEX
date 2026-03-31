'use strict'

const { db } = require('../../../db_supabase')
const { normalizeGameRecord, parseStoredJson } = require('../../lib/normalize')
const { isMissingSupabaseRelationError } = require('../public-supabase-utils')
const { toFranchisePayload } = require('./base')

async function listFranchises() {
  const { data, error } = await db
    .from('franchise_entries')
    .select('slug,name,synopsis,first_game_year,last_game_year,developer,genres,platforms,game_ids,heritage')
    .order('name', { ascending: true })

  if (error) {
    if (isMissingSupabaseRelationError(error)) {
      return { ok: true, items: [], franchises: [], count: 0 }
    }
    throw new Error(error.message)
  }

  const items = (data || []).map((franchise) => toFranchisePayload({
    ...franchise,
    id: franchise.slug,
  }))

  return {
    ok: true,
    items,
    franchises: items,
    count: items.length,
  }
}

async function getFranchiseBySlug(slug) {
  const { data, error } = await db
    .from('franchise_entries')
    .select('slug,name,synopsis,first_game_year,last_game_year,developer,genres,platforms,game_ids,heritage')
    .eq('slug', slug)
    .single()

  if ((error && isMissingSupabaseRelationError(error)) || !data) {
    return null
  }
  if (error) {
    throw new Error(error.message)
  }

  return {
    ok: true,
    franchise: toFranchisePayload({
      ...data,
      id: data.slug,
    }),
  }
}

async function listFranchiseGamesBySlug(slug) {
  let { data: franchise, error: franchiseError } = await db
    .from('franchise_entries')
    .select('slug,game_ids')
    .eq('slug', slug)
    .single()

  if (franchiseError && !isMissingSupabaseRelationError(franchiseError)) {
    throw new Error(franchiseError.message)
  }
  if (franchiseError && isMissingSupabaseRelationError(franchiseError)) {
    franchise = null
  }

  const parsedIds = parseStoredJson(franchise?.game_ids)
  let games = []

  if (Array.isArray(parsedIds) && parsedIds.length) {
    const { data, error } = await db
      .from('games')
      .select('id,title,console,year,genre,rarity,slug,loose_price,cib_price,mint_price')
      .in('id', parsedIds)
      .order('title', { ascending: true })

    if (error) throw new Error(error.message)
    games = data || []
  } else {
    const { data, error } = await db
      .from('games')
      .select('id,title,console,year,genre,rarity,slug,loose_price,cib_price,mint_price')
      .eq('franch_id', slug)
      .order('title', { ascending: true })

    if (error) throw new Error(error.message)
    games = data || []
  }

  return {
    ok: true,
    franchise: franchise?.slug || slug,
    items: games.map((game) => normalizeGameRecord(game)),
    count: games.length,
  }
}

module.exports = {
  listFranchises,
  getFranchiseBySlug,
  listFranchiseGamesBySlug,
}
