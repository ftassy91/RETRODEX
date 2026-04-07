#!/usr/bin/env node
'use strict'

/**
 * push-ost-devteam-corrections-supabase.js
 *
 * Targeted Supabase update: pushes the corrected ost_composers, ost_notable_tracks,
 * and dev_team from local SQLite to Supabase — overwriting whatever was there before.
 *
 * This is needed because sync-supabase-ui-fields.js only fills empty fields.
 *
 * Usage:
 *   node scripts/enrichment/push-ost-devteam-corrections-supabase.js           # dry-run
 *   node scripts/enrichment/push-ost-devteam-corrections-supabase.js --apply   # write
 */

const path = require('path')
const dotenv = require('dotenv')
const Database = require('better-sqlite3')
const { Client } = require('pg')

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') })

const APPLY = process.argv.includes('--apply')

// IDs we corrected in enrich-dev-team-individuals.js + enrich-ost-corrections*.js
const TARGET_IDS = [
  // Dev team corrections
  'the-legend-of-zelda-ocarina-of-time-nintendo-64',
  'super-mario-64-nintendo-64',
  'super-mario-bros-nintendo-entertainment-system',
  'super-mario-bros-3-nintendo-entertainment-system',
  'super-mario-world-super-nintendo',
  'yoshi-island-super-nintendo',
  'the-legend-of-zelda-nintendo-entertainment-system',
  'the-legend-of-zelda-a-link-to-the-past-super-nintendo',
  'the-legend-of-zelda-a-link-to-the-past-game-boy-advance',
  'majoras-mask-nintendo-64',
  'the-legend-of-zelda-majoras-mask-nintendo-64',
  'super-metroid-super-nintendo',
  'super-mario-kart-super-nintendo',
  'super-mario-rpg-super-nintendo',
  'donkey-kong-country-super-nintendo',
  'banjo-kazooie-nintendo-64',
  'goldeneye-007-nintendo-64',
  'perfect-dark-nintendo-64',
  'kirby-adventure-nintendo-entertainment-system',
  'final-fantasy-vi-super-nintendo',
  'final-fantasy-vi-advance-game-boy-advance',
  'final-fantasy-vii-playstation',
  'final-fantasy-viii-playstation',
  'final-fantasy-ix-playstation',
  'final-fantasy-v-super-nintendo',
  'final-fantasy-tactics-playstation',
  'chrono-trigger-super-nintendo',
  'chrono-cross-playstation',
  'sonic-the-hedgehog-sega-genesis',
  'sonic-the-hedgehog-2-sega-genesis',
  'mega-man-nintendo-entertainment-system',
  'mega-man-2-nintendo-entertainment-system',
  'mega-man-x-super-nintendo',
  'mega-man-7-super-nintendo',
  'mega-man-x4-playstation',
  'street-fighter-ii-turbo-super-nintendo',
  'castlevania-nintendo-entertainment-system',
  'castlevania-iii-draculas-curse-nintendo-entertainment-system',
  'metal-gear-solid-playstation',
  'contra-nintendo-entertainment-system',
  'tekken-3-playstation',
  'metal-slug-3-neo-geo',
  // OST-only corrections
  'paper-mario-nintendo-64',
  'banjo-tooie-nintendo-64',
  'blast-corps-nintendo-64',
  'final-fantasy-iv-super-nintendo',
  'secret-of-mana-super-nintendo',
  'starfox-super-nintendo',
  'donkey-kong-country-2-super-nintendo',
  'donkey-kong-country-3-super-nintendo',
  'super-punch-out-super-nintendo',
  'zombies-ate-my-neighbors-super-nintendo',
  'final-fantasy-iii-nintendo-entertainment-system',
  'final-fantasy-ii-nintendo-entertainment-system',
  'mike-tysons-punch-out-nintendo-entertainment-system',
  'bionic-commando-nintendo-entertainment-system',
  'adventures-of-lolo-nintendo-entertainment-system',
  'golden-sun-game-boy-advance',
  'golden-sun-the-lost-age-game-boy-advance',
  'castlevania-aria-of-sorrow-game-boy-advance',
  'castlevania-harmony-of-dissonance-game-boy-advance',
  'megaman-zero-game-boy-advance',
  'mega-man-zero-3-game-boy-advance',
  'fire-emblem-game-boy-advance',
  'mother-3-game-boy-advance',
  'the-world-ends-with-you-nintendo-ds',
  'mario-kart-ds-nintendo-ds',
  'the-legend-of-zelda-phantom-hourglass-nintendo-ds',
  'mario-and-luigi-bowsers-inside-story-nintendo-ds',
  'dragon-quest-ix-nintendo-ds',
  'professor-layton-and-the-curious-village-nintendo-ds',
  'final-fantasy-xii-revenant-wings-nintendo-ds',
  'crash-team-racing-playstation',
  'spyro-the-dragon-playstation',
  'spyro-2-riptos-rage-playstation',
  'spyro-year-of-the-dragon-playstation',
  'silent-hill-playstation',
  'parasite-eve-playstation',
  'suikoden-playstation',
  'um-jammer-lammy-playstation',
  'castlevania-chronicles-playstation',
  'shining-force-sega-genesis',
  'castle-of-illusion-sega-genesis',
  'sonic-the-hedgehog-3-sega-genesis',
  'skies-of-arcadia-dreamcast',
  'jet-set-radio-dreamcast',
  'sonic-adventure-dreamcast',
  'shenmue-dreamcast',
  'castlevania-symphony-of-the-night-sega-saturn',
  'panzer-dragoon-ii-zwei-sega-saturn',
  'shining-the-holy-ark-sega-saturn',
  'burning-rangers-sega-saturn',
  'shadowrun-super-nintendo',
  'killer-instinct-super-nintendo',
  'gran-turismo-playstation',
  'tony-hawks-pro-skater-2-playstation',
  'tony-hawks-pro-skater-2-dreamcast',
  'radiant-silvergun-sega-saturn',
  'duck-hunt-nintendo-entertainment-system',
  'ghosts-n-goblins-nintendo-entertainment-system',
  'soul-calibur-dreamcast',
]

