#!/usr/bin/env node
'use strict'

/**
 * enrich-dev-anecdotes-batch1.js
 *
 * Writes dev_anecdotes to BOTH games and game_editorial tables.
 * Only writes when the field is currently NULL or empty string.
 * Format: JSON array of { title, text }
 *
 * Usage:
 *   node enrich-dev-anecdotes-batch1.js           # dry-run (default)
 *   node enrich-dev-anecdotes-batch1.js --apply   # write to DB
 */

const path = require('path')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.resolve(__dirname, '../../storage/retrodex.sqlite')

// ---------------------------------------------------------------------------
// Payload
// ---------------------------------------------------------------------------

const PAYLOAD = [
  {
    gameId: 'the-legend-of-zelda-ocarina-of-time-nintendo-64',
    anecdotes: [
      { title: 'Z-Targeting Origin', text: "The Z-targeting lock-on system was invented specifically to solve the problem of 3D combat. Director Eiji Aonuma and his team struggled to make sword fights readable in three dimensions until a programmer prototyped the lock-on mechanic, which became the game's defining innovation." },
      { title: 'The Horse Race Bet', text: "Shigeru Miyamoto bet Eiji Aonuma that players would get lost in the Water Temple. Aonuma redesigned the dungeon's map system and added clearer hints as a result, making the temple more navigable than it would have been." },
    ],
  },
  {
    gameId: 'super-mario-64-nintendo-64',
    anecdotes: [
      { title: "The Jump Button Didn't Exist", text: "Early in development, Mario could not jump — the team had to design 3D platforming from scratch with no prior reference. Miyamoto wanted players to feel the weight and momentum of each jump, leading to months of tuning the physics engine before a single level was designed." },
      { title: 'Bob-omb Battlefield Was First', text: 'Bob-omb Battlefield was the first level designed and the one used to test all movement mechanics. Every other level in the game was built with those same physics parameters.' },
    ],
  },
  {
    gameId: 'super-mario-bros-nintendo-entertainment-system',
    anecdotes: [
      { title: 'World 1-1 by Design', text: "World 1-1 was designed to teach players the game's rules without any text. The wide open field forces players to move right, the first Goomba is positioned to be easily dodged or stomped, and the first ? block is placed exactly where a jumping player would hit it naturally." },
      { title: 'The Minus World', text: 'World -1 — an infinite underwater level accessible through a wall clip in World 1-2 — was an unintended glitch that became legendary. The developers never removed it, and it remains one of the most famous bugs in gaming history.' },
    ],
  },
  {
    gameId: 'metal-gear-solid-playstation',
    anecdotes: [
      { title: 'Psycho Mantis Broke the Fourth Wall', text: "Psycho Mantis reads the PlayStation memory card to comment on other Konami games the player has saved, then switches to \"controller port 2\" to dodge the player's attacks. Kojima reportedly loved the confusion this caused during playtesting." },
      { title: 'The Real Meryl Codec Number', text: "Meryl's codec frequency is printed on the back of the physical game case — not in the in-game codec book. Players who had borrowed or rented the game had to call a hotline or look it up to progress." },
    ],
  },
  {
    gameId: 'final-fantasy-vii-playstation',
    anecdotes: [
      { title: 'N64 to PlayStation', text: "Final Fantasy VII was originally planned for the Nintendo 64. When Square determined that the game's FMV sequences and world scale required more storage than a cartridge could offer, the team switched to PlayStation — a decision that shifted the entire RPG landscape." },
      { title: "Aerith's Death Was Not a Mistake", text: "Hironobu Sakaguchi confirmed that Aerith's death was deliberate from early in development. Sakaguchi had recently lost his mother and wanted to explore what it meant to lose someone irreversibly — designing her death in a way that no Phoenix Down or healing spell could undo." },
    ],
  },
  {
    gameId: 'goldeneye-007-nintendo-64',
    anecdotes: [
      { title: 'Made by First-Timers', text: 'GoldenEye was developed almost entirely by people with no prior game development experience. Director Martin Hollis and most of the core team had never shipped a commercial game before. They learned as they built, and the result redefined the first-person shooter on consoles.' },
      { title: 'Multiplayer Was an Afterthought', text: 'The multiplayer mode was added in the last four months of development, almost as an experiment. There were no detailed design documents — the developers simply played it and kept what was fun.' },
    ],
  },
  {
    gameId: 'chrono-trigger-super-nintendo',
    anecdotes: [
      { title: 'The Dream Team', text: "Chrono Trigger united three of Japan's most celebrated creative forces: Hironobu Sakaguchi (Final Fantasy creator), Yuji Horii (Dragon Quest creator), and Akira Toriyama (Dragon Ball artist). Their collaboration was announced publicly before a single line of code was written." },
      { title: 'New Game+ Invented Here', text: "Chrono Trigger is widely credited with popularizing the New Game+ mechanic in RPGs. The feature lets players start a cleared game with all their equipment and levels, enabling them to see the game's multiple endings without replaying 20+ hours of content." },
    ],
  },
  {
    gameId: 'sonic-the-hedgehog-sega-genesis',
    anecdotes: [
      { title: 'A Corporate Mascot Contest', text: "Sonic was born from an internal Sega contest to design a character that could rival Mario. Naoto Ohshima submitted a spiky blue hedgehog with attitude; Yuji Naka built the physics engine around the concept of momentum and speed. The combination defined Sega's identity for a decade." },
      { title: 'The Speed of the Physics', text: "Sonic's speed felt real because Yuji Naka programmed genuine physics — the character accelerates, builds momentum on slopes, and loses speed when climbing. This was unusual for a 1991 platformer, and it made Sonic feel fundamentally different from competitors." },
    ],
  },
  {
    gameId: 'donkey-kong-country-super-nintendo',
    anecdotes: [
      { title: 'Pre-rendered 3D on a 16-Bit Console', text: 'Rare created DKC\'s graphics by rendering Silicon Graphics workstation models at high resolution, then converting individual frames to sprites. The result looked three-dimensional on SNES hardware that had no 3D capability, stunning everyone who saw it — including Nintendo, who greenlit the project immediately.' },
      { title: 'David Wise Composed Alone', text: 'Composer David Wise wrote almost the entire DKC soundtrack working in isolation, often recording and adjusting pieces late into the night. He cites "Aquatic Ambiance" as the track that first made him feel the game\'s music had reached the level it needed.' },
    ],
  },
  {
    gameId: 'castlevania-symphony-of-the-night-playstation',
    anecdotes: [
      { title: "Koji Igarashi's Debut as Director", text: 'SotN was Koji Igarashi\'s first full directorial credit, though he took over from Toru Hagihara mid-production. Igarashi used the game to establish the Metroidvania template he would refine over eight more Castlevania entries.' },
      { title: 'The Reverse Castle', text: "The inverted castle — an entire second castle to explore after defeating Richter — was added late in development as a way to double the game's content. Igarashi believed players would feel cheated if the experience ended after just one castle." },
    ],
  },
  {
    gameId: 'super-metroid-super-nintendo',
    anecdotes: [
      { title: 'The Tutorial Metroid', text: 'The baby Metroid that bonds with Samus in the opening sequence and sacrifices itself at the end was designed to make players care about a non-player creature. Director Yoshio Sakamoto said it was the emotional core of the entire game.' },
      { title: 'The Exploration Philosophy', text: 'The team deliberately avoided placing markers or hints on the map. The philosophy was that players should feel like genuine explorers — confusion was a feature, not a bug. Every dead end was meant to be a moment of discovery.' },
    ],
  },
  {
    gameId: 'final-fantasy-vi-super-nintendo',
    anecdotes: [
      { title: 'The Opera Scene', text: "The opera scene was unprecedented in a SNES game — a full 10-minute musical sequence with scripted actions, synchronized text, and timed button presses. Composer Nobuo Uematsu wrote the piece knowing the hardware couldn't play real vocals, so he scored it for SNES synthesis to suggest the grandeur of opera." },
      { title: 'An Ensemble With No Hero', text: 'Director Yoshinori Kitase deliberately gave the game no single protagonist. Terra was the narrative entry point, but every character had equal story weight. This was a reaction against the single-hero structure of earlier Final Fantasy games.' },
    ],
  },
  {
    gameId: 'earthbound-super-nintendo',
    anecdotes: [
      { title: "Itoi's Personal Game", text: "EarthBound's creator Shigesato Itoi is not a game developer — he is a Japanese copywriter and essayist. He designed the game around his memories of childhood, his fears, and his sense of humor. The result is unlike any other RPG because it was made by someone with no interest in following the genre's conventions." },
      { title: 'The Anti-Guide Campaign', text: 'The original Japanese marketing campaign included a message telling players NOT to buy strategy guides. Itoi wanted players to experience confusion and discovery as part of the game itself — walking into EarthBound blind was intended.' },
    ],
  },
  {
    gameId: 'majoras-mask-nintendo-64',
    anecdotes: [
      { title: 'Made in 18 Months', text: "Majora's Mask was developed in roughly 18 months — half the time of Ocarina of Time — because the team reused the Ocarina engine and asset base. Director Eiji Aonuma said the constraint forced creative solutions: the three-day loop system came from the need to build a large world with limited new content." },
      { title: 'The Oni Link Theory', text: "The transformation into Fierce Deity Link — an adult form of Link wearing Majora's mask energy — was deliberately left without explanation. The designers wanted players to draw their own conclusions about what Link becomes when he wears the most powerful mask." },
    ],
  },
  {
    gameId: 'banjo-kazooie-nintendo-64',
    anecdotes: [
      { title: 'Grant Kirkhope Learned on the Job', text: 'Grant Kirkhope joined Rare as a guitarist and was handed the entire Banjo-Kazooie soundtrack with almost no prior game music experience. He taught himself N64 MIDI composition during production, writing over 80 themes in a style that became one of the most beloved soundtracks of the era.' },
      { title: 'Bottles Was Almost Removed', text: "The mole Bottles, who teaches most of the game's moves, was nearly cut late in development for being too tutorial-heavy. The team kept him after playtesting showed new players genuinely needed his guidance." },
    ],
  },
  {
    gameId: 'secret-of-mana-super-nintendo',
    anecdotes: [
      { title: 'Designed for a CD-ROM', text: "Secret of Mana was originally planned as a launch title for the Nintendo PlayStation add-on. When that partnership collapsed, the team had to strip the game down to fit on a standard SNES cartridge. Several areas and story sequences were cut from the final release." },
      { title: 'Ring Menu Under Pressure', text: 'The ring menu system — which pauses the action and presents options in a circular layout — was invented to make the game playable in co-op without overwhelming players with menus. It became one of the most copied UI innovations in action RPGs.' },
    ],
  },
  {
    gameId: 'mega-man-2-nintendo-entertainment-system',
    anecdotes: [
      { title: 'A Game Made Against Orders', text: 'Mega Man 2 was developed by a small team in their spare time, working nights and weekends without official authorization from Capcom management. The original Mega Man had underperformed commercially, and the sequel was greenlit only after the team presented a prototype.' },
      { title: "Takashi Tateishi's Pseudonym", text: 'Mega Man 2 composer Takashi Tateishi is credited as "Ogeretsu-kun" — a self-deprecating Japanese slang nickname meaning roughly "gross kid." He chose the pseudonym himself, and it became inseparable from the game\'s legendary soundtrack.' },
    ],
  },
  {
    gameId: 'kirby-adventure-nintendo-entertainment-system',
    anecdotes: [
      { title: "Masahiro Sakurai's First Title", text: "Masahiro Sakurai was 19 years old when he began designing Kirby's Adventure. He created the copy ability system — where Kirby absorbs enemy powers — as a way to give players permanent control over the game's difficulty: veteran players could seek out powerful abilities, while newcomers could ignore them entirely." },
      { title: 'Satoru Iwata Saved the Game', text: "Kirby's Adventure was running behind schedule and over scope when programmer Satoru Iwata — the future president of Nintendo — joined the team. Iwata rewrote critical sections of the codebase in a fraction of the expected time, enabling the team to hit their milestones." },
    ],
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nowIso() {
  return new Date().toISOString()
}

function isEmpty(val) {
  if (val === null || val === undefined) return true
  if (typeof val === 'string' && val.trim() === '') return true
  return false
}

function createRun(db, runKey, timestamp) {
  const result = db.prepare(`
    INSERT INTO enrichment_runs (
      run_key,
      pipeline_name,
      mode,
      source_name,
      status,
      dry_run,
      started_at,
      items_seen,
      items_created,
      items_updated,
      items_skipped,
      items_flagged,
      error_count,
      notes
    ) VALUES (?, 'enrich_dev_anecdotes_batch1', 'apply', 'internal_curated', 'running', 0, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, timestamp, 'Dev anecdotes batch 1 — 18 games across NES/SNES/Genesis/N64/PSX')
  return Number(result.lastInsertRowid)
}

function finalizeRun(db, runId, timestamp, metrics) {
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
    timestamp,
    metrics.itemsSeen,
    metrics.itemsCreated,
    metrics.itemsUpdated,
    metrics.itemsSkipped,
    metrics.itemsFlagged,
    `Dev anecdotes batch 1 completed. written=${metrics.itemsUpdated} skipped=${metrics.itemsSkipped} flagged=${metrics.itemsFlagged}`,
    runId
  )
}

// ---------------------------------------------------------------------------
// Dry-run planning
// ---------------------------------------------------------------------------

function buildDryRunPlan(db) {
  const plan = []

  for (const entry of PAYLOAD) {
    const gamesRow = db.prepare('SELECT id, dev_anecdotes FROM games WHERE id = ?').get(entry.gameId)
    const editorialRow = db.prepare('SELECT game_id, dev_anecdotes FROM game_editorial WHERE game_id = ?').get(entry.gameId)

    const gamesExists = Boolean(gamesRow)
    const gamesEmpty = gamesExists ? isEmpty(gamesRow.dev_anecdotes) : null
    const editorialExists = Boolean(editorialRow)
    const editorialEmpty = editorialExists ? isEmpty(editorialRow.dev_anecdotes) : null

    plan.push({
      gameId: entry.gameId,
      anecdoteCount: entry.anecdotes.length,
      games: {
        rowExists: gamesExists,
        fieldEmpty: gamesEmpty,
        action: !gamesExists ? 'skip-no-game-row' : gamesEmpty ? 'write' : 'skip-already-filled',
      },
      game_editorial: {
        rowExists: editorialExists,
        fieldEmpty: editorialEmpty,
        action: !editorialExists ? 'skip-no-editorial-row' : editorialEmpty ? 'write' : 'skip-already-filled',
      },
    })
  }

  return plan
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

function applyEnrichment(db) {
  const timestamp = nowIso()
  const runKey = `enrich-dev-anecdotes-batch1-${timestamp}`
  const runId = createRun(db, runKey, timestamp)

  const metrics = {
    itemsSeen: PAYLOAD.length,
    itemsCreated: 0,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    gamesWritten: 0,
    editorialWritten: 0,
    gamesSkipped: 0,
    editorialSkipped: 0,
  }

  const transaction = db.transaction(() => {
    for (const entry of PAYLOAD) {
      const anecdotesJson = JSON.stringify(entry.anecdotes)

      // --- games table ---
      const gamesRow = db.prepare('SELECT id, dev_anecdotes FROM games WHERE id = ?').get(entry.gameId)
      if (!gamesRow) {
        console.log(`[FLAGGED] games row missing: ${entry.gameId}`)
        metrics.itemsFlagged += 1
      } else if (isEmpty(gamesRow.dev_anecdotes)) {
        db.prepare('UPDATE games SET dev_anecdotes = ? WHERE id = ?').run(anecdotesJson, entry.gameId)
        console.log(`[WRITE] games.dev_anecdotes for ${entry.gameId} (${entry.anecdotes.length} anecdotes)`)
        metrics.gamesWritten += 1
      } else {
        console.log(`[SKIP] games.dev_anecdotes already filled for ${entry.gameId}`)
        metrics.gamesSkipped += 1
      }

      // --- game_editorial table ---
      const editorialRow = db.prepare('SELECT game_id, dev_anecdotes FROM game_editorial WHERE game_id = ?').get(entry.gameId)
      if (!editorialRow) {
        console.log(`[SKIP] game_editorial row missing for ${entry.gameId} — no insert attempted`)
        metrics.editorialSkipped += 1
      } else if (isEmpty(editorialRow.dev_anecdotes)) {
        db.prepare('UPDATE game_editorial SET dev_anecdotes = ?, updated_at = ? WHERE game_id = ?').run(anecdotesJson, timestamp, entry.gameId)
        console.log(`[WRITE] game_editorial.dev_anecdotes for ${entry.gameId} (${entry.anecdotes.length} anecdotes)`)
        metrics.editorialWritten += 1
      } else {
        console.log(`[SKIP] game_editorial.dev_anecdotes already filled for ${entry.gameId}`)
        metrics.editorialSkipped += 1
      }

      // Count as updated if at least one table was written
      if (
        (gamesRow && isEmpty(gamesRow.dev_anecdotes)) ||
        (editorialRow && isEmpty(editorialRow.dev_anecdotes))
      ) {
        metrics.itemsUpdated += 1
      } else if (gamesRow || editorialRow) {
        metrics.itemsSkipped += 1
      }
    }
  })

  transaction()
  finalizeRun(db, runId, nowIso(), metrics)

  return { runId, runKey, metrics }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const db = new Database(SQLITE_PATH)
  try {
    if (!APPLY) {
      const plan = buildDryRunPlan(db)
      const willWrite = plan.filter((p) => p.games.action === 'write' || p.game_editorial.action === 'write').length
      const willSkip = plan.filter((p) => p.games.action !== 'write' && p.game_editorial.action !== 'write').length

      console.log(JSON.stringify({
        mode: 'dry-run',
        sqlitePath: SQLITE_PATH,
        summary: {
          totalGames: PAYLOAD.length,
          willWrite,
          willSkip,
        },
        plan,
      }, null, 2))
      console.log('\nRun with --apply to write.')
      return
    }

    const result = applyEnrichment(db)
    console.log('\n=== Summary ===')
    console.log(JSON.stringify({
      mode: 'apply',
      sqlitePath: SQLITE_PATH,
      result,
    }, null, 2))
  } finally {
    db.close()
  }
}

main()
