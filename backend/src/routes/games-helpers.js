'use strict'

const { QueryTypes, literal } = require('sequelize')
const Game = require('../models/Game')

const { db: priceHistoryDb, mode: priceHistoryMode } = require('../../db_supabase')
const { sequelize, databaseMode } = require('../database')
const {
  toGameSummary,
  parseStoredJson,
  normalizeGameRecord,
  rarityRankDescending,
  rarityRankAscending,
  compareNullableNumbers,
  compareGamesForSort,
} = require('../lib/normalize')

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
