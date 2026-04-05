'use strict'

const { db } = require('../../../db_supabase')

async function fetchGameRegions(gameId) {
  const { data, error } = await db
    .from('game_regions')
    .select('region_code')
    .eq('game_id', gameId)

  if (error) {
    throw new Error(error.message)
  }

  return (data || []).map((r) => r.region_code).filter(Boolean)
}

module.exports = { fetchGameRegions }
