'use strict'

const { db } = require('../../../db_supabase')
const { listConsoles } = require('../../lib/consoles')
const { isMissingSupabaseRelationError } = require('../public-supabase-utils')
const { fetchAllSupabaseGames } = require('../public-game-reader')
const { fetchPublishedGameScope, filterPublishedGames } = require('../public-publication-service')
const {
  buildPublishedConsoleRecord,
  buildStaticConsoleRecord,
} = require('./builders')
const {
  buildConsoleGamesMap,
  createGlobalConsoleResult,
  createGlobalFranchiseResult,
  getConsoleCatalogKey,
} = require('./catalog')

async function fetchPublishedConsoles() {
  const scope = await fetchPublishedGameScope().catch((err) => {
    console.error('[publication] fetchPublishedGameScope failed:', err.message)
    return { enabled: false, ids: [], set: new Set(), consoleIds: [] }
  })
  const fallback = listConsoles().map((entry) => buildStaticConsoleRecord(entry))
  const { data, error } = await db
    .from('consoles')
    .select('id,title,platform,year,manufacturer,media_type')
    .order('platform', { ascending: true })

  if (error) {
    if (isMissingSupabaseRelationError(error)) {
      return fallback
    }

    throw new Error(error.message)
  }

  const published = (data || []).map((row) => buildPublishedConsoleRecord(row))
  const filtered = scope.enabled && scope.consoleIds.length
    ? published.filter((row) => scope.consoleIds.includes(String(row.id || '')))
    : published

  if (filtered.length) {
    return filtered
  }

  if (scope.enabled && scope.consoleIds.length) {
    return fallback.filter((row) => scope.consoleIds.includes(String(row.id || '')))
  }

  return published.length ? published : fallback
}

async function fetchGlobalConsoleResults(query, limit) {
  const normalizedQuery = String(query || '').trim().toLowerCase()
  if (!normalizedQuery) {
    return []
  }

  const [consoles, games, scope] = await Promise.all([
    fetchPublishedConsoles(),
    fetchAllSupabaseGames(),
    fetchPublishedGameScope(),
  ])
  const gamesByConsole = buildConsoleGamesMap(filterPublishedGames(games, scope), consoles)

  return consoles
    .filter((consoleItem) => {
      const haystack = [
        consoleItem.id,
        consoleItem.name,
        consoleItem.manufacturer,
        consoleItem.generation,
        consoleItem.summary,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(normalizedQuery)
    })
    .slice(0, Math.max(limit, 10))
    .map((consoleItem) => createGlobalConsoleResult(
      consoleItem,
      (gamesByConsole.get(getConsoleCatalogKey(consoleItem)) || []).length
    ))
}

async function fetchGlobalFranchiseResults(query, limit) {
  const { data, error } = await db
    .from('franchise_entries')
    .select('slug,name,synopsis,first_game_year,last_game_year,developer')
    .ilike('name', `%${query}%`)
    .limit(Math.max(limit, 10))

  if (error) {
    if (isMissingSupabaseRelationError(error)) {
      return []
    }
    throw new Error(error.message)
  }

  return (data || []).map(createGlobalFranchiseResult)
}

module.exports = {
  fetchPublishedConsoles,
  fetchGlobalConsoleResults,
  fetchGlobalFranchiseResults,
}