function parseProjectReference() {
  const raw = process.env.SUPABASE_URL || process.env.SUPABASE_Project_URL || ''
  const match = String(raw).match(/([a-z0-9]{20})/i)
  return match ? String(match[0]) : ''
}

function buildRemotePgConfig() {
  const projectReference = parseProjectReference()
  const rawUrl = process.env.SUPABASE_Project_URL || process.env.DATABASE_URL || ''
  let password = ''
  const passwordMatch = rawUrl.match(/postgres(?:\.[^:]+)?:\[?([^\]@]+)\]?@/i)
  if (passwordMatch) password = passwordMatch[1]
  if (!projectReference || !password) {
    throw new Error('Missing Supabase pooler configuration. Check backend/.env.')
  }
  return {
    host: 'aws-1-eu-west-1.pooler.supabase.com',
    port: 6543,
    user: `postgres.${projectReference}`,
    password,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
  }
}

async function main() {
  if (APPLY) {
    console.log('[APPLY MODE] Will write to Supabase\n')
  } else {
    console.log('[DRY RUN] Pass --apply to write to Supabase\n')
  }

  const DB_PATH = path.resolve(__dirname, '../../storage/retrodex.sqlite')
  const sqlite = new Database(DB_PATH)

  // Load corrected local data
  const placeholders = TARGET_IDS.map(() => '?').join(',')
  const localRows = sqlite
    .prepare(
      `SELECT id, title, dev_team, ost_composers, ost_notable_tracks
       FROM games
       WHERE id IN (${placeholders})`
    )
    .all(...TARGET_IDS)

  const localMap = new Map(localRows.map((r) => [r.id, r]))
  sqlite.close()

  let updated = 0
  let skipped = 0
  let errors = 0

  if (!APPLY) {
    console.log(`Games targeted: ${TARGET_IDS.length}`)
    console.log('\nSample corrections:')
    for (const id of TARGET_IDS.slice(0, 8)) {
      const row = localMap.get(id)
      if (!row) { console.log(`  MISSING: ${id}`); continue }
      console.log(`\n  ▶ ${id}`)
      if (row.dev_team) console.log(`    dev_team: ${row.dev_team.substring(0, 80)}`)
      if (row.ost_composers) console.log(`    ost_composers: ${row.ost_composers.substring(0, 80)}`)
      if (row.ost_notable_tracks) console.log(`    tracks: ${row.ost_notable_tracks.substring(0, 80)}`)
    }
    console.log('\n[DRY RUN] No changes written. Re-run with --apply.')
    return
  }

  // Connect to Supabase
  const client = new Client(buildRemotePgConfig())
  await client.connect()

  try {
    for (const id of TARGET_IDS) {
      const row = localMap.get(id)
      if (!row) {
        console.warn(`  SKIP ${id} — not found in local DB`)
        skipped++
        continue
      }

      try {
        const res = await client.query(
          `UPDATE public.games
           SET dev_team = $1::jsonb,
               ost_composers = $2::jsonb,
               ost_notable_tracks = $3::jsonb,
               updated_at = NOW()
           WHERE id = $4
           RETURNING id`,
          [
            row.dev_team || null,
            row.ost_composers || null,
            row.ost_notable_tracks || null,
            id,
          ]
        )

        if (res.rowCount > 0) {
          console.log(`  ✓ ${id}`)
          updated++
        } else {
          console.warn(`  SKIP ${id} — not found in Supabase`)
          skipped++
        }
      } catch (err) {
        console.error(`  ✗ ${id}: ${err.message}`)
        errors++
      }
    }
  } finally {
    await client.end()
  }

  console.log(`\n──────────────────────────────────────────`)
  console.log(`Updated  : ${updated}`)
  console.log(`Skipped  : ${skipped}`)
  console.log(`Errors   : ${errors}`)
  console.log('\n✓ Supabase targeted correction push complete.')
}

main().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
