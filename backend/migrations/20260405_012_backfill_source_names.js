'use strict'

// Backfills games.source_names from price_history.source
// For each game that has price_history rows, aggregates distinct source values
// (e.g. "pricecharting") into a human-readable comma-separated string
// (e.g. "PriceCharting") and stores it in games.source_names.
//
// Only updates rows where source_names IS NULL — safe to re-run.

const SOURCE_DISPLAY_NAMES = {
  pricecharting: 'PriceCharting',
  ebay: 'eBay',
  moby: 'MobyGames',
  mobygames: 'MobyGames',
  igdb: 'IGDB',
  vgpc: 'VGPC',
}

module.exports = {
  id: '20260405_012_backfill_source_names',
  description: 'Backfill games.source_names from price_history.source (Sprint B)',
  up: async ({ sequelize }) => {
    const dialect = sequelize.getDialect()

    if (dialect === 'postgres') {
      // Single-pass update using a lateral subquery — works in both Supabase (PostgREST) and direct Postgres
      // Aggregate and map raw source slugs to display names in a single pass
      await sequelize.query(`
        UPDATE games g
        SET source_names = sub.names
        FROM (
          SELECT
            game_id,
            string_agg(
              DISTINCT CASE source
                WHEN 'pricecharting' THEN 'PriceCharting'
                WHEN 'ebay'          THEN 'eBay'
                WHEN 'mobygames'     THEN 'MobyGames'
                WHEN 'moby'          THEN 'MobyGames'
                WHEN 'igdb'          THEN 'IGDB'
                WHEN 'vgpc'          THEN 'VGPC'
                ELSE initcap(source)
              END,
              ', ' ORDER BY source
            ) AS names
          FROM price_history
          WHERE source IS NOT NULL AND source <> ''
          GROUP BY game_id
        ) sub
        WHERE g.id = sub.game_id
          AND g.source_names IS NULL
      `)
    } else {
      // SQLite fallback: fetch game_ids from price_history, aggregate in JS, bulk-update
      const [rows] = await sequelize.query(`
        SELECT game_id, GROUP_CONCAT(DISTINCT source) AS sources
        FROM price_history
        WHERE source IS NOT NULL AND source <> ''
        GROUP BY game_id
      `)

      for (const row of rows) {
        const displayNames = (row.sources || '')
          .split(',')
          .map((s) => SOURCE_DISPLAY_NAMES[s.trim().toLowerCase()] || s.trim())
          .filter(Boolean)
          .join(', ')

        if (displayNames) {
          await sequelize.query(
            `UPDATE games SET source_names = :names WHERE id = :id AND source_names IS NULL`,
            { replacements: { names: displayNames, id: row.game_id } }
          )
        }
      }
    }
  },
}
