/**
 * Centralized data normalization module for RETRODEX backend
 *
 * Purpose: Consolidates duplicated normalization logic for converting between
 * snake_case database fields (Supabase/Sequelize) and camelCase API responses.
 *
 * This module provides idempotent normalization functions that safely handle
 * data from multiple sources (Supabase, Sequelize models, raw rows) without
 * breaking if fields are already normalized.
 *
 * Usage:
 *   const { normalizeGameFields, normalizeGameRecord } = require('./lib/normalize')
 *   const normalized = normalizeGameFields(dbRow)
 *   const withSpread = normalizeGameRecord(gameObj)
 */

/**
 * Normalizes game data by converting snake_case fields to camelCase
 * Handles both Supabase rows and Sequelize model instances
 * Idempotent: safe to call multiple times on the same object
 *
 * Field mappings:
 * - loose_price → loosePrice
 * - cib_price → cibPrice
 * - mint_price → mintPrice
 * - cover_url → coverImage
 * - source_confidence → sourceConfidence
 * - dev_anecdotes → devAnecdotes
 * - dev_team → devTeam
 * - cheat_codes → cheatCodes
 * - franch_id → franchId
 *
 * @param {Object} row - Database row or game object
 * @returns {Object} New object with normalized field names
 */
function normalizeGameFields(row) {
  if (!row || typeof row !== 'object') {
    return row
  }

  return {
    ...row,
    // Pricing fields
    loosePrice: row.loosePrice ?? row.loose_price ?? null,
    cibPrice: row.cibPrice ?? row.cib_price ?? null,
    mintPrice: row.mintPrice ?? row.mint_price ?? null,
    // Image fields
    coverImage: row.coverImage ?? row.cover_url ?? null,
    // Metadata fields
    sourceConfidence: row.sourceConfidence ?? row.source_confidence ?? null,
    // Developer fields
    devAnecdotes: row.devAnecdotes ?? row.dev_anecdotes ?? null,
    devTeam: row.devTeam ?? row.dev_team ?? null,
    // Content fields
    cheatCodes: row.cheatCodes ?? row.cheat_codes ?? null,
    // Relationship fields
    franchId: row.franchId ?? row.franch_id ?? null,
  }
}

/**
 * Normalizes game record using spread operator
 * Merges normalized fields with original object
 * Idempotent: preserves existing camelCase fields if already present
 *
 * This is useful when you want to keep all original fields
 * and only normalize the known fields
 *
 * @param {Object} game - Game object
 * @returns {Object} Object with normalized fields merged in
 */
function normalizeGameRecord(game) {
  if (!game || typeof game !== 'object') {
    return game
  }

  return {
    ...game,
    loosePrice: game.loosePrice ?? game.loose_price ?? null,
    cibPrice: game.cibPrice ?? game.cib_price ?? null,
    mintPrice: game.mintPrice ?? game.mint_price ?? null,
    coverImage: game.coverImage || game.cover_url || null,
  }
}

/**
 * Creates a normalized item payload for API responses
 * Selects and transforms specific fields for public consumption
 *
 * @param {Object} game - Game object from database
 * @returns {Object} Normalized API response object
 */
function toItemPayload(game) {
  if (!game || typeof game !== 'object') {
    return null
  }

  const normalized = normalizeGameFields(game)

  return {
    id: normalized.id,
    title: normalized.title,
    platform: normalized.console,
    year: normalized.year,
    genre: normalized.genre,
    rarity: normalized.rarity,
    type: normalized.type || 'game',
    slug: normalized.slug || null,
    loosePrice: normalized.loosePrice,
    cibPrice: normalized.cibPrice,
    mintPrice: normalized.mintPrice,
    metascore: normalized.metascore ?? null,
    coverImage: normalized.coverImage,
    summary: normalized.summary || normalized.synopsis || null,
  }
}

module.exports = {
  normalizeGameFields,
  normalizeGameRecord,
  toItemPayload,
}
