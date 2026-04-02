#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const Database = require('better-sqlite3')
const {
  SQLITE_PATH,
  TOP1200_DIR,
  latestJsonFile,
  loadSelectionBand,
  parseStringFlag,
} = require('./_work-catalog-common')

const RICHNESS_DIR = path.join(__dirname, '..', '..', 'data', 'enrichment', 'richness')

const FIELD_DEFINITIONS = [
  { key: 'summary', label: 'Summary', targetClass: 'core', strongTarget: 0.8, sql: `summary IS NOT NULL AND TRIM(summary) <> ''` },
  { key: 'synopsis', label: 'Synopsis', targetClass: 'core', strongTarget: 0.35, sql: `synopsis IS NOT NULL AND TRIM(synopsis) <> ''` },
  { key: 'tagline', label: 'Tagline', targetClass: 'premium', strongTarget: 0.15, sql: `tagline IS NOT NULL AND TRIM(tagline) <> ''` },
  { key: 'dev_team_text', label: 'Dev Team (text)', targetClass: 'core', strongTarget: 0.9, sql: `dev_team IS NOT NULL AND TRIM(dev_team) <> ''` },
  { key: 'ost_notable_tracks', label: 'OST Notable Tracks', targetClass: 'core', strongTarget: 0.2, sql: `ost_notable_tracks IS NOT NULL AND TRIM(ost_notable_tracks) <> ''` },
  { key: 'manual', label: 'Manual', targetClass: 'core', strongTarget: 0.2, sql: `manual_url IS NOT NULL AND TRIM(manual_url) <> ''` },
  { key: 'map', label: 'Maps', targetClass: 'premium', strongTarget: 0.08, sql: `EXISTS (SELECT 1 FROM media_references mr WHERE mr.entity_type = 'game' AND mr.entity_id = games.id AND mr.media_type = 'map')` },
  { key: 'sprite', label: 'Sprites / Sheets', targetClass: 'premium', strongTarget: 0.08, sql: `EXISTS (SELECT 1 FROM media_references mr WHERE mr.entity_type = 'game' AND mr.entity_id = games.id AND mr.media_type IN ('sprite_sheet', 'sprites', 'sprite'))` },
  { key: 'ending', label: 'Ending', targetClass: 'premium', strongTarget: 0.03, sql: `EXISTS (SELECT 1 FROM media_references mr WHERE mr.entity_type = 'game' AND mr.entity_id = games.id AND mr.media_type = 'ending')` },
  { key: 'dev_anecdotes', label: 'Dev Anecdotes', targetClass: 'premium', strongTarget: 0.15, sql: `dev_anecdotes IS NOT NULL AND TRIM(dev_anecdotes) <> ''` },
  { key: 'versions', label: 'Versions', targetClass: 'premium', strongTarget: 0.15, sql: `versions IS NOT NULL AND TRIM(versions) <> ''` },
  {
    key: 'crew_profile_complete',
    label: 'Crew Profile Complete',
    targetClass: 'core',
    strongTarget: 0.9,
    sql: `
      EXISTS (SELECT 1 FROM game_companies gc WHERE gc.game_id = games.id)
      AND (
        EXISTS (SELECT 1 FROM game_people gp WHERE gp.game_id = games.id AND gp.role = 'developer')
        OR (dev_team IS NOT NULL AND TRIM(dev_team) <> '')
      )
      AND (
        EXISTS (SELECT 1 FROM game_people gp WHERE gp.game_id = games.id AND gp.role = 'composer')
        OR (ost_composers IS NOT NULL AND TRIM(ost_composers) <> '')
      )
      AND EXISTS (SELECT 1 FROM game_people gp WHERE gp.game_id = games.id)
    `,
  },
  {
    key: 'cheat_codes',
    label: 'Cheat Codes',
    targetClass: 'expert_eligible',
    strongTarget: 0.3,
    eligibleSql: `
      cheat_codes IS NOT NULL AND TRIM(cheat_codes) <> ''
      OR EXISTS (
        SELECT 1
        FROM source_records sr
        WHERE sr.entity_type = 'game'
          AND sr.entity_id = games.id
          AND sr.field_name = 'cheat_codes'
      )
    `,
    sql: `cheat_codes IS NOT NULL AND TRIM(cheat_codes) <> ''`,
  },
  {
    key: 'avg_duration',
    label: 'Duration (Main/Complete)',
    targetClass: 'expert_eligible',
    strongTarget: 0.5,
    eligibleSql: `
      avg_duration_main IS NOT NULL
      OR avg_duration_complete IS NOT NULL
      OR EXISTS (
        SELECT 1
        FROM source_records sr
        WHERE sr.entity_type = 'game'
          AND sr.entity_id = games.id
          AND sr.field_name IN ('avg_duration_main', 'avg_duration_complete')
      )
    `,
    sql: `avg_duration_main IS NOT NULL OR avg_duration_complete IS NOT NULL`,
  },
  {
    key: 'expert_signals',
    label: 'Speedrun / Records',
    targetClass: 'expert_eligible',
    strongTarget: 0.6,
    eligibleSql: `
      speedrun_wr IS NOT NULL AND TRIM(speedrun_wr) <> ''
      OR EXISTS (SELECT 1 FROM game_record_categories grc WHERE grc.game_id = games.id)
      OR EXISTS (SELECT 1 FROM game_record_entries gre WHERE gre.game_id = games.id)
      OR EXISTS (SELECT 1 FROM game_competitive_profiles gcp WHERE gcp.game_id = games.id)
    `,
    sql: `
      speedrun_wr IS NOT NULL AND TRIM(speedrun_wr) <> ''
      OR EXISTS (SELECT 1 FROM game_record_categories grc WHERE grc.game_id = games.id)
      OR EXISTS (SELECT 1 FROM game_record_entries gre WHERE gre.game_id = games.id)
      OR EXISTS (SELECT 1 FROM game_competitive_profiles gcp WHERE gcp.game_id = games.id)
    `,
  },
]

