#!/usr/bin/env node
'use strict'

const path = require('path')
const Database = require('better-sqlite3')
const DB_PATH = path.resolve(__dirname, '../../storage/retrodex.sqlite')

const data = [
  { id: 'terranigma-super-nintendo',
    credits: [
      { name: 'Tomoyoshi Miyazaki', role: 'Director', billing: 1 },
      { name: 'Masaya Hashimoto', role: 'Producer', billing: 2 },
      { name: 'Shinji Futami', role: 'Producer', billing: 3 },
      { name: 'Tomoyoshi Miyazaki', role: 'Game Designer', billing: 4 },
    ],
    map: 'https://www.vgmaps.com/Atlas/SuperNES/Terranigma-Overworld.png',
    ending: 'https://www.vgmuseum.com/end/snes/c/terra.htm' },

  { id: 'suikoden-playstation',
    credits: [
      { name: 'Yoshitaka Murayama', role: 'Director', billing: 1 },
      { name: 'Kazumi Kitaue', role: 'Producer', billing: 2 },
      { name: 'Junko Kawano', role: 'Game Designer', billing: 3 },
    ],
    map: 'https://strategywiki.org/wiki/Suikoden',
    ending: 'https://www.vgmuseum.com/end/psx/b/suikoden.htm' },

  { id: 'radiant-silvergun-sega-saturn',
    credits: [
      { name: 'Hiroshi Iuchi', role: 'Director', billing: 1 },
      { name: 'Hiroshi Iuchi', role: 'Producer', billing: 2 },
    ],
    map: null,
    ending: 'https://www.vgmuseum.com/end/saturn/a/radiant.htm' },

  { id: 'final-fantasy-iii-nintendo-entertainment-system',
    credits: [
      { name: 'Hironobu Sakaguchi', role: 'Director', billing: 1 },
      { name: 'Masafumi Miyamoto', role: 'Producer', billing: 2 },
      { name: 'Hiromichi Tanaka', role: 'Game Designer', billing: 3 },
      { name: 'Nasir Gebelli', role: 'Lead Programmer', billing: 4 },
    ],
    map: 'https://www.vgmaps.com/Atlas/NES/FinalFantasyIII(J)-WorldMap.png',
    ending: 'https://www.vgmuseum.com/end/nes/a/ff3nes.htm' },

  { id: 'panzer-dragoon-ii-zwei-sega-saturn',
    credits: [
      { name: 'Tomohiro Kondo', role: 'Director', billing: 1 },
      { name: 'Tomohiro Kondo', role: 'Producer', billing: 2 },
      { name: 'Kentaro Yoshida', role: 'Game Designer', billing: 3 },
    ],
    map: null,
    ending: 'https://www.vgmuseum.com/end/saturn/a/pd2.htm' },

  { id: 'castlevania-circle-of-the-moon-game-boy-advance',
    credits: [
      { name: 'Koji Horie', role: 'Director', billing: 1 },
      { name: 'Koji Horie', role: 'Producer', billing: 2 },
      { name: 'Koji Horie', role: 'Game Designer', billing: 3 },
    ],
    map: 'https://strategywiki.org/wiki/Castlevania:_Circle_of_the_Moon',
    ending: 'https://www.vgmuseum.com/end/gba/a/cotm.htm' },

  { id: 'final-fantasy-nintendo-entertainment-system',
    credits: [
      { name: 'Hironobu Sakaguchi', role: 'Director', billing: 1 },
      { name: 'Masafumi Miyamoto', role: 'Producer', billing: 2 },
      { name: 'Hiromichi Tanaka', role: 'Game Designer', billing: 3 },
      { name: 'Nasir Gebelli', role: 'Lead Programmer', billing: 4 },
    ],
    map: 'https://www.vgmaps.com/Atlas/NES/FinalFantasy-WorldMap.png',
    ending: 'https://www.vgmuseum.com/end/nes/a/ff.htm' },

  { id: 'mortal-kombat-ii-sega-genesis',
    credits: [
      { name: 'Ed Boon', role: 'Game Designer', billing: 1 },
      { name: 'John Tobias', role: 'Game Designer', billing: 2 },
    ],
    map: null,
    ending: 'https://www.vgmuseum.com/end/genesis/b/mk2rep.htm' },

  { id: 'final-fantasy-tactics-advance-game-boy-advance',
    credits: [
      { name: 'Yuichi Murasawa', role: 'Director', billing: 1 },
      { name: 'Yasumi Matsuno', role: 'Producer', billing: 2 },
      { name: 'Satomi Hongo', role: 'Game Designer', billing: 3 },
    ],
    map: 'https://strategywiki.org/wiki/Final_Fantasy_Tactics_Advance',
    ending: 'https://www.vgmuseum.com/end/gba/c/fft.htm' },

  { id: 'silent-hill-playstation',
    credits: [
      { name: 'Keiichiro Toyama', role: 'Director', billing: 1 },
      { name: 'Gozo Kitao', role: 'Producer', billing: 2 },
    ],
    map: 'https://strategywiki.org/wiki/Silent_Hill',
    ending: 'https://www.vgmuseum.com/end/psx/b/shill.htm' },

  { id: 'banjo-tooie-nintendo-64',
    credits: [
      { name: 'Gregg Mayles', role: 'Game Designer', billing: 1 },
    ],
    map: null,
    ending: 'https://www.vgmuseum.com/end/n64/a/btooie.htm' },

  { id: 'blast-corps-nintendo-64',
    credits: [
      { name: 'Paul Mountain', role: 'Director', billing: 1 },
      { name: 'George Andreas', role: 'Director', billing: 2 },
      { name: 'Chris Stamper', role: 'Producer', billing: 3 },
      { name: 'Tim Stamper', role: 'Producer', billing: 4 },
      { name: 'Martin Wakeley', role: 'Game Designer', billing: 5 },
    ],
    map: 'https://strategywiki.org/wiki/Blast_Corps',
    ending: 'https://www.vgmuseum.com/end/n64/a/bcorps.htm' },

  { id: 'final-fantasy-ii-nintendo-entertainment-system',
    credits: [
      { name: 'Hironobu Sakaguchi', role: 'Director', billing: 1 },
      { name: 'Masafumi Miyamoto', role: 'Producer', billing: 2 },
      { name: 'Akitoshi Kawazu', role: 'Game Designer', billing: 3 },
      { name: 'Nasir Gebelli', role: 'Lead Programmer', billing: 4 },
    ],
    map: 'https://www.vgmaps.com/Atlas/NES/FinalFantasyII(J)-WorldMap.png',
    ending: 'https://www.vgmuseum.com/end/nes/a/ff2nes.htm' },

  { id: 'megaman-zero-game-boy-advance',
    credits: [
      { name: 'Ryota Ito', role: 'Director', billing: 1 },
      { name: 'Yoshinori Kawano', role: 'Director', billing: 2 },
      { name: 'Keiji Inafune', role: 'Producer', billing: 3 },
      { name: 'Masahiro Mizukoshi', role: 'Game Designer', billing: 4 },
    ],
    map: 'https://strategywiki.org/wiki/Mega_Man_Zero',
    ending: 'https://www.vgmuseum.com/end/gba/a/mmz.htm' },

  { id: 'mega-man-zero-3-game-boy-advance',
    credits: [
      { name: 'Ryota Ito', role: 'Director', billing: 1 },
      { name: 'Keiji Inafune', role: 'Producer', billing: 2 },
      { name: 'Yoshihisa Tsuda', role: 'Game Designer', billing: 3 },
    ],
    map: 'https://strategywiki.org/wiki/Mega_Man_Zero_3',
    ending: 'https://www.vgmuseum.com/end/gba/e/mmz3.htm' },

  { id: 'jet-force-gemini-nintendo-64',
    credits: [
      { name: 'Lee Schuneman', role: 'Director', billing: 1 },
      { name: 'Paul Mountain', role: 'Director', billing: 2 },
      { name: 'Chris Stamper', role: 'Producer', billing: 3 },
      { name: 'Martin Wakeley', role: 'Game Designer', billing: 4 },
    ],
    map: 'https://strategywiki.org/wiki/Jet_Force_Gemini',
    ending: 'https://www.vgmuseum.com/end/n64/a/jfg.htm' },
]

