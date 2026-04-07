#!/usr/bin/env node
'use strict'

/**
 * enrich-dev-team-individuals.js
 *
 * Adds named individual credits (directors, designers, programmers)
 * to the `people` + `game_people` tables for key games.
 * Also updates games.dev_team JSON to include those individuals.
 *
 * Usage:
 *   node scripts/enrichment/enrich-dev-team-individuals.js           # dry-run
 *   node scripts/enrichment/enrich-dev-team-individuals.js --apply   # write
 */

const Database = require('better-sqlite3')
const path = require('path')

const DRY_RUN = !process.argv.includes('--apply')

// ---------------------------------------------------------------------------
// Enrichment payload
// Each entry: gameId + array of { name, role, billingOrder }
// ---------------------------------------------------------------------------
const CREDITS = [
  // ── Nintendo / EAD ────────────────────────────────────────────────────────

  {
    gameId: 'the-legend-of-zelda-ocarina-of-time-nintendo-64',
    people: [
      { name: 'Shigeru Miyamoto', role: 'Producer', billingOrder: 1 },
      { name: 'Katsuya Eguchi',   role: 'Director', billingOrder: 2 },
      { name: 'Yoichi Yamada',    role: 'Director', billingOrder: 3 },
      { name: 'Eiji Aonuma',      role: 'Director', billingOrder: 4 },
      { name: 'Toru Osawa',       role: 'Scenario', billingOrder: 5 },
      { name: 'Koji Kondo',       role: 'Composer', billingOrder: 6 },
    ],
  },
  {
    gameId: 'super-mario-64-nintendo-64',
    people: [
      { name: 'Shigeru Miyamoto', role: 'Director / Producer', billingOrder: 1 },
      { name: 'Takashi Tezuka',   role: 'Assistant Director',  billingOrder: 2 },
      { name: 'Koji Kondo',       role: 'Composer',            billingOrder: 3 },
    ],
  },
  {
    gameId: 'super-mario-bros-nintendo-entertainment-system',
    people: [
      { name: 'Shigeru Miyamoto', role: 'Director / Designer', billingOrder: 1 },
      { name: 'Takashi Tezuka',   role: 'Designer',            billingOrder: 2 },
      { name: 'Koji Kondo',       role: 'Composer',            billingOrder: 3 },
    ],
  },
  {
    gameId: 'super-mario-bros-3-nintendo-entertainment-system',
    people: [
      { name: 'Shigeru Miyamoto', role: 'Director / Producer', billingOrder: 1 },
      { name: 'Takashi Tezuka',   role: 'Director',            billingOrder: 2 },
      { name: 'Koji Kondo',       role: 'Composer',            billingOrder: 3 },
    ],
  },
  {
    gameId: 'super-mario-world-super-nintendo',
    people: [
      { name: 'Shigeru Miyamoto', role: 'Producer',  billingOrder: 1 },
      { name: 'Takashi Tezuka',   role: 'Director',  billingOrder: 2 },
      { name: 'Koji Kondo',       role: 'Composer',  billingOrder: 3 },
    ],
  },
  {
    gameId: 'yoshi-island-super-nintendo',
    people: [
      { name: 'Shigeru Miyamoto', role: 'Producer',  billingOrder: 1 },
      { name: 'Takashi Tezuka',   role: 'Director',  billingOrder: 2 },
      { name: 'Koji Kondo',       role: 'Composer',  billingOrder: 3 },
    ],
  },
  {
    gameId: 'the-legend-of-zelda-nintendo-entertainment-system',
    people: [
      { name: 'Shigeru Miyamoto', role: 'Director / Designer', billingOrder: 1 },
      { name: 'Takashi Tezuka',   role: 'Designer',            billingOrder: 2 },
      { name: 'Koji Kondo',       role: 'Composer',            billingOrder: 3 },
    ],
  },
  {
    gameId: 'the-legend-of-zelda-a-link-to-the-past-super-nintendo',
    people: [
      { name: 'Shigeru Miyamoto', role: 'Producer',  billingOrder: 1 },
      { name: 'Katsuya Eguchi',   role: 'Director',  billingOrder: 2 },
      { name: 'Takashi Tezuka',   role: 'Director',  billingOrder: 3 },
      { name: 'Koji Kondo',       role: 'Composer',  billingOrder: 4 },
    ],
  },
  {
    gameId: 'the-legend-of-zelda-a-link-to-the-past-game-boy-advance',
    people: [
      { name: 'Shigeru Miyamoto', role: 'Producer', billingOrder: 1 },
      { name: 'Katsuya Eguchi',   role: 'Director', billingOrder: 2 },
      { name: 'Takashi Tezuka',   role: 'Director', billingOrder: 3 },
      { name: 'Koji Kondo',       role: 'Composer', billingOrder: 4 },
    ],
  },
  {
    gameId: 'majoras-mask-nintendo-64',
    people: [
      { name: 'Eiji Aonuma',      role: 'Director',  billingOrder: 1 },
      { name: 'Shigeru Miyamoto', role: 'Producer',  billingOrder: 2 },
      { name: 'Koji Kondo',       role: 'Composer',  billingOrder: 3 },
      { name: 'Toru Minegishi',   role: 'Composer',  billingOrder: 4 },
    ],
  },
  {
    gameId: 'the-legend-of-zelda-majoras-mask-nintendo-64',
    people: [
      { name: 'Eiji Aonuma',      role: 'Director',  billingOrder: 1 },
      { name: 'Shigeru Miyamoto', role: 'Producer',  billingOrder: 2 },
      { name: 'Koji Kondo',       role: 'Composer',  billingOrder: 3 },
      { name: 'Toru Minegishi',   role: 'Composer',  billingOrder: 4 },
    ],
  },
  {
    gameId: 'super-metroid-super-nintendo',
    people: [
      { name: 'Yoshio Sakamoto',  role: 'Director',  billingOrder: 1 },
      { name: 'Gunpei Yokoi',     role: 'Producer',  billingOrder: 2 },
      { name: 'Kenji Yamamoto',   role: 'Composer',  billingOrder: 3 },
      { name: 'Minako Hamano',    role: 'Composer',  billingOrder: 4 },
    ],
  },
  {
    gameId: 'super-mario-kart-super-nintendo',
    people: [
      { name: 'Shigeru Miyamoto', role: 'Producer',  billingOrder: 1 },
      { name: 'Hideki Konno',     role: 'Director',  billingOrder: 2 },
      { name: 'Koji Kondo',       role: 'Composer',  billingOrder: 3 },
    ],
  },
  {
    gameId: 'super-mario-rpg-super-nintendo',
    people: [
      { name: 'Shigeru Miyamoto', role: 'Producer',        billingOrder: 1 },
      { name: 'Chihiro Fujioka',  role: 'Director',        billingOrder: 2 },
      { name: 'Yoko Shimomura',   role: 'Composer',        billingOrder: 3 },
    ],
  },
  {
    gameId: 'donkey-kong-country-super-nintendo',
    people: [
      { name: 'Tim Stamper',      role: 'Director',  billingOrder: 1 },
      { name: 'David Wise',       role: 'Composer',  billingOrder: 2 },
      { name: 'Eveline Fischer',  role: 'Composer',  billingOrder: 3 },
    ],
  },
  {
    gameId: 'banjo-kazooie-nintendo-64',
    people: [
      { name: 'Gregg Mayles',    role: 'Creative Director', billingOrder: 1 },
      { name: 'Grant Kirkhope', role: 'Composer',           billingOrder: 2 },
    ],
  },
  {
    gameId: 'goldeneye-007-nintendo-64',
    people: [
      { name: 'Martin Hollis',   role: 'Director',  billingOrder: 1 },
      { name: 'Grant Kirkhope', role: 'Composer',   billingOrder: 2 },
      { name: 'Graeme Norgate', role: 'Composer',   billingOrder: 3 },
      { name: 'Robin Beanland',  role: 'Composer',  billingOrder: 4 },
    ],
  },
  {
    gameId: 'perfect-dark-nintendo-64',
    people: [
      { name: 'Martin Hollis',   role: 'Designer',  billingOrder: 1 },
      { name: 'Grant Kirkhope', role: 'Composer',   billingOrder: 2 },
      { name: 'Eveline Fischer', role: 'Composer',  billingOrder: 3 },
      { name: 'Steve Burke',     role: 'Composer',  billingOrder: 4 },
    ],
  },
  {
    gameId: 'kirby-adventure-nintendo-entertainment-system',
    people: [
      { name: 'Masahiro Sakurai', role: 'Director / Designer', billingOrder: 1 },
      { name: 'Satoru Iwata',     role: 'Programmer',          billingOrder: 2 },
      { name: 'Jun Ishikawa',     role: 'Composer',            billingOrder: 3 },
    ],
  },

  // ── Square / SquareSoft ───────────────────────────────────────────────────

  {
    gameId: 'final-fantasy-vi-super-nintendo',
    people: [
      { name: 'Hironobu Sakaguchi', role: 'Executive Producer', billingOrder: 1 },
      { name: 'Yoshinori Kitase',   role: 'Director',           billingOrder: 2 },
      { name: 'Hiroyuki Ito',       role: 'Director',           billingOrder: 3 },
      { name: 'Nobuo Uematsu',      role: 'Composer',           billingOrder: 4 },
      { name: 'Yoshitaka Amano',    role: 'Art Director',       billingOrder: 5 },
    ],
  },
  {
    gameId: 'final-fantasy-vi-advance-game-boy-advance',
    people: [
      { name: 'Hironobu Sakaguchi', role: 'Executive Producer', billingOrder: 1 },
      { name: 'Yoshinori Kitase',   role: 'Director',           billingOrder: 2 },
      { name: 'Hiroyuki Ito',       role: 'Director',           billingOrder: 3 },
      { name: 'Nobuo Uematsu',      role: 'Composer',           billingOrder: 4 },
    ],
  },
  {
    gameId: 'final-fantasy-vii-playstation',
    people: [
      { name: 'Hironobu Sakaguchi', role: 'Executive Producer', billingOrder: 1 },
      { name: 'Yoshinori Kitase',   role: 'Director',           billingOrder: 2 },
      { name: 'Tetsuya Nomura',     role: 'Character Designer', billingOrder: 3 },
      { name: 'Nobuo Uematsu',      role: 'Composer',           billingOrder: 4 },
    ],
  },
  {
    gameId: 'final-fantasy-viii-playstation',
    people: [
      { name: 'Hironobu Sakaguchi', role: 'Executive Producer', billingOrder: 1 },
      { name: 'Yoshinori Kitase',   role: 'Director',           billingOrder: 2 },
      { name: 'Tetsuya Nomura',     role: 'Character Designer', billingOrder: 3 },
      { name: 'Nobuo Uematsu',      role: 'Composer',           billingOrder: 4 },
    ],
  },
  {
    gameId: 'final-fantasy-ix-playstation',
    people: [
      { name: 'Hironobu Sakaguchi', role: 'Executive Producer', billingOrder: 1 },
      { name: 'Hiroyuki Ito',       role: 'Director',           billingOrder: 2 },
      { name: 'Nobuo Uematsu',      role: 'Composer',           billingOrder: 3 },
      { name: 'Yoshitaka Amano',    role: 'Art Director',       billingOrder: 4 },
    ],
  },
  {
    gameId: 'final-fantasy-v-super-nintendo',
    people: [
      { name: 'Hironobu Sakaguchi', role: 'Executive Producer', billingOrder: 1 },
      { name: 'Hiroyuki Ito',       role: 'Director',           billingOrder: 2 },
      { name: 'Nobuo Uematsu',      role: 'Composer',           billingOrder: 3 },
      { name: 'Yoshitaka Amano',    role: 'Art Director',       billingOrder: 4 },
    ],
  },
  {
    gameId: 'final-fantasy-tactics-playstation',
    people: [
      { name: 'Yasumi Matsuno',   role: 'Director / Designer', billingOrder: 1 },
      { name: 'Hiroshi Minagawa', role: 'Art Director',        billingOrder: 2 },
      { name: 'Hitoshi Sakimoto', role: 'Composer',            billingOrder: 3 },
      { name: 'Masaharu Iwata',   role: 'Composer',            billingOrder: 4 },
    ],
  },
  {
    gameId: 'chrono-trigger-super-nintendo',
    people: [
      { name: 'Hironobu Sakaguchi', role: 'Executive Producer', billingOrder: 1 },
      { name: 'Takashi Tokita',     role: 'Director',           billingOrder: 2 },
      { name: 'Yuji Horii',         role: 'Director',           billingOrder: 3 },
      { name: 'Akira Toriyama',     role: 'Character Designer', billingOrder: 4 },
      { name: 'Yasunori Mitsuda',   role: 'Composer',           billingOrder: 5 },
      { name: 'Nobuo Uematsu',      role: 'Composer',           billingOrder: 6 },
    ],
  },
  {
    gameId: 'chrono-cross-playstation',
    people: [
      { name: 'Masato Kato',      role: 'Director / Scenario', billingOrder: 1 },
      { name: 'Yasunori Mitsuda', role: 'Composer',            billingOrder: 2 },
    ],
  },

  // ── Sega ─────────────────────────────────────────────────────────────────

  {
    gameId: 'sonic-the-hedgehog-sega-genesis',
    people: [
      { name: 'Yuji Naka',        role: 'Lead Programmer',    billingOrder: 1 },
      { name: 'Naoto Ohshima',    role: 'Character Designer', billingOrder: 2 },
      { name: 'Hirokazu Yasuhara',role: 'Game Designer',      billingOrder: 3 },
      { name: 'Masato Nakamura',  role: 'Composer',           billingOrder: 4 },
    ],
  },
  {
    gameId: 'sonic-the-hedgehog-2-sega-genesis',
    people: [
      { name: 'Yuji Naka',        role: 'Lead Programmer',    billingOrder: 1 },
      { name: 'Naoto Ohshima',    role: 'Character Designer', billingOrder: 2 },
      { name: 'Masato Nakamura',  role: 'Composer',           billingOrder: 3 },
    ],
  },

  // ── Capcom ───────────────────────────────────────────────────────────────

  {
    gameId: 'mega-man-nintendo-entertainment-system',
    people: [
      { name: 'Akira "A.K" Kitamura', role: 'Director / Designer', billingOrder: 1 },
      { name: 'Keiji Inafune',         role: 'Character Designer',  billingOrder: 2 },
      { name: 'Manami Matsumae',       role: 'Composer',             billingOrder: 3 },
    ],
  },
  {
    gameId: 'mega-man-2-nintendo-entertainment-system',
    people: [
      { name: 'Keiji Inafune',   role: 'Character Designer', billingOrder: 1 },
      { name: 'Takashi Tateishi',role: 'Composer',            billingOrder: 2 },
      { name: 'Yoshihiro Sakaguchi', role: 'Composer',        billingOrder: 3 },
    ],
  },
  {
    gameId: 'mega-man-x-super-nintendo',
    people: [
      { name: 'Keiji Inafune',    role: 'Producer / Character Designer', billingOrder: 1 },
      { name: 'Sho Tsuge',        role: 'Director',                      billingOrder: 2 },
      { name: 'Makoto Tomozawa', role: 'Composer',                       billingOrder: 3 },
      { name: 'Yuki Iwai',        role: 'Composer',                       billingOrder: 4 },
      { name: 'Yuko Takehara',    role: 'Composer',                       billingOrder: 5 },
    ],
  },
  {
    gameId: 'mega-man-7-super-nintendo',
    people: [
      { name: 'Keiji Inafune',    role: 'Producer',  billingOrder: 1 },
      { name: 'Shigehiro Kawakami', role: 'Director', billingOrder: 2 },
    ],
  },
  {
    gameId: 'mega-man-x4-playstation',
    people: [
      { name: 'Keiji Inafune',    role: 'Producer',  billingOrder: 1 },
    ],
  },
  {
    gameId: 'street-fighter-ii-turbo-super-nintendo',
    people: [
      { name: 'Yoshiki Okamoto',  role: 'Producer',  billingOrder: 1 },
      { name: 'Akira Nishitani',  role: 'Director',  billingOrder: 2 },
      { name: 'Akiman',           role: 'Character Designer', billingOrder: 3 },
    ],
  },

  // ── Konami ───────────────────────────────────────────────────────────────

  {
    gameId: 'castlevania-nintendo-entertainment-system',
    people: [
      { name: 'Hitoshi Akamatsu',  role: 'Director',  billingOrder: 1 },
      { name: 'Kinuyo Yamashita',  role: 'Composer',  billingOrder: 2 },
      { name: 'Satoe Terashima',   role: 'Composer',  billingOrder: 3 },
    ],
  },
  {
    gameId: 'castlevania-iii-draculas-curse-nintendo-entertainment-system',
    people: [
      { name: 'Masahiro Ueno',    role: 'Director',  billingOrder: 1 },
      { name: 'Hidenori Maezawa', role: 'Composer',  billingOrder: 2 },
      { name: 'Yukie Morimoto',   role: 'Composer',  billingOrder: 3 },
      { name: 'Tomoko Sato',      role: 'Composer',  billingOrder: 4 },
    ],
  },
  {
    gameId: 'metal-gear-solid-playstation',
    people: [
      { name: 'Hideo Kojima',      role: 'Director / Writer', billingOrder: 1 },
      { name: 'Kazuki Muraoka',    role: 'Composer',          billingOrder: 2 },
      { name: 'Hiroyuki Togo',     role: 'Composer',          billingOrder: 3 },
    ],
  },
  {
    gameId: 'contra-nintendo-entertainment-system',
    people: [
      { name: 'Koji Hiroshita',   role: 'Director / Designer', billingOrder: 1 },
      { name: 'Hidenori Maezawa', role: 'Composer',             billingOrder: 2 },
      { name: 'Kyouhei Sada',     role: 'Composer',             billingOrder: 3 },
    ],
  },

  // ── Namco ─────────────────────────────────────────────────────────────────

  {
    gameId: 'tekken-3-playstation',
    people: [
      { name: 'Katsuhiro Harada', role: 'Producer / Director', billingOrder: 1 },
      { name: 'Yoshie Arakawa',   role: 'Composer',             billingOrder: 2 },
    ],
  },

  // ── SNK ──────────────────────────────────────────────────────────────────

  {
    gameId: 'metal-slug-3-neo-geo',
    people: [
      { name: 'Toshikazu Tanaka', role: 'Lead Composer', billingOrder: 1 },
    ],
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

function buildDevTeamJson(people) {
  return JSON.stringify(
    people.map((p) => ({ role: p.role, name: p.name }))
  )
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const DB_PATH = path.resolve(__dirname, '../../storage/retrodex.sqlite')
const db = new Database(DB_PATH)

const upsertPerson = db.prepare(`
  INSERT INTO people (id, name, normalized_name, primary_role, created_at, updated_at)
  VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
  ON CONFLICT(id) DO UPDATE SET
    updated_at = datetime('now')
`)

const upsertGamePeople = db.prepare(`
  INSERT INTO game_people (game_id, person_id, role, billing_order, confidence, is_inferred)
  VALUES (?, ?, ?, ?, 0.92, 0)
  ON CONFLICT(game_id, person_id, role) DO UPDATE SET
    billing_order = excluded.billing_order,
    confidence = excluded.confidence
`)

const getGame = db.prepare('SELECT id, dev_team FROM games WHERE id = ?')
const updateDevTeam = db.prepare('UPDATE games SET dev_team = ? WHERE id = ?')

let totalGames = 0
let totalPeople = 0
let skipped = 0

if (DRY_RUN) {
  console.log('[DRY RUN] Pass --apply to write changes\n')
}

const runBatch = db.transaction(() => {
  for (const entry of CREDITS) {
    const game = getGame.get(entry.gameId)
    if (!game) {
      console.warn(`  SKIP  ${entry.gameId} — game not found`)
      skipped++
      continue
    }

    totalGames++
    console.log(`\n▶ ${entry.gameId}`)

    for (const person of entry.people) {
      const pid = personId(person.name)
      const normName = slugify(person.name)
      const primaryRole = person.role.toLowerCase().includes('composer')
        ? 'composer'
        : person.role.toLowerCase().includes('director')
        ? 'director'
        : person.role.toLowerCase().includes('producer')
        ? 'producer'
        : 'developer'

      console.log(`  + ${person.name} (${person.role}) → ${pid}`)

      if (!DRY_RUN) {
        upsertPerson.run(pid, person.name, normName, primaryRole)
        upsertGamePeople.run(entry.gameId, pid, person.role, person.billingOrder)
      }
      totalPeople++
    }

    // Update dev_team JSON with named individuals (replace or extend)
    if (!DRY_RUN) {
      const devTeamJson = buildDevTeamJson(entry.people)
      updateDevTeam.run(devTeamJson, entry.gameId)
    }
  }
})

runBatch()

console.log(`\n─────────────────────────────────────────────`)
console.log(`Games enriched : ${totalGames}`)
console.log(`People added  : ${totalPeople}`)
console.log(`Skipped       : ${skipped}`)
if (DRY_RUN) {
  console.log('\n[DRY RUN] No changes written. Re-run with --apply.')
} else {
  console.log('\n✓ Dev team individual credits written.')
}

db.close()
