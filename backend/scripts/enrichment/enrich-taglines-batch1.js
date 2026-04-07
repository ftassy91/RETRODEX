#!/usr/bin/env node
'use strict'

const path = require('path')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.resolve(__dirname, '../../storage/retrodex.sqlite')

// Generic tagline fragments — overwrite these even if a tagline is already set
const GENERIC_FRAGMENTS = [
  'recherche',
  'collectionneurs',
  'titre culte recherche',
  'titre rare',
]

const TAGLINES = {
  // Nintendo / EAD
  'the-legend-of-zelda-ocarina-of-time-nintendo-64': 'The most epic adventure ever told in three dimensions.',
  'super-mario-64-nintendo-64': 'The third dimension changed everything.',
  'super-mario-bros-nintendo-entertainment-system': 'Save the princess. Rule the kingdom.',
  'super-mario-bros-3-nintendo-entertainment-system': "Bigger worlds. More suits. Mario's finest hour.",
  'super-mario-world-super-nintendo': 'A whole new world, a whole new Yoshi.',
  'super-mario-kart-super-nintendo': 'Eight racers. One finish line. Infinite grudges.',
  'super-mario-rpg-super-nintendo': 'An unlikely alliance to save the Star Road.',
  'yoshi-island-super-nintendo': 'The Yoshis carry a legend on their backs.',
  'the-legend-of-zelda-nintendo-entertainment-system': 'The kingdom is silent. A hero must rise.',
  'the-legend-of-zelda-a-link-to-the-past-super-nintendo': "Between light and shadow, Hyrule's fate hangs by a blade.",
  'the-legend-of-zelda-a-link-to-the-past-game-boy-advance': 'The definitive Zelda adventure, now in your hands.',
  'majoras-mask-nintendo-64': 'Three days. One mask. No escape.',
  'the-legend-of-zelda-majoras-mask-nintendo-64': 'Three days. One mask. No escape.',
  'super-metroid-super-nintendo': 'The last Metroid is in captivity. The galaxy is at peace.',
  'metroid-zero-mission-game-boy-advance': "Samus's first mission, reborn and expanded.",
  'donkey-kong-country-super-nintendo': 'The Kongs are back. And they brought friends.',
  'donkey-kong-country-2-super-nintendo': 'Deep in Crocodile Isle, a king waits to be rescued.',
  'kirby-adventure-nintendo-entertainment-system': 'The pink puffball that changed everything.',
  'banjo-kazooie-nintendo-64': 'Bear and bird. Together against a world full of jigsaws.',
  'banjo-tooie-nintendo-64': 'The bear and bird are back. Grunty never had a chance.',
  'goldeneye-007-nintendo-64': 'One shot. One mission. One legend.',
  'perfect-dark-nintendo-64': 'The future of espionage starts here.',
  // Square / SquareSoft
  'final-fantasy-vi-super-nintendo': 'The empire will fall. But at what cost?',
  'final-fantasy-vi-advance-game-boy-advance': 'Opera, espers, and the end of the world — in your pocket.',
  'final-fantasy-vii-playstation': 'The planet is dying. Only Cloud can save it.',
  'final-fantasy-viii-playstation': 'Time compresses. Memory fades. Love endures.',
  'final-fantasy-ix-playstation': 'A return to the roots of fantasy, and a meditation on life.',
  'final-fantasy-v-super-nintendo': 'Four crystals. Five jobs. Infinite possibilities.',
  'final-fantasy-tactics-playstation': 'Behind every war hides a darker conspiracy.',
  'final-fantasy-tactics-advance-game-boy-advance': 'A magical world where the rules are set in stone — unless you break them.',
  'chrono-trigger-super-nintendo': 'History is a story. Now is your chance to rewrite it.',
  'chrono-cross-playstation': 'Two worlds separated by fate. One hero standing between them.',
  'secret-of-mana-super-nintendo': 'A legendary sword. A world to save. Adventure is everywhere.',
  'final-fantasy-xii-revenant-wings-nintendo-ds': 'Sky pirates, floating islands, and the legend of Ivalice continues.',
  // Sega
  'sonic-the-hedgehog-sega-genesis': 'Speed is everything. Robotnik is nothing.',
  'sonic-the-hedgehog-2-sega-genesis': "Sonic's got a sidekick. Robotnik's got a Death Egg.",
  'sonic-the-hedgehog-3-sega-genesis': 'The fastest hero alive just got a whole new island to save.',
  'panzer-dragoon-saga-sega-saturn': 'A world of ruins, a dragon, and a search for the truth.',
  'skies-of-arcadia-dreamcast': 'Pirates of the sky. Legends of the clouds.',
  'shenmue-dreamcast': "The search for one man's killer begins in the streets of Yokosuka.",
  'jet-set-radio-dreamcast': 'Graffiti. Skates. Revolution.',
  'sonic-adventure-dreamcast': 'The fastest hedgehog takes on a whole new dimension.',
  'radiant-silvergun-sega-saturn': 'The most intense shooter ever built, finally within reach.',
  'guardian-heroes-sega-saturn': 'A skeletal knight. A magic sword. A war no one saw coming.',
  // Capcom
  'mega-man-nintendo-entertainment-system': 'One robot. Eight enemies. A world to protect.',
  'mega-man-2-nintendo-entertainment-system': "Dr. Wily's back. So is the best Mega Man game ever made.",
  'mega-man-x-super-nintendo': 'A new generation of Mega Man. A new kind of war.',
  'megaman-zero-game-boy-advance': 'Zero awakens. The resistance fights on.',
  'megaman-zero-2-game-boy-advance': 'Harder. Faster. Zero has nothing left to prove.',
  'mega-man-zero-3-game-boy-advance': 'The war reaches its darkest chapter.',
  'street-fighter-ii-turbo-super-nintendo': "The world's greatest fighters. Only one can be champion.",
  'castlevania-nintendo-entertainment-system': 'Simon Belmont enters the castle. Only one of them leaves.',
  'castlevania-iii-draculas-curse-nintendo-entertainment-system': 'Before the legend, there was the curse.',
  'super-castlevania-iv-super-nintendo': 'The definitive Castlevania, reimagined in 16 bits.',
  'castlevania-bloodlines-sega-genesis': "Dracula's war reaches the whole of Europe.",
  'castlevania-chronicles-playstation': 'The uncompromising original, finally given its due.',
  'castlevania-circle-of-the-moon-game-boy-advance': 'Nathan Graves enters the labyrinth. Discovery is his weapon.',
  'castlevania-harmony-of-dissonance-game-boy-advance': 'A faster, more unstable castle awaits.',
  'castlevania-aria-of-sorrow-game-boy-advance': "Soma Cruz carries Dracula's destiny without knowing it.",
  'castlevania-dawn-of-sorrow-nintendo-ds': 'The dark power returns. So does the man who refuses it.',
  'castlevania-order-of-ecclesia-nintendo-ds': 'Shanoa carries the seal. The price is her memory.',
  'castlevania-symphony-of-the-night-playstation': 'What is a man? A miserable little pile of secrets.',
  // Konami
  'metal-gear-solid-playstation': 'Tactical espionage action at its peak.',
  'contra-nintendo-entertainment-system': 'One man. Two guns. An alien army between them.',
  'contra-iii-alien-wars-super-nintendo': 'The alien war comes to Earth. Bill Rizer comes to end it.',
  'contra-hard-corps-sega-genesis': 'Four soldiers. Multiple endings. Maximum destruction.',
  'suikoden-ii-playstation': 'One hundred and eight stars of destiny. One unforgettable war.',
  // Namco / Bandai
  'tekken-3-playstation': 'The iron fist tournament meets its greatest generation.',
  'soul-calibur-dreamcast': 'Legends clash. Souls burn.',
  // Square misc
  'parasite-eve-playstation': 'A molecular horror story set in the heart of Manhattan.',
  // Sony / PS
  'gran-turismo-playstation': 'The real driving simulator.',
  'crash-team-racing-playstation': "Bandicoot behind the wheel. Someone's getting hurt.",
  'spyro-the-dragon-playstation': 'One small dragon. A hundred worlds to explore.',
  'spyro-2-riptos-rage-playstation': 'Ripto brought war. Spyro brought fire.',
  'spyro-year-of-the-dragon-playstation': 'Dragon eggs, new realms, and one furious egg thief.',
  'resident-evil-3-nemesis-playstation': "Raccoon City is falling. Nemesis won't let you leave.",
  'silent-hill-playstation': 'The town that lives inside your worst nightmares.',
  // Nintendo DS / GBA
  'new-super-mario-bros-nintendo-ds': '2D Mario reinvented for the dual-screen era.',
  'fire-emblem-game-boy-advance': 'Strategy, sacrifice, and the bonds that make warriors.',
  'golden-sun-game-boy-advance': 'Alchemy is forbidden. Four teenagers will change everything.',
  'golden-sun-the-lost-age-game-boy-advance': 'The quest continues across continents and oceans.',
  'mother-3-game-boy-advance': 'A family torn apart. A world on the edge of ruin.',
  'the-world-ends-with-you-nintendo-ds': "Play or be erased. The Reaper's Game has begun.",
  'mario-and-luigi-bowsers-inside-story-nintendo-ds': 'Bowser swallowed the wrong plumbers.',
  'professor-layton-and-the-curious-village-nintendo-ds': 'Every puzzle has an answer. Every village has a secret.',
  'metroid-prime-hunters-nintendo-ds': "Samus isn't the only bounty hunter after the Alimbic relic.",
  // Misc
  'earthbound-super-nintendo': 'A boy, a baseball bat, and the fate of the universe.',
  'final-fantasy-iii-nintendo-entertainment-system': 'Four chosen by the crystals. A world on the edge of darkness.',
  'final-fantasy-ii-nintendo-entertainment-system': 'The empire burns. The rebellion rises.',
  'final-fantasy-nintendo-entertainment-system': 'Four warriors of light. One world to save.',
  'tetris-game-boy': 'The perfect puzzle has no ending.',
  'tony-hawks-pro-skater-2-playstation': 'Two minutes. Every trick you know. Make them count.',
  'tony-hawks-pro-skater-2-dreamcast': 'Two minutes. Every trick you know. Make them count.',
  'super-mario-all-stars-super-nintendo': 'Four legends. One cartridge. Timeless.',
  'super-mario-advance-game-boy-advance': 'The dream world adventure, back in your hands.',
  'mega-man-7-super-nintendo': "Dr. Wily never rests. Neither does Mega Man.",
  'mega-man-x4-playstation': 'X fights for justice. Zero fights for something else entirely.',
  'bahamut-lagoon-super-nintendo': 'Dragons wage war. Only love can end it.',
}