function personId(name) {
  return 'person:' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

const db = new Database(DB_PATH)

const upsertPerson = db.prepare(`
  INSERT INTO people (id, name, normalized_name, primary_role, created_at, updated_at)
  VALUES (?, ?, ?, 'crew', datetime('now'), datetime('now'))
  ON CONFLICT(id) DO UPDATE SET updated_at = datetime('now')
`)
// Note: upsertPerson takes (id, name, normalized_name) — primary_role is hardcoded in SQL
const upsertGP = db.prepare(`
  INSERT INTO game_people (game_id, person_id, role, billing_order, confidence, is_inferred)
  VALUES (?, ?, ?, ?, 0.85, 0)
  ON CONFLICT(game_id, person_id, role) DO UPDATE SET billing_order = excluded.billing_order
`)
const insertMedia = db.prepare(`
  INSERT OR IGNORE INTO media_references
    (entity_type, entity_id, media_type, asset_subtype, url, provider, license_status, ui_allowed, compliance_status, storage_mode, created_at, updated_at)
  VALUES
    ('game', ?, ?, ?, ?, ?, 'reference_only', 1, 'approved', 'external_url', datetime('now'), datetime('now'))
`)

let creditAdded = 0
let mediaAdded = 0

for (const g of data) {
  const seen = new Set()
  for (const c of (g.credits || [])) {
    const pid = personId(c.name)
    const key = `${pid}:${c.role}`
    if (seen.has(key)) continue
    seen.add(key)
    upsertPerson.run(pid, c.name, c.name.toLowerCase())
    upsertGP.run(g.id, pid, c.role, c.billing)
    creditAdded++
  }

  if (g.map) {
    const provider = g.map.includes('vgmaps') ? 'vgmaps.com' : 'strategywiki.org'
    insertMedia.run(g.id, 'map', 'atlas_map', g.map, provider)
    mediaAdded++
  }
  if (g.ending) {
    insertMedia.run(g.id, 'ending', 'ending_gallery', g.ending, 'vgmuseum.com')
    mediaAdded++
  }

  const roles = [...new Set((g.credits||[]).map(c => c.role.split(' ')[0]))].join('+')
  const media = [g.map ? 'map' : null, g.ending ? 'end' : null].filter(Boolean).join('+')
  console.log('✓', g.id.padEnd(42), '| credits:', roles, '| media:', media || '-')
}

console.log(`\nCredits added : ${creditAdded}`)
console.log(`Media refs    : ${mediaAdded}`)
db.close()
