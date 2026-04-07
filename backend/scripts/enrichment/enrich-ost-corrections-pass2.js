#!/usr/bin/env node
'use strict'

/**
 * enrich-ost-corrections-pass2.js
 *
 * Second pass of OST composer fixes — covers high-scored games still
 * showing publisher/company names instead of individual composers.
 *
 * Usage:
 *   node scripts/enrichment/enrich-ost-corrections-pass2.js           # dry-run
 *   node scripts/enrichment/enrich-ost-corrections-pass2.js --apply   # write
 */

const Database = require('better-sqlite3')
const path = require('path')

const DRY_RUN = !process.argv.includes('--apply')

const OST_CORRECTIONS = [
  // ── Nintendo N64 ──────────────────────────────────────────────────────────

  {
    gameId: 'paper-mario-nintendo-64',
    composers: [{ name: 'Koji Kondo', role: 'Composer' }],
    tracks: ['Toad Town', 'Pleasant Path', 'Goomba Village', 'Bowser\'s Castle', 'Star Road'],
  },
  {
    gameId: 'banjo-tooie-nintendo-64',
    composers: [{ name: 'Grant Kirkhope', role: 'Composer' }],
    tracks: ['Jinjo Village', 'Mayahem Temple', 'Glitter Gulch Mine', 'Hailfire Peaks', 'Cloud Cuckooland'],
  },
  {
    gameId: 'blast-corps-nintendo-64',
    composers: [{ name: 'Graeme Norgate', role: 'Composer' }],
    tracks: null,
  },

  // ── SNES ─────────────────────────────────────────────────────────────────

  {
    gameId: 'final-fantasy-vi-super-nintendo',
    composers: [{ name: 'Nobuo Uematsu', role: 'Composer' }],
    tracks: ['Terra\'s Theme', 'Aria di Mezzo Carattere', 'Dancing Mad', 'Kefka\'s Theme', 'Searching for Friends'],
  },
  {
    gameId: 'final-fantasy-iv-super-nintendo',
    composers: [{ name: 'Nobuo Uematsu', role: 'Composer' }],
    tracks: ['Main Theme of Final Fantasy IV', 'Theme of Love', 'Battle with the Four Fiends', 'The Final Battle'],
  },
  {
    gameId: 'final-fantasy-v-super-nintendo',
    composers: [{ name: 'Nobuo Uematsu', role: 'Composer' }],
    tracks: ['Main Theme of Final Fantasy V', 'Battle on the Big Bridge', 'Clash on the Big Bridge', 'The Final Battle'],
  },
  {
    gameId: 'secret-of-mana-super-nintendo',
    composers: [{ name: 'Hiroki Kikuta', role: 'Composer' }],
    tracks: ['Fear of the Heavens', 'Into the Thick of It', 'Meridian Dance', 'A Curious Tale', 'The Oracle'],
  },
  {
    gameId: 'starfox-super-nintendo',
    composers: [{ name: 'Hajime Hirasawa', role: 'Composer' }],
    tracks: ['Main Theme', 'Corneria', 'Sector Y', 'Fortuna', 'Venom'],
  },
  {
    gameId: 'donkey-kong-country-2-super-nintendo',
    composers: [{ name: 'David Wise', role: 'Composer' }],
    tracks: ['Stickerbrush Symphony', 'Krook\'s March', 'Disco Train', 'Flight of the Zinger', 'Haunted Chase'],
  },
  {
    gameId: 'donkey-kong-country-3-super-nintendo',
    composers: [{ name: 'Eveline Fischer', role: 'Composer' }],
    tracks: ['Water World', 'Rockface Rumble', 'Nuts and Bolts', 'Frostbite Follies'],
  },
  {
    gameId: 'super-punch-out-super-nintendo',
    composers: [
      { name: 'Taro Bando', role: 'Composer' },
      { name: 'Soyo Oka', role: 'Composer' },
    ],
    tracks: null,
  },
  {
    gameId: 'zombies-ate-my-neighbors-super-nintendo',
    composers: [{ name: 'Joe McDermott', role: 'Composer' }],
    tracks: null,
  },

  // ── NES ──────────────────────────────────────────────────────────────────

  {
    gameId: 'final-fantasy-iii-nintendo-entertainment-system',
    composers: [{ name: 'Nobuo Uematsu', role: 'Composer' }],
    tracks: ['Elia, the Maiden of Water', 'Eternal Wind', 'The Boundless Ocean', 'Last Battle'],
  },
  {
    gameId: 'final-fantasy-ii-nintendo-entertainment-system',
    composers: [{ name: 'Nobuo Uematsu', role: 'Composer' }],
    tracks: ['Main Theme II', 'Battle Theme II', 'Revive'],
  },
  {
    gameId: 'mike-tysons-punch-out-nintendo-entertainment-system',
    composers: [
      { name: 'Koji Kondo', role: 'Composer' },
      { name: 'Yukio Kaneoka', role: 'Composer' },
    ],
    tracks: ['Title Theme', 'Fight Theme', 'Training Theme'],
  },
  {
    gameId: 'bionic-commando-nintendo-entertainment-system',
    composers: [{ name: 'Takashi Tateishi', role: 'Composer' }],
    tracks: ['Area 1', 'Area 6', 'Title'],
  },
  {
    gameId: 'contra-nintendo-entertainment-system',
    composers: [
      { name: 'Hidenori Maezawa', role: 'Composer' },
      { name: 'Kyouhei Sada', role: 'Composer' },
    ],
    tracks: ['Jungle', 'Base', 'Snowfield', 'Energy Zone'],
  },
  {
    gameId: 'adventures-of-lolo-nintendo-entertainment-system',
    composers: [{ name: 'Hirokazu Tanaka', role: 'Composer' }],
    tracks: null,
  },

  // ── GBA ──────────────────────────────────────────────────────────────────

  {
    gameId: 'golden-sun-game-boy-advance',
    composers: [{ name: 'Motoi Sakuraba', role: 'Composer' }],
    tracks: ['Venus Lighthouse', 'Battle Scene', 'Isaac\'s Theme', 'Kolima Village', 'Vale'],
  },
  {
    gameId: 'golden-sun-the-lost-age-game-boy-advance',
    composers: [{ name: 'Motoi Sakuraba', role: 'Composer' }],
    tracks: ['Star Magician', 'Agatio and Karst', 'Shaman Village', 'The Elemental Stars'],
  },
  {
    gameId: 'castlevania-aria-of-sorrow-game-boy-advance',
    composers: [{ name: 'Michiru Yamane', role: 'Composer' }],
    tracks: ['Castle Corridor', 'Prologue', 'Clock Tower', 'Demon Castle', 'Into the Dark Night'],
  },
  {
    gameId: 'castlevania-harmony-of-dissonance-game-boy-advance',
    composers: [
      { name: 'Soshiro Hokkai', role: 'Composer' },
      { name: 'Takashi Yoshida', role: 'Composer' },
    ],
    tracks: ['Successor of Fate', 'Chapel of Dissonance', 'Offense and Defense'],
  },
  {
    gameId: 'megaman-zero-game-boy-advance',
    composers: [
      { name: 'Ippo Yamada', role: 'Composer' },
      { name: 'Masaki Suzuki', role: 'Composer' },
      { name: 'Luna Umegaki', role: 'Composer' },
      { name: 'Toshihiko Horiyama', role: 'Composer' },
    ],
    tracks: ['Title Demo', 'Infiltration', 'X vs. Zero', 'Departure'],
  },
  {
    gameId: 'mega-man-zero-3-game-boy-advance',
    composers: [
      { name: 'Ippo Yamada', role: 'Composer' },
      { name: 'Masaki Suzuki', role: 'Composer' },
      { name: 'Toshihiko Horiyama', role: 'Composer' },
    ],
    tracks: ['Cannonball', 'Cannon Ball', 'Ice Brain', 'Departure'],
  },
  {
    gameId: 'fire-emblem-game-boy-advance',
    composers: [{ name: 'Yuka Tsujiyoko', role: 'Composer' }],
    tracks: ['Attack', 'For Victory', 'Lyn\'s Theme', 'Brother, Fight For Me'],
  },
  {
    gameId: 'mother-3-game-boy-advance',
    composers: [{ name: 'Shogo Sakai', role: 'Composer' }],
    tracks: ['Hard Rain', 'Natural Killer Cyborg', 'Unfounded Revenge', 'You Were There'],
  },

  // ── DS ───────────────────────────────────────────────────────────────────

  {
    gameId: 'the-world-ends-with-you-nintendo-ds',
    composers: [{ name: 'Takeharu Ishimoto', role: 'Composer' }],
    tracks: ['Twister', 'Calling', 'Someday', 'Give Me All Your Love', 'Déjà vu'],
  },
  {
    gameId: 'mario-kart-ds-nintendo-ds',
    composers: [
      { name: 'Shinobu Tanaka', role: 'Composer' },
      { name: 'Kenta Nagata', role: 'Composer' },
    ],
    tracks: ['Figure-8 Circuit', 'Waluigi Pinball', 'Airship Fortress', 'Rainbow Road', 'GBA Bowser Castle 2'],
  },
  {
    gameId: 'the-legend-of-zelda-phantom-hourglass-nintendo-ds',
    composers: [
      { name: 'Toru Minegishi', role: 'Composer' },
      { name: 'Koji Kondo', role: 'Composer' },
    ],
    tracks: ['Main Theme', 'Linebeck\'s Theme', 'Temple of the Ocean King', 'Ciela'],
  },
  {
    gameId: 'mario-and-luigi-bowsers-inside-story-nintendo-ds',
    composers: [{ name: 'Yoko Shimomura', role: 'Composer' }],
    tracks: ['Grasslands', 'Jump on Bowser', 'Bowser\'s Inside Story', 'Dimble Wood'],
  },
  {
    gameId: 'dragon-quest-ix-nintendo-ds',
    composers: [{ name: 'Koichi Sugiyama', role: 'Composer' }],
    tracks: ['Overture March IX', 'Battle for Glory', 'A Hero\'s Departure', 'Guardian of the Stars'],
  },
  {
    gameId: 'professor-layton-and-the-curious-village-nintendo-ds',
    composers: [{ name: 'Tomohito Nishiura', role: 'Composer' }],
    tracks: ['Professor Layton\'s Theme', 'St. Mystere', 'A Puzzle is Presented'],
  },
  {
    gameId: 'final-fantasy-xii-revenant-wings-nintendo-ds',
    composers: [
      { name: 'Hitoshi Sakimoto', role: 'Composer' },
      { name: 'Masaharu Iwata', role: 'Composer' },
    ],
    tracks: null,
  },

  // ── PlayStation ───────────────────────────────────────────────────────────

  {
    gameId: 'crash-team-racing-playstation',
    composers: [{ name: 'Josh Mancell', role: 'Composer' }],
    tracks: ['Slide Coliseum', 'Blizzard Bluff', 'Cortex Castle', 'Main Theme'],
  },
  {
    gameId: 'spyro-the-dragon-playstation',
    composers: [{ name: 'Stewart Copeland', role: 'Composer' }],
    tracks: ['Artisans', 'Magic Crafters', 'Gnasty\'s World', 'Gnorc Cove'],
  },
  {
    gameId: 'spyro-2-riptos-rage-playstation',
    composers: [{ name: 'Stewart Copeland', role: 'Composer' }],
    tracks: ['Home World', 'Glimmer', 'Idol Springs', 'Aquaria Towers'],
  },
  {
    gameId: 'spyro-year-of-the-dragon-playstation',
    composers: [{ name: 'Stewart Copeland', role: 'Composer' }],
    tracks: ['Sunrise Spring', 'Midday Gardens', 'Evening Lake', 'Midnight Mountain'],
  },
  {
    gameId: 'silent-hill-playstation',
    composers: [{ name: 'Akira Yamaoka', role: 'Composer' }],
    tracks: ['Theme of Laura', 'Not Tomorrow', 'Tears of...', 'Expect to be Treated'],
  },
  {
    gameId: 'parasite-eve-playstation',
    composers: [{ name: 'Yoko Shimomura', role: 'Composer' }],
    tracks: ['Primal Eyes', 'Arise Within You', 'Influence of Deep', 'Unstable Mind'],
  },
  {
    gameId: 'suikoden-playstation',
    composers: [{ name: 'Miki Higashino', role: 'Composer' }],
    tracks: ['Opening Theme', 'Theme of a Moonlit Night', 'Tir\'s Theme', 'Gothic Neclord'],
  },
  {
    gameId: 'um-jammer-lammy-playstation',
    composers: [{ name: 'Masaya Matsuura', role: 'Composer' }],
    tracks: ['Make It Sweet!', 'Power Instinct', 'Taste the Bass'],
  },
  {
    gameId: 'castlevania-chronicles-playstation',
    composers: [
      { name: 'Kinuyo Yamashita', role: 'Composer' },
      { name: 'Satoe Terashima', role: 'Composer' },
    ],
    tracks: null,
  },

  // ── Sega Genesis ─────────────────────────────────────────────────────────

  {
    gameId: 'shining-force-sega-genesis',
    composers: [{ name: 'Motoaki Takenouchi', role: 'Composer' }],
    tracks: ['Battle 1', 'Headquarters', 'Overworld', 'Last Battle'],
  },
  {
    gameId: 'castle-of-illusion-sega-genesis',
    composers: [{ name: 'Shigenori Kamiya', role: 'Composer' }],
    tracks: ['Magic Forest', 'Toyland', 'Storm', 'The Castle'],
  },
  {
    gameId: 'sonic-the-hedgehog-3-sega-genesis',
    composers: [
      { name: 'Jun Senoue', role: 'Composer' },
      { name: 'Brad Buxer', role: 'Composer' },
      { name: 'Cirocco Jones', role: 'Composer' },
    ],
    tracks: ['Angel Island Zone', 'Hydrocity Zone', 'Marble Garden Zone', 'Carnival Night Zone', 'Launch Base Zone'],
  },

  // ── Sega Saturn / Dreamcast ───────────────────────────────────────────────

  {
    gameId: 'skies-of-arcadia-dreamcast',
    composers: [
      { name: 'Yutaka Minobe', role: 'Composer' },
      { name: 'Takayuki Maeda', role: 'Composer' },
    ],
    tracks: ['Flight', 'Little Jack', 'Welcome!', 'The Black Pirates'],
  },
  {
    gameId: 'jet-set-radio-dreamcast',
    composers: [{ name: 'Hideki Naganuma', role: 'Composer' }],
    tracks: ['Humming the Bassline', 'Super Brothers', 'That\'s Enough', 'Birthday Cake'],
  },
  {
    gameId: 'sonic-adventure-dreamcast',
    composers: [
      { name: 'Jun Senoue', role: 'Composer' },
      { name: 'Kenichi Tokoi', role: 'Composer' },
      { name: 'Fumie Kumatani', role: 'Composer' },
    ],
    tracks: ['Open Your Heart', 'Unknown from M.E.', 'It Doesn\'t Matter', 'E.G.G.M.A.N.', 'My Sweet Passion'],
  },
  {
    gameId: 'shenmue-dreamcast',
    composers: [
      { name: 'Yuzo Koshiro', role: 'Composer' },
      { name: 'Ryuji Iuchi', role: 'Composer' },
      { name: 'Takayuki Nakamura', role: 'Composer' },
    ],
    tracks: ['Shenmue Theme', 'Dobuita Street', 'Snowfall', 'Harbor Lights'],
  },
  {
    gameId: 'castlevania-symphony-of-the-night-sega-saturn',
    composers: [{ name: 'Michiru Yamane', role: 'Composer' }],
    tracks: ['Dracula\'s Castle', 'Marble Gallery', 'Lost Painting', 'Wood Carving Partita'],
  },
  {
    gameId: 'panzer-dragoon-ii-zwei-sega-saturn',
    composers: [{ name: 'Yoshitaka Azuma', role: 'Composer' }],
    tracks: ['Lagi', 'Flight', 'The Dragon'],
  },
  {
    gameId: 'shining-the-holy-ark-sega-saturn',
    composers: [{ name: 'Motoi Sakuraba', role: 'Composer' }],
    tracks: null,
  },
  {
    gameId: 'burning-rangers-sega-saturn',
    composers: [{ name: 'Fumie Kumatani', role: 'Composer' }],
    tracks: ['Burning Hearts', 'The Man Who Saves Dream'],
  },

  // ── SNES / Square misc ────────────────────────────────────────────────────

  {
    gameId: 'shadowrun-super-nintendo',
    composers: [{ name: 'Marshall Parker', role: 'Composer' }],
    tracks: null,
  },
  {
    gameId: 'killer-instinct-super-nintendo',
    composers: [
      { name: 'Robin Beanland', role: 'Composer' },
      { name: 'Graeme Norgate', role: 'Composer' },
    ],
    tracks: ['The Instinct', 'Controlling Transmission', 'Bridge to Recovery'],
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
    const newComposers = JSON.stringify(entry.composers)
    const newTracks = entry.tracks ? JSON.stringify(entry.tracks) : null

    console.log(`\n▶ ${entry.gameId}`)
    console.log(`  ${game.ost_composers?.substring(0, 50)} → ${newComposers.substring(0, 60)}`)
    if (entry.tracks) {
      console.log(`  tracks: ${newTracks?.substring(0, 80)}`)
    }

    if (!DRY_RUN) {
      entry.composers.forEach((c, i) => {
        if (c.name === 'Various Artists') return
        const pid = personId(c.name)
        upsertPerson.run(pid, c.name, slugify(c.name))
        upsertGamePeople.run(entry.gameId, pid, i + 1)
      })
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
  console.log('\n✓ OST pass 2 corrections written.')
}

db.close()
