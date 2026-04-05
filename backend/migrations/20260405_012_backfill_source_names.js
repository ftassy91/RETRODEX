'use strict'

// Backfills games.source_names from price_history.source
// For each game that has price_history rows, aggregates distinct source values
// (e.g. "pricecharting") into a human-readable comma-separated string
// (e.g. "PriceCharting") and stores it in games.source_names.
//
// Only updates rows where source_names IS NULL — safe to re-run.

// Single source of truth for slug → display name mapping.
// Postgres path builds its CASE expression from this; SQLite path uses it directly.
const SOURCE_DISPLAY_NAMES = {
  pricecharting: 'PriceCharting',
  ebay: 'eBay',
  moby: 'MobyGames',
  mobygames: 'MobyGames',
  igdb: 'IGDB',
  vgpc: 'VGPC',
}

function buildPostgresCaseExpr() {
  const branches = Object.entries(SOURCE_DISPLAY_NAMES)
    .map(([slug, label]) => `WHEN '${slug}' THEN '${label}'`)
    .join('\n                ')
  return `CASE source\n                ${branches}\n                ELSE initcap(source)\n              END`
}

module.exports = {
  id: '20260405_012_backfill_source_names',
  description: 'Backfill games.source_names from price_history.source (Sprint B)',
  up: async ({ sequelize }) => {
    const dialect = sequelize.getDialect()

    if (dialect === 'postgres') {
      await sequelize.query(`
        UPDATE games g
        SET source_names = sub.names
        FROM (
          SELECT
            game_id,
            string_agg(
              DISTINCT ${buildPostgresCaseExpr()},
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

      let updated = 0
      let failed = 0
      for (const row of rows) {
        const displayNames = (row.sources || '')
          .split(',')
          .map((s) => SOURCE_DISPLAY_NAMES[s.trim().toLowerCase()] || s.trim())
          .filter(Boolean)
          .join(', ')

        if (!displayNames) continue

        try {
          await sequelize.query(
            `UPDATE games SET source_names = :names WHERE id = :id AND source_names IS NULL`,
            { replacements: { names: displayNames, id: row.game_id } }
          )
          updated += 1
        } catch (err) {
          console.error('[migration 012] Failed to update game_id', row.game_id, err)
          failed += 1
        }
      }
      console.info(`[migration 012] SQLite backfill complete: ${updated} updated, ${failed} failed`)
    }
  },
}
