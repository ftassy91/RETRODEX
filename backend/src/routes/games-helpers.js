'use strict'

const { QueryTypes, literal } = require('sequelize')
const Game = require('../models/Game')

process.env.SUPABASE_URL = process.env.SUPABASE_URL || process.env.SUPERDATA_Project_URL
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
  || process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPERDATA_SERVICE_KEY
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPERDATA_Anon_Key

const { db: priceHistoryDb, mode: priceHistoryMode } = require('../../db_supabase')
const { sequelize, databaseMode } = require('../database')

function buildGamesOrder(sort) {
  const sortKey = String(sort || '').trim()

  const SORT_MAP = {
    title_asc: [['title', 'ASC']],
    title_desc: [['title', 'DESC']],
    price_asc: [
      [literal('CASE WHEN loose_price IS NULL THEN 1 ELSE 0 END'), 'ASC'],
      ['loosePrice', 'ASC'],
      ['title', 'ASC'],
    ],
    price_desc: [
      [literal('CASE WHEN loose_price IS NULL THEN 1 ELSE 0 END'), 'ASC'],
      ['loosePrice', 'DESC'],
      ['title', 'ASC'],
    ],
    year_asc: [
      [literal('CASE WHEN year IS NULL THEN 1 ELSE 0 END'), 'ASC'],
      ['year', 'ASC'],
      ['title', 'ASC'],
    ],
    year_desc: [
      [literal('CASE WHEN year IS NULL THEN 1 ELSE 0 END'), 'ASC'],
      ['year', 'DESC'],
      ['title', 'ASC'],
    ],
    meta_asc: [
      [literal('CASE WHEN metascore IS NULL THEN 1 ELSE 0 END'), 'ASC'],
      ['metascore', 'ASC'],
      ['title', 'ASC'],
    ],
    meta_desc: [
      [literal('CASE WHEN metascore IS NULL THEN 1 ELSE 0 END'), 'ASC'],
      ['metascore', 'DESC'],
      ['title', 'ASC'],
    ],
    metascore_asc: [
      [literal('CASE WHEN metascore IS NULL THEN 1 ELSE 0 END'), 'ASC'],
      ['metascore', 'ASC'],
      ['title', 'ASC'],
    ],
    metascore_desc: [
      [literal('CASE WHEN metascore IS NULL THEN 1 ELSE 0 END'), 'ASC'],
      ['metascore', 'DESC'],
      ['title', 'ASC'],
    ],
    rarity_desc: [
      [literal(`CASE rarity
        WHEN 'LEGENDARY' THEN 0
        WHEN 'EPIC' THEN 1
        WHEN 'RARE' THEN 2
        WHEN 'UNCOMMON' THEN 3
        WHEN 'COMMON' THEN 4
        ELSE 5
      END`), 'ASC'],
      [literal('CASE WHEN loose_price IS NULL THEN 1 ELSE 0 END'), 'ASC'],
      ['loosePrice', 'DESC'],
      ['title', 'ASC'],
    ],
    rarity_asc: [
      [literal(`CASE rarity
        WHEN 'COMMON' THEN 0
        WHEN 'UNCOMMON' THEN 1
        WHEN 'RARE' THEN 2
        WHEN 'EPIC' THEN 3
        WHEN 'LEGENDARY' THEN 4
        ELSE 5
      END`), 'ASC'],
      ['title', 'ASC'],
    ],
  }

  return SORT_MAP[sortKey] || SORT_MAP.title_asc
}

function toGameSummary(game) {
  return {
    id: game.id,
    title: game.title,
    console: game.console,
    year: game.year,
    genre: game.genre,
    developer: game.developer,
    metascore: game.metascore,
    rarity: game.rarity,
    summary: game.summary,
    prices: {
      loose: game.loosePrice,
      cib: game.cibPrice,
      mint: game.mintPrice,
    },
  }
}

function parseStoredJson(value) {
  if (value == null || value === '') {
    return null
  }

  if (Array.isArray(value) || typeof value === 'object') {
    return value
  }

  if (typeof value !== 'string') {
    return null
  }

  try {
    return JSON.parse(value)
  } catch (_error) {
    return null
  }
}

async function findGameById(id) {
  return Game.findByPk(id)
}

