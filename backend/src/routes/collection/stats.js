'use strict'
// DATA: supabase via Supabase-only services - Sequelize non utilise dans ce fichier

const { Router } = require('express')

const { handleAsync } = require('../../helpers/query')
const { resolveRequestCollectionScope } = require('../../middleware/auth')
const {
  getCollectionStats,
} = require('../../services/public-collection-service')
const { db, mode } = require('../../../db_supabase')

const router = Router()

router.get('/api/collection/stats', handleAsync(async (req, res) => {
  const stats = await getCollectionStats(resolveRequestCollectionScope(req))
  return res.json({
    ...stats,
    total: stats.count,
  })
}))

router.get('/api/collection/snapshots', handleAsync(async (_req, res) => {
  if (mode !== 'supabase') {
    return res.json({ snapshots: [] })
  }

  const { data, error } = await db
    .from('collection_snapshots')
    .select('snapshot_date,total_items,total_value_loose,total_value_cib,total_value_mint,total_paid,dominant_currency,total_medium_confidence,total_high_confidence')
    .order('snapshot_date', { ascending: true })
    .limit(90)

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  return res.json({ snapshots: data || [] })
}))

module.exports = router