function nowIso() {
  return new Date().toISOString()
}

function isGeneric(tagline) {
  if (!tagline) return false
  const lower = tagline.toLowerCase()
  return GENERIC_FRAGMENTS.some((frag) => lower.includes(frag))
}

function buildDryRunPlan(db) {
  const gameIds = Object.keys(TAGLINES)
  const placeholders = gameIds.map(() => '?').join(', ')
  const rows = db.prepare(
    `SELECT id, tagline FROM games WHERE id IN (${placeholders})`
  ).all(...gameIds)

  const found = new Set(rows.map((r) => r.id))
  const plan = {
    totalInMap: gameIds.length,
    notFound: [],
    willSkip: [],
    willWrite: [],
  }

  for (const gameId of gameIds) {
    if (!found.has(gameId)) {
      plan.notFound.push(gameId)
    }
  }

  for (const row of rows) {
    const newTagline = TAGLINES[row.id]
    const existing = row.tagline || null
    if (existing && !isGeneric(existing)) {
      plan.willSkip.push({ gameId: row.id, reason: 'already has good tagline', existing })
    } else {
      plan.willWrite.push({
        gameId: row.id,
        from: existing || null,
        to: newTagline,
        reason: existing ? 'generic tagline replaced' : 'was empty',
      })
    }
  }

  return plan
}

