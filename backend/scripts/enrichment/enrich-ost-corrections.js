#!/usr/bin/env node
'use strict'

/**
 * enrich-ost-corrections.js
 *
 * Fixes two OST data quality problems:
 *   1. ost_composers entries that contain company/publisher names → replace with
 *      real individual composer names.
 *   2. ost_notable_tracks that are empty or missing for games that deserve them.
 *
 * Also syncs corrections to game_people (composer role) + people tables.
 *
 * Usage:
 *   node scripts/enrichment/enrich-ost-corrections.js           # dry-run
 *   node scripts/enrichment/enrich-ost-corrections.js --apply   # write
 */

const Database = require('better-sqlite3')
const path = require('path')

const DRY_RUN = !process.argv.includes('--apply')

// ---------------------------------------------------------------------------
// Correction payload
// ---------------------------------------------------------------------------
// Each entry:
//   gameId        — games.id
//   composers     — replacement for ost_composers (array of { name, role })
//   tracks        — replacement for ost_notable_tracks (string[] or null = leave untouched)
// ---------------------------------------------------------------------------
const OST_CORRECTIONS = [
  // ── Nintendo games with "Nintendo" as placeholder ─────────────────────────

  {
    gameId: 'super-mario-bros-nintendo-entertainment-system',
    composers: [{ name: 'Koji Kondo', role: 'Composer' }],
    tracks: null, // already has good tracks
  },
  {
    gameId: 'super-mario-bros-3-nintendo-entertainment-system',
    composers: [{ name: 'Koji Kondo', role: 'Composer' }],
    tracks: null, // already has good tracks
  },
  {
    gameId: 'super-mario-64-nintendo-64',
    composers: [{ name: 'Koji Kondo', role: 'Composer' }],
    tracks: ['Bob-omb Battlefield', 'Dire Dire Docks', 'Koopa\'s Road', 'Staff Roll', 'Princess Peach\'s Castle'],
  },
  {
    gameId: 'super-mario-world-super-nintendo',
    composers: [{ name: 'Koji Kondo', role: 'Composer' }],
    tracks: ['Title Theme', 'Overworld BGM', 'Castle BGM', 'Ghost House BGM', 'Staff Credits'],
  },
  {
    gameId: 'yoshi-island-super-nintendo',
    composers: [{ name: 'Koji Kondo', role: 'Composer' }],
    tracks: null, // has tracks
  },
  {
    gameId: 'the-legend-of-zelda-nintendo-entertainment-system',
    composers: [{ name: 'Koji Kondo', role: 'Composer' }],
    tracks: ['Overworld', 'Dungeon', 'Title Theme', 'Death Mountain'],
  },
  {
    gameId: 'the-legend-of-zelda-a-link-to-the-past-super-nintendo',
    composers: [{ name: 'Koji Kondo', role: 'Composer' }],
    tracks: ['Hyrule Castle', 'Light World Overworld', 'Dark World Overworld', 'Sanctuary Dungeon', 'Ganon\'s Tower'],
  },
  {
    gameId: 'the-legend-of-zelda-a-link-to-the-past-game-boy-advance',
    composers: [{ name: 'Koji Kondo', role: 'Composer' }],
    tracks: ['Hyrule Castle', 'Light World Overworld', 'Dark World Overworld'],
  },
  {
    gameId: 'majoras-mask-nintendo-64',
    composers: [
      { name: 'Koji Kondo', role: 'Composer' },
      { name: 'Toru Minegishi', role: 'Composer' },
    ],
    tracks: ['Clock Town (First Day)', 'Song of Healing', 'Termina Field', 'Stone Tower Temple', 'Final Hours'],
  },
  {
    gameId: 'the-legend-of-zelda-majoras-mask-nintendo-64',
    composers: [
      { name: 'Koji Kondo', role: 'Composer' },
      { name: 'Toru Minegishi', role: 'Composer' },
    ],
    tracks: ['Clock Town (First Day)', 'Song of Healing', 'Termina Field', 'Stone Tower Temple', 'Final Hours'],
  },
  {
    gameId: 'perfect-dark-nintendo-64',
    composers: [
      { name: 'Grant Kirkhope', role: 'Composer' },
      { name: 'Eveline Fischer', role: 'Composer' },
      { name: 'Steve Burke', role: 'Composer' },
    ],
    tracks: ['dataDyne Central', 'Carrington Institute', 'Air Base', 'Perfect Dark Theme'],
  },
  {
    gameId: 'banjo-kazooie-nintendo-64',
    composers: [{ name: 'Grant Kirkhope', role: 'Composer' }],
    tracks: ['Spiral Mountain', 'Mumbo\'s Mountain', 'Treasure Trove Cove', 'Mad Monster Mansion', 'Click Clock Wood'],
  },
  {
    gameId: 'duck-hunt-nintendo-entertainment-system',
    composers: [{ name: 'Hirokazu Tanaka', role: 'Composer' }],
    tracks: null,
  },
  {
    gameId: 'super-mario-kart-super-nintendo',
    composers: [{ name: 'Soyo Oka', role: 'Composer' }],
    tracks: ['Mario Circuit', 'Koopa Beach', 'Ghost Valley', 'Rainbow Road', 'Bowser Castle'],
  },

  // ── GoldenEye 007 ────────────────────────────────────────────────────────

  {
    gameId: 'goldeneye-007-nintendo-64',
    composers: [
      { name: 'Grant Kirkhope', role: 'Composer' },
      { name: 'Graeme Norgate', role: 'Composer' },
      { name: 'Robin Beanland', role: 'Composer' },
    ],
    tracks: ['Dam', 'Frigate', 'Streets', 'GoldenEye Theme', 'Statue'],
  },

  // ── Capcom games ─────────────────────────────────────────────────────────

  {
    gameId: 'mega-man-nintendo-entertainment-system',
    composers: [{ name: 'Manami Matsumae', role: 'Composer' }],
    tracks: ['Cut Man', 'Guts Man', 'Elec Man', 'Dr. Wily Stage 1'],
  },
  {
    gameId: 'mega-man-2-nintendo-entertainment-system',
    composers: [
      { name: 'Takashi Tateishi', role: 'Composer' },
      { name: 'Yoshihiro Sakaguchi', role: 'Composer' },
    ],
    tracks: null, // already has tracks presumably
  },
  {
    gameId: 'ghosts-n-goblins-nintendo-entertainment-system',
    composers: [{ name: 'Ayako Mori', role: 'Composer' }],
    tracks: ['Title Theme', 'Ground BGM', 'Haunted Graveyard'],
  },

  // ── Konami games ─────────────────────────────────────────────────────────

  {
    gameId: 'metal-gear-solid-playstation',
    composers: [
      { name: 'Kazuki Muraoka', role: 'Composer' },
      { name: 'Hiroyuki Togo', role: 'Composer' },
    ],
    tracks: ['The Best Is Yet to Come', 'Metal Gear Solid Main Theme', 'Enclosure', 'Rex\'s Lair'],
  },

  // ── Sega / Sonic Team ────────────────────────────────────────────────────

  {
    gameId: 'sonic-the-hedgehog-sega-genesis',
    composers: [{ name: 'Masato Nakamura', role: 'Composer' }],
    tracks: ['Green Hill Zone', 'Marble Zone', 'Spring Yard Zone', 'Star Light Zone', 'Final Zone'],
  },
  {
    gameId: 'sonic-the-hedgehog-2-sega-genesis',
    composers: [{ name: 'Masato Nakamura', role: 'Composer' }],
    tracks: ['Emerald Hill Zone', 'Chemical Plant Zone', 'Casino Night Zone', 'Wing Fortress Zone', 'Death Egg Zone'],
  },

  // ── Namco games ──────────────────────────────────────────────────────────

  {
    gameId: 'tekken-3-playstation',
    composers: [
      { name: 'Yoshie Arakawa', role: 'Composer' },
      { name: 'Nobuyoshi Sano', role: 'Composer' },
    ],
    tracks: ['Hwoarang\'s Stage', 'Jin\'s Stage', 'Final Stage', 'Character Select'],
  },
  {
    gameId: 'soul-calibur-dreamcast',
    composers: [
      { name: 'Junichi Nakatsuru', role: 'Composer' },
      { name: 'Masaharu Iwata', role: 'Composer' },
    ],
    tracks: ['Sail Over the Storm', 'Unblessed Soul', 'The Graveyard Orbit in the Dense Sea'],
  },

  // ── Square / SquareSoft ──────────────────────────────────────────────────

  {
    gameId: 'final-fantasy-ix-playstation',
    composers: [{ name: 'Nobuo Uematsu', role: 'Composer' }],
    tracks: ['Prelude', 'The Place I\'ll Return to Someday', 'Vamo alla Flamenco', 'You\'re Not Alone', 'A Place to Call Home'],
  },
  {
    gameId: 'final-fantasy-vi-advance-game-boy-advance',
    composers: [{ name: 'Nobuo Uematsu', role: 'Composer' }],
    tracks: null,
  },

  // ── Sony / Polyphony ─────────────────────────────────────────────────────

  {
    gameId: 'gran-turismo-playstation',
    composers: [
      { name: 'Masahiro Andoh', role: 'Composer' },
      { name: 'Isao Ichikawa', role: 'Composer' },
    ],
    tracks: ['Interlude', 'Moon Over the Castle', 'Get It Together', 'Light Velocity'],
  },

  // ── Activision ───────────────────────────────────────────────────────────

  {
    // THPS2: licensed punk/rock soundtrack — no single composer
    // Replace publisher name with accurate description
    gameId: 'tony-hawks-pro-skater-2-playstation',
    composers: [
      { name: 'Various Artists', role: 'Licensed Soundtrack' },
    ],
    tracks: ['Superman — Goldfinger', 'Guerrilla Radio — Rage Against the Machine', 'When Worlds Collide — Powerman 5000', 'Cyco Vision — Suicidal Tendencies'],
  },
  {
    gameId: 'tony-hawks-pro-skater-2-dreamcast',
    composers: [
      { name: 'Various Artists', role: 'Licensed Soundtrack' },
    ],
    tracks: ['Superman — Goldfinger', 'Guerrilla Radio — Rage Against the Machine', 'When Worlds Collide — Powerman 5000'],
  },

  // ── Treasure ─────────────────────────────────────────────────────────────

  {
    gameId: 'radiant-silvergun-sega-saturn',
    composers: [{ name: 'Hitoshi Sakimoto', role: 'Composer' }],
    tracks: ['Born to be Bone', 'Triggered', 'Hiryu', 'Reoccurrence'],
  },

  // ── Nintendo / Banjo extras ──────────────────────────────────────────────

  {
    gameId: 'donkey-kong-country-super-nintendo',
    composers: [
      { name: 'David Wise', role: 'Composer' },
      { name: 'Eveline Fischer', role: 'Composer' },
    ],
    tracks: ['DK Island Swing', 'Aquatic Ambiance', 'Fear Factory', 'Gangplank Galleon', 'Stickerbrush Symphony'],
  },
]

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function slugify(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

function personId(name) {
  return `person:${slugify(name)}`
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const DB_PATH = path.resolve(__dirname, '../../storage/retrodex.sqlite')
const db = new Database(DB_PATH)

const upsertPerson = db.prepare(`
  INSERT INTO people (id, name, normalized_name, primary_role, created_at, updated_at)
  VALUES (?, ?, ?, 'composer', datetime('now'), datetime('now'))
  ON CONFLICT(id) DO UPDATE SET updated_at = datetime('now')
`)

const upsertGamePeople = db.prepare(`
  INSERT INTO game_people (game_id, person_id, role, billing_order, confidence, is_inferred)
  VALUES (?, ?, 'composer', ?, 0.92, 0)
  ON CONFLICT(game_id, person_id, role) DO UPDATE SET
    billing_order = excluded.billing_order,
    confidence = excluded.confidence
`)

const getGame = db.prepare('SELECT id, ost_composers, ost_notable_tracks FROM games WHERE id = ?')
const updateOst = db.prepare(`
  UPDATE games
  SET ost_composers = ?,
      ost_notable_tracks = CASE WHEN ? IS NOT NULL THEN ? ELSE ost_notable_tracks END
  WHERE id = ?
`)

let totalGames = 0
let skipped = 0

if (DRY_RUN) {
  console.log('[DRY RUN] Pass --apply to write changes\n')
}

const runBatch = db.transaction(() => {
  for (const entry of OST_CORRECTIONS) {
    const game = getGame.get(entry.gameId)
    if (!game) {
      console.warn(`  SKIP  ${entry.gameId} — game not found`)
      skipped++
      continue
    }

    totalGames++
    const oldComposers = game.ost_composers
    const newComposers = JSON.stringify(entry.composers)
    const newTracks = entry.tracks ? JSON.stringify(entry.tracks) : null

    console.log(`\n▶ ${entry.gameId}`)
    console.log(`  composers: ${oldComposers?.substring(0, 60)} → ${newComposers.substring(0, 60)}`)
    if (entry.tracks) {
      console.log(`  tracks: ${newTracks?.substring(0, 80)}`)
    }

    if (!DRY_RUN) {
      // Upsert composers into people + game_people
      entry.composers.forEach((c, i) => {
        if (c.name === 'Various Artists') return // skip generic
        const pid = personId(c.name)
        upsertPerson.run(pid, c.name, slugify(c.name))
        upsertGamePeople.run(entry.gameId, pid, i + 1)
      })

      // Update games table
      updateOst.run(newComposers, newTracks, newTracks, entry.gameId)
    }
  }
})

runBatch()

console.log(`\n─────────────────────────────────────────────`)
console.log(`Games corrected : ${totalGames}`)
console.log(`Skipped         : ${skipped}`)
if (DRY_RUN) {
  console.log('\n[DRY RUN] No changes written. Re-run with --apply.')
} else {
  console.log('\n✓ OST composer / track corrections written.')
}

db.close()
