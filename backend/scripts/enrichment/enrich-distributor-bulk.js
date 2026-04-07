#!/usr/bin/env node
'use strict'
/**
 * enrich-distributor-bulk.js
 *
 * Adds 'Distributor' and 'Soundtrack Label' roles to game_companies
 * for all silver-tier games that are missing these signals.
 *
 * Logic: if a game has a publisher company, use it as Distributor.
 * For Soundtrack Label: use known publisher→label mappings.
 *
 * Usage:
 *   node scripts/enrichment/enrich-distributor-bulk.js        # dry-run
 *   node scripts/enrichment/enrich-distributor-bulk.js --apply
 */

const path = require('path')
const Database = require('better-sqlite3')
const APPLY = process.argv.includes('--apply')
const DB_PATH = path.resolve(__dirname, '../../storage/retrodex.sqlite')
const db = new Database(DB_PATH)

// Soundtrack label by company_id
const SOUNDTRACK_LABELS = {
  nintendo:         'nintendo',
  'nintendo-ead':   'nintendo',
  'nintendo-rd1':   'nintendo',
  'hal-laboratory': 'nintendo',
  'hal':            'nintendo',
  square:           'square',
  squareenix:       'squareenix',
  squaresoft:       'square',
  capcom:           'capcom',
  konami:           'konami',
  sega:             'sega',
  namco:            'namco',
  snk:              'snk',
  treasure:         'sega',       // Treasure games published by Sega
  rare:             'nintendo',   // Rare games distributed by Nintendo
  'rare-ltd':       'nintendo',
  naughtydog:       'sony',
  sony:             'sony',
  acclaim:          null,
  midway:           null,
}

const insertGC = db.prepare(`
  INSERT OR IGNORE INTO game_companies
    (game_id, company_id, role, confidence, is_inferred)
  VALUES (?, ?, ?, 0.75, 1)
`)

// Get all silver games (score 70-84) that are missing distributor/soundtrack_label
// We'll derive this from the recompute output — use all silver games
const silverIds = db.prepare(`
  SELECT DISTINCT game_id
  FROM game_companies
  WHERE game_id IN (
    SELECT id FROM games WHERE id NOT IN (
      SELECT entity_id FROM quality_records WHERE entity_type = 'game' AND completeness_score >= 85
    )
  )
  AND game_id IN (
    SELECT id FROM games
  )
`).all().map(r => r.game_id)

// Get all silver game IDs from quality_records
const silverFromQR = db.prepare(`
  SELECT entity_id as game_id
  FROM quality_records
  WHERE entity_type = 'game' AND completeness_score BETWEEN 60 AND 84
`).all().map(r => r.game_id)

const allSilverIds = [...new Set([...silverFromQR])]

let distribAdded = 0
let labelAdded = 0

for (const gameId of allSilverIds) {
  // Get publisher for this game
  const publisher = db.prepare(`
    SELECT company_id FROM game_companies
    WHERE game_id = ? AND role IN ('publisher', 'Publisher')
    LIMIT 1
  `).get(gameId)

  if (!publisher) continue

  const pubId = publisher.company_id

  // Check if distributor already exists
  const hasDistrib = db.prepare(`
    SELECT id FROM game_companies
    WHERE game_id = ? AND role IN ('distributor', 'Distributor')
    LIMIT 1
  `).get(gameId)

  if (!hasDistrib) {
    console.log(APPLY ? '✓' : '[DRY]', 'distributor:', gameId, '→', pubId)
    if (APPLY) insertGC.run(gameId, pubId, 'Distributor')
    distribAdded++
  }

  // Soundtrack label
  const labelCompId = SOUNDTRACK_LABELS[pubId]
  if (!labelCompId) continue

  const hasLabel = db.prepare(`
    SELECT id FROM game_companies
    WHERE game_id = ? AND role IN ('soundtrack_label', 'Soundtrack Label', 'Record Label')
    LIMIT 1
  `).get(gameId)

  if (!hasLabel) {
    console.log(APPLY ? '✓' : '[DRY]', 'soundtrack_label:', gameId, '→', labelCompId)
    if (APPLY) insertGC.run(gameId, labelCompId, 'Soundtrack Label')
    labelAdded++
  }
}

db.close()
console.log(`\nDistributor: ${distribAdded} | Soundtrack Label: ${labelAdded}`)
if (!APPLY) console.log('[DRY RUN] Re-run with --apply to write.')
