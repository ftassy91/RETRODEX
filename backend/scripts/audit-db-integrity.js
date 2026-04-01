#!/usr/bin/env node
'use strict'

const path = require('path')
const Database = require('better-sqlite3')

function resolveDbPath() {
  const custom = process.argv.find((entry) => String(entry).startsWith('--db='))
  if (custom) {
    return path.resolve(process.cwd(), String(custom).slice('--db='.length))
  }
  return path.resolve(__dirname, '..', 'storage', 'retrodex.sqlite')
}

function groupForeignKeyIssues(rows) {
  const grouped = new Map()
  for (const row of rows) {
    const key = `${row.table}|${row.parent}|${row.fkid}`
    grouped.set(key, (grouped.get(key) || 0) + 1)
  }

  return [...grouped.entries()]
    .map(([key, count]) => {
      const [table, parent, fkid] = key.split('|')
      return { table, parent, fkid: Number(fkid), count }
    })
    .sort((a, b) => b.count - a.count)
}

function main() {
  const dbPath = resolveDbPath()
  const db = new Database(dbPath, { readonly: true })

  const integrity = db.pragma('integrity_check')
  const foreignKeyRows = db.pragma('foreign_key_check')
  const foreignKeyGroups = groupForeignKeyIssues(foreignKeyRows)

  const missingCompanies = db.prepare(`
    WITH referenced_ids AS (
      SELECT developerId AS company_id
      FROM games
      WHERE developerId IS NOT NULL AND TRIM(developerId) <> ''
      UNION
      SELECT publisherId AS company_id
      FROM games
      WHERE publisherId IS NOT NULL AND TRIM(publisherId) <> ''
      UNION
      SELECT company_id
      FROM game_companies
      WHERE company_id IS NOT NULL AND TRIM(company_id) <> ''
    )
    SELECT COUNT(*) AS total
    FROM referenced_ids rid
    LEFT JOIN companies c ON c.id = rid.company_id
    WHERE c.id IS NULL
  `).get().total

  const orphanGameGenres = db.prepare(`
    SELECT COUNT(*) AS total
    FROM game_genres gg
    LEFT JOIN games g ON g.id = gg.gameId
    WHERE g.id IS NULL
  `).get().total

  const compatibleCounts = {
    games: db.prepare(`SELECT COUNT(*) AS total FROM games WHERE type IS NULL OR type = 'game'`).get().total,
    companies: db.prepare(`SELECT COUNT(*) AS total FROM companies`).get().total,
    qualityRecords: db.prepare(`SELECT COUNT(*) AS total FROM quality_records WHERE entity_type = 'game'`).get().total,
    curationStates: db.prepare(`SELECT COUNT(*) AS total FROM game_curation_states`).get().total,
    contentProfiles: db.prepare(`SELECT COUNT(*) AS total FROM game_content_profiles`).get().total,
  }

  console.log(JSON.stringify({
    dbPath,
    generatedAt: new Date().toISOString(),
    integrityCheck: integrity,
    foreignKeyIssueCount: foreignKeyRows.length,
    foreignKeyGroups,
    orphanCounts: {
      missingCompanies,
      orphanGameGenres,
    },
    compatibleCounts,
  }, null, 2))
}

try {
  main()
} catch (error) {
  console.error('[audit-db-integrity]', error && error.stack ? error.stack : error)
  process.exitCode = 1
}