function latestResidueFile() {
  if (!fs.existsSync(RICHNESS_DIR)) return null
  const files = fs.readdirSync(RICHNESS_DIR)
    .filter((entry) => entry.endsWith('_top1200_richness_blocked_residue.json'))
    .map((entry) => ({
      path: path.join(RICHNESS_DIR, entry),
      stat: fs.statSync(path.join(RICHNESS_DIR, entry)),
    }))
    .sort((left, right) => right.stat.mtimeMs - left.stat.mtimeMs)
  return files[0]?.path || null
}

function placeholders(ids) {
  return ids.map(() => '?').join(', ')
}

function roundPercent(value) {
  return Number((value * 100).toFixed(1))
}

function classifyStatus(coverage, target, blockedCount, eligibleCount, targetClass, filledCount) {
  if (targetClass === 'expert_eligible' && blockedCount === 0 && eligibleCount === filledCount && filledCount < 25) {
    return 'weak'
  }
  if (eligibleCount === 0 && blockedCount > 0) return 'blocked_by_source'
  if (coverage >= target) return 'strong'
  if (blockedCount > 0 && coverage < target) return 'blocked_by_source'
  if (coverage >= target * 0.75) return 'close'
  return 'weak'
}

function loadBlockedCounts(filePath) {
  if (!filePath) return { filePath: null, counts: {} }
  const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  const counts = {}

  for (const [key, entries] of Object.entries(payload?.fields || {})) {
    counts[key] = Array.isArray(entries) ? entries.length : Number(entries?.count || 0)
  }

  return { filePath, counts }
}

function main() {
  const top1200Path = parseStringFlag(process.argv, 'top1200', latestJsonFile(TOP1200_DIR))
  const blockedResiduePath = parseStringFlag(process.argv, 'blocked-residue', latestResidueFile())
  const band = loadSelectionBand(top1200Path)
  const ids = band.ids.slice(0, 1200)
  const db = new Database(SQLITE_PATH, { readonly: true })

  try {
    const idPlaceholders = placeholders(ids)
    const { filePath: residuePathUsed, counts: blockedCounts } = loadBlockedCounts(blockedResiduePath)
    const fields = {}

    for (const definition of FIELD_DEFINITIONS) {
      const filledCount = db.prepare(`
        SELECT COUNT(*) AS c
        FROM games
        WHERE type = 'game'
          AND id IN (${idPlaceholders})
          AND (${definition.sql})
      `).get(...ids).c

      const eligibleCount = definition.eligibleSql
        ? db.prepare(`
          SELECT COUNT(*) AS c
          FROM games
          WHERE type = 'game'
            AND id IN (${idPlaceholders})
            AND (${definition.eligibleSql})
        `).get(...ids).c
        : ids.length

      const denominator = eligibleCount || ids.length
      const coverage = denominator ? filledCount / denominator : 0
      const blockedCount = Number(blockedCounts[definition.key] || 0)

      fields[definition.key] = {
        label: definition.label,
        target_class: definition.targetClass,
        strong_target: roundPercent(definition.strongTarget),
        filled_count: filledCount,
        eligible_count: definition.eligibleSql ? eligibleCount : null,
        coverage_pct: roundPercent(coverage),
        gap_to_target: Math.max(0, Math.ceil((definition.strongTarget * denominator) - filledCount)),
        blocked_count: blockedCount,
        status: classifyStatus(coverage, definition.strongTarget, blockedCount, eligibleCount, definition.targetClass, filledCount),
      }
    }

    const summary = {
      strong: Object.keys(fields).filter((key) => fields[key].status === 'strong'),
      close: Object.keys(fields).filter((key) => fields[key].status === 'close'),
      weak: Object.keys(fields).filter((key) => fields[key].status === 'weak'),
      blocked_by_source: Object.keys(fields).filter((key) => fields[key].status === 'blocked_by_source'),
    }

    console.log(JSON.stringify({
      generatedAt: new Date().toISOString(),
      sources: {
        top1200: top1200Path,
        blockedResidue: residuePathUsed,
      },
      top1200: {
        total: ids.length,
        label: band.label,
      },
      summary,
      fields,
    }, null, 2))
  } finally {
    db.close()
  }
}

try {
  main()
} catch (error) {
  console.error('[report-top1200-richness]', error && error.stack ? error.stack : error)
  process.exitCode = 1
}