function applyTaglines(db) {
  const timestamp = nowIso()
  const runKey = `enrich-taglines-batch1-${timestamp}`

  const runId = Number(db.prepare(`
    INSERT INTO enrichment_runs (
      run_key, pipeline_name, mode, source_name, status, dry_run,
      started_at, items_seen, items_created, items_updated, items_skipped, items_flagged, error_count, notes
    ) VALUES (?, 'enrich_taglines_batch1', 'apply', 'internal_curated', 'running', 0,
      ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, timestamp, 'Batch 1 curated taglines — 100+ games').lastInsertRowid)

  const metrics = {
    itemsSeen: 0,
    itemsCreated: 0,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
  }

  const lines = []

  const transaction = db.transaction(() => {
    for (const [gameId, newTagline] of Object.entries(TAGLINES)) {
      metrics.itemsSeen += 1

      const row = db.prepare('SELECT id, tagline FROM games WHERE id = ?').get(gameId)

      if (!row) {
        console.log(`  ✗ [NOT FOUND]  ${gameId}`)
        lines.push(`NOT_FOUND: ${gameId}`)
        metrics.itemsFlagged += 1
        continue
      }

      const existing = row.tagline || null

      if (existing && !isGeneric(existing)) {
        console.log(`  - [SKIP]       ${gameId}  (already has: "${existing.slice(0, 60)}")`)
        metrics.itemsSkipped += 1
        continue
      }

      db.prepare('UPDATE games SET tagline = ? WHERE id = ?').run(newTagline, gameId)

      const action = existing ? 'REPLACED' : 'ADDED'
      console.log(`  ✓ [${action.padEnd(8)}] ${gameId}`)
      lines.push(`${action}: ${gameId}`)
      metrics.itemsUpdated += 1
    }
  })

  transaction()

  db.prepare(`
    UPDATE enrichment_runs
    SET status = 'completed',
        finished_at = ?,
        items_seen = ?,
        items_created = ?,
        items_updated = ?,
        items_skipped = ?,
        items_flagged = ?,
        error_count = 0,
        notes = ?
    WHERE id = ?
  `).run(
    nowIso(),
    metrics.itemsSeen,
    metrics.itemsCreated,
    metrics.itemsUpdated,
    metrics.itemsSkipped,
    metrics.itemsFlagged,
    `taglines-batch1 applied: ${metrics.itemsUpdated} written, ${metrics.itemsSkipped} skipped, ${metrics.itemsFlagged} missing`,
    runId
  )

  return { runId, runKey, metrics }
}

function main() {
  const db = new Database(SQLITE_PATH)
  try {
    if (!APPLY) {
      console.log('[DRY-RUN] enrich-taglines-batch1 — pass --apply to write\n')
      const plan = buildDryRunPlan(db)

      if (plan.notFound.length) {
        console.log(`Not found in DB (${plan.notFound.length}):`)
        for (const id of plan.notFound) console.log(`  ✗ ${id}`)
        console.log()
      }

      console.log(`Would write (${plan.willWrite.length}):`)
      for (const entry of plan.willWrite) {
        const tag = entry.reason === 'generic tagline replaced'
          ? `[REPLACE generic] ${entry.gameId}`
          : `[ADD empty]      ${entry.gameId}`
        console.log(`  ✓ ${tag}`)
        console.log(`    → "${entry.to}"`)
      }

      if (plan.willSkip.length) {
        console.log(`\nWould skip (${plan.willSkip.length}) — already have good taglines:`)
        for (const entry of plan.willSkip) {
          console.log(`  - ${entry.gameId}`)
        }
      }

      console.log(`\nSummary: ${plan.willWrite.length} writes, ${plan.willSkip.length} skips, ${plan.notFound.length} not found (of ${plan.totalInMap} in map)`)
      return
    }

    console.log('[APPLY] enrich-taglines-batch1\n')
    const result = applyTaglines(db)
    const m = result.metrics
    console.log(`\nDone — run #${result.runId} (${result.runKey})`)
    console.log(`  Written : ${m.itemsUpdated}`)
    console.log(`  Skipped : ${m.itemsSkipped}`)
    console.log(`  Missing : ${m.itemsFlagged}`)
    console.log(`  Total   : ${m.itemsSeen}`)
  } finally {
    db.close()
  }
}

main()