async function fetchSeedPriceHistory(gameId) {
  if (priceHistoryMode === 'supabase') {
    const { data, error } = await priceHistoryDb
      .from('price_history')
      .select('price,condition,sale_date')
      .eq('game_id', gameId)
      .order('sale_date', { ascending: true })
      .limit(2000)

    if (error) {
      throw new Error(error.message)
    }

    return data || []
  }

  if (databaseMode !== 'sqlite') {
    return []
  }

  try {
    return await sequelize.query(
      `SELECT price, condition, sale_date
       FROM price_history
       WHERE game_id = :gameId
       ORDER BY sale_date ASC
       LIMIT 2000`,
      {
        replacements: { gameId },
        type: QueryTypes.SELECT,
      }
    )
  } catch (_error) {
    return []
  }
}

function normalizeGameRecord(game) {
  if (!game || typeof game !== 'object') {
    return game
  }

  return {
    ...game,
    loosePrice: game.loosePrice ?? game.loose_price ?? null,
    cibPrice: game.cibPrice ?? game.cib_price ?? null,
    mintPrice: game.mintPrice ?? game.mint_price ?? null,
    coverImage: game.cover_url || game.coverImage || null,
  }
}

function rarityRankDescending(value) {
  switch (String(value || '').toUpperCase()) {
    case 'LEGENDARY': return 0
    case 'EPIC': return 1
    case 'RARE': return 2
    case 'UNCOMMON': return 3
    case 'COMMON': return 4
    default: return 5
  }
}

function rarityRankAscending(value) {
  switch (String(value || '').toUpperCase()) {
    case 'COMMON': return 0
    case 'UNCOMMON': return 1
    case 'RARE': return 2
    case 'EPIC': return 3
    case 'LEGENDARY': return 4
    default: return 5
  }
}

function compareNullableNumbers(left, right, ascending = true) {
  const leftEmpty = left == null || String(left).trim() === ''
  const rightEmpty = right == null || String(right).trim() === ''
  const leftNumber = Number(left)
  const rightNumber = Number(right)
  const leftMissing = leftEmpty || !Number.isFinite(leftNumber)
  const rightMissing = rightEmpty || !Number.isFinite(rightNumber)

  if (leftMissing && rightMissing) return 0
  if (leftMissing) return 1
  if (rightMissing) return -1

  return ascending ? leftNumber - rightNumber : rightNumber - leftNumber
}

function compareGamesForSort(leftGame, rightGame, sortKey) {
  const left = normalizeGameRecord(leftGame)
  const right = normalizeGameRecord(rightGame)
  const leftTitle = String(left.title || '')
  const rightTitle = String(right.title || '')

  switch (String(sortKey || '').trim()) {
    case 'title_desc':
      return rightTitle.localeCompare(leftTitle, 'fr', { sensitivity: 'base' })
    case 'price_asc':
      return compareNullableNumbers(left.loosePrice, right.loosePrice, true)
        || leftTitle.localeCompare(rightTitle, 'fr', { sensitivity: 'base' })
    case 'price_desc':
      return compareNullableNumbers(left.loosePrice, right.loosePrice, false)
        || leftTitle.localeCompare(rightTitle, 'fr', { sensitivity: 'base' })
    case 'year_asc':
      return compareNullableNumbers(left.year, right.year, true)
        || leftTitle.localeCompare(rightTitle, 'fr', { sensitivity: 'base' })
    case 'year_desc':
      return compareNullableNumbers(left.year, right.year, false)
        || leftTitle.localeCompare(rightTitle, 'fr', { sensitivity: 'base' })
    case 'meta_asc':
    case 'metascore_asc':
      return compareNullableNumbers(left.metascore, right.metascore, true)
        || leftTitle.localeCompare(rightTitle, 'fr', { sensitivity: 'base' })
    case 'meta_desc':
    case 'metascore_desc':
      return compareNullableNumbers(left.metascore, right.metascore, false)
        || leftTitle.localeCompare(rightTitle, 'fr', { sensitivity: 'base' })
    case 'rarity_desc':
      return rarityRankDescending(left.rarity) - rarityRankDescending(right.rarity)
        || compareNullableNumbers(left.loosePrice, right.loosePrice, false)
        || leftTitle.localeCompare(rightTitle, 'fr', { sensitivity: 'base' })
    case 'rarity_asc':
      return rarityRankAscending(left.rarity) - rarityRankAscending(right.rarity)
        || leftTitle.localeCompare(rightTitle, 'fr', { sensitivity: 'base' })
    case 'title_asc':
    default:
      return leftTitle.localeCompare(rightTitle, 'fr', { sensitivity: 'base' })
  }
}

module.exports = {
  buildGamesOrder,
  toGameSummary,
  parseStoredJson,
  findGameById,
  fetchSeedPriceHistory,
  normalizeGameRecord,
  rarityRankDescending,
  rarityRankAscending,
  compareNullableNumbers,
  compareGamesForSort,
}
