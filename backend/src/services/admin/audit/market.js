'use strict'

const { QueryTypes } = require('sequelize')

const { sequelize } = require('../../../database')
const { tableExists } = require('./reads')

async function getMarketAudit() {
  const hasPriceObservations = await tableExists('price_observations')
  const hasMarketSnapshots = await tableExists('market_snapshots')

  const [summaryRows, weakRows, snapshotRows] = await Promise.all([
    (hasPriceObservations
      ? sequelize.query(
        `SELECT COUNT(DISTINCT game_id) AS usableHistories,
                COUNT(*) AS totalObservations
         FROM price_observations`,
        { type: QueryTypes.SELECT }
      )
      : sequelize.query(
        `SELECT COUNT(DISTINCT game_id) AS usableHistories,
                SUM(CASE WHEN sale_date IS NOT NULL THEN 1 ELSE 0 END) AS totalObservations
         FROM price_history`,
        { type: QueryTypes.SELECT }
      )).catch(() => [{ usableHistories: 0, totalObservations: 0 }]),
    (hasMarketSnapshots
      ? sequelize.query(
        `SELECT COUNT(*) AS weakEntries
         FROM games g
         LEFT JOIN market_snapshots ms ON ms.game_id = g.id
         WHERE g.type = 'game'
           AND COALESCE(ms.loose_price, g.loose_price, 0) = 0
           AND COALESCE(ms.cib_price, g.cib_price, 0) = 0
           AND COALESCE(ms.mint_price, g.mint_price, 0) = 0`,
        { type: QueryTypes.SELECT }
      )
      : sequelize.query(
        `SELECT COUNT(*) AS weakEntries
         FROM games
         WHERE type = 'game'
           AND COALESCE(loose_price, 0) = 0
           AND COALESCE(cib_price, 0) = 0
           AND COALESCE(mint_price, 0) = 0`,
        { type: QueryTypes.SELECT }
      )),
    (hasMarketSnapshots
      ? sequelize.query(
        `SELECT COUNT(*) AS reliableSnapshots
         FROM market_snapshots
         WHERE COALESCE(loose_price, 0) > 0
            OR COALESCE(cib_price, 0) > 0
            OR COALESCE(mint_price, 0) > 0`,
        { type: QueryTypes.SELECT }
      )
      : sequelize.query(
        `SELECT COUNT(*) AS reliableSnapshots
         FROM games
         WHERE type = 'game'
           AND (
             COALESCE(loose_price, 0) > 0
             OR COALESCE(cib_price, 0) > 0
             OR COALESCE(mint_price, 0) > 0
           )`,
        { type: QueryTypes.SELECT }
      )),
  ])

  const summary = summaryRows[0] || {}
  return {
    usablePriceHistories: Number(summary.usableHistories || 0),
    reliablePriceSummaries: Number(snapshotRows[0]?.reliableSnapshots || 0),
    weakMarketEntries: Number(weakRows[0]?.weakEntries || 0),
    totalObservations: Number(summary.totalObservations || 0),
  }
}

module.exports = {
  getMarketAudit,
}
