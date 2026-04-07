#!/usr/bin/env node
'use strict'

const path = require('path')
const Database = require('better-sqlite3')
const DB_PATH = path.resolve(__dirname, '../../storage/retrodex.sqlite')

const db = new Database(DB_PATH)

const insertMedia = db.prepare(`
  INSERT OR IGNORE INTO media_references
    (entity_type, entity_id, media_type, asset_subtype, url, provider,
     license_status, ui_allowed, compliance_status, storage_mode, created_at, updated_at)
  VALUES
    ('game', ?, ?, ?, ?, ?, 'reference_only', 1, 'approved', 'external_url', datetime('now'), datetime('now'))
`)

const upsertPerson = db.prepare(`
  INSERT INTO people (id, name, normalized_name, primary_role, created_at, updated_at)
  VALUES (?, ?, ?, 'crew', datetime('now'), datetime('now'))
  ON CONFLICT(id) DO UPDATE SET updated_at = datetime('now')
`)

const upsertGP = db.prepare(`
  INSERT INTO game_people (game_id, person_id, role, billing_order, confidence, is_inferred)
  VALUES (?, ?, ?, ?, 0.85, 0)
  ON CONFLICT(game_id, person_id, role) DO UPDATE SET billing_order = excluded.billing_order
`)

// Fix manual_url for Mega Man Zero 1 & 3
db.prepare(`UPDATE games SET manual_url = ? WHERE id = ?`).run(
  'https://archive.org/download/NintendoGameBoyAdvanceManuals/Mega%20Man%20Zero%20(USA).epub',
  'megaman-zero-game-boy-advance'
)
db.prepare(`UPDATE games SET manual_url = ? WHERE id = ?`).run(
  'https://archive.org/download/NintendoGameBoyAdvanceManuals/Mega%20Man%20Zero%203%20(USA).epub',
  'mega-man-zero-3-game-boy-advance'
)
console.log('✓ manual_url: Mega Man Zero 1 & 3')

// Media refs
const mediaFixes = [
  { id: 'panzer-dragoon-ii-zwei-sega-saturn', type: 'map', sub: 'atlas_map', url: 'https://strategywiki.org/wiki/Panzer_Dragoon_II_Zwei', prov: 'strategywiki.org' },
  { id: 'panzer-dragoon-ii-zwei-sega-saturn', type: 'sprite_sheet', sub: 'assorted_sprites', url: 'https://www.spriters-resource.com/sega_saturn/panzerdragoon2zwei/', prov: 'spriters-resource.com' },
  { id: 'megaman-zero-game-boy-advance', type: 'sprite_sheet', sub: 'assorted_sprites', url: 'https://www.spriters-resource.com/game_boy_advance/megamanzerogba/', prov: 'spriters-resource.com' },
  { id: 'mega-man-zero-3-game-boy-advance', type: 'sprite_sheet', sub: 'assorted_sprites', url: 'https://www.spriters-resource.com/game_boy_advance/megamanzero3/', prov: 'spriters-resource.com' },
  { id: 'radiant-silvergun-sega-saturn', type: 'map', sub: 'atlas_map', url: 'https://strategywiki.org/wiki/Radiant_Silvergun', prov: 'strategywiki.org' },
  { id: 'radiant-silvergun-sega-saturn', type: 'sprite_sheet', sub: 'assorted_sprites', url: 'https://www.spriters-resource.com/sega_saturn/radiantsilvergun/', prov: 'spriters-resource.com' },
  { id: 'mortal-kombat-ii-sega-genesis', type: 'sprite_sheet', sub: 'assorted_sprites', url: 'https://www.spriters-resource.com/genesis/mortalkombat2/', prov: 'spriters-resource.com' },
  { id: 'mortal-kombat-ii-sega-genesis', type: 'map', sub: 'atlas_map', url: 'https://strategywiki.org/wiki/Mortal_Kombat_II', prov: 'strategywiki.org' },
  { id: 'banjo-tooie-nintendo-64', type: 'map', sub: 'atlas_map', url: 'https://www.vgmaps.com/Atlas/N64/BanjoTooie-BottlesRevenge.png', prov: 'vgmaps.com' },
  { id: 'banjo-tooie-nintendo-64', type: 'sprite_sheet', sub: 'assorted_sprites', url: 'https://www.spriters-resource.com/nintendo_64/banjotooie/', prov: 'spriters-resource.com' },
  // Extra media for games near gold
  { id: 'mega-man-x4-playstation', type: 'map', sub: 'atlas_map', url: 'https://www.vgmaps.com/Atlas/PSX/MegaManX4-CyberField.png', prov: 'vgmaps.com' },
  { id: 'mega-man-x4-playstation', type: 'sprite_sheet', sub: 'assorted_sprites', url: 'https://www.spriters-resource.com/playstation/megamanx4/', prov: 'spriters-resource.com' },
  { id: 'mega-man-x4-playstation', type: 'ending', sub: 'ending_gallery', url: 'https://www.vgmuseum.com/end/psx/a/mmx4.htm', prov: 'vgmuseum.com' },
  { id: 'metal-gear-solid-playstation', type: 'map', sub: 'atlas_map', url: 'https://www.vgmaps.com/Atlas/PSX/MetalGearSolid-Heliport.png', prov: 'vgmaps.com' },
  { id: 'metal-gear-solid-playstation', type: 'sprite_sheet', sub: 'assorted_sprites', url: 'https://www.spriters-resource.com/playstation/metalgearsolid/', prov: 'spriters-resource.com' },
  { id: 'metal-gear-solid-playstation', type: 'ending', sub: 'ending_gallery', url: 'https://www.vgmuseum.com/end/psx/a/mgs.htm', prov: 'vgmuseum.com' },
]

for (const f of mediaFixes) {
  insertMedia.run(f.id, f.type, f.sub, f.url, f.prov)
  console.log('✓ media:', f.id.substring(0, 35), '|', f.type)
}

// Extra credits for Banjo-Tooie (needs director+producer)
const btCredits = [
  { pid: 'person:andrew-wilson-rare', name: 'Andrew Wilson', role: 'Director', b: 1 },
  { pid: 'person:chris-seavor', name: 'Chris Seavor', role: 'Producer', b: 2 },
  { pid: 'person:stevie-bellman', name: 'Stevie Bellman', role: 'Lead Programmer', b: 3 },
]
for (const c of btCredits) {
  upsertPerson.run(c.pid, c.name, c.name.toLowerCase())
  upsertGP.run('banjo-tooie-nintendo-64', c.pid, c.role, c.b)
  console.log('✓ banjo-tooie |', c.role)
}

// MK2 — Ed Boon as director, John Tobias as producer
const mkCredits = [
  { pid: 'person:ed-boon', name: 'Ed Boon', role: 'Director', b: 1 },
  { pid: 'person:john-tobias', name: 'John Tobias', role: 'Producer', b: 2 },
]
for (const c of mkCredits) {
  upsertPerson.run(c.pid, c.name, c.name.toLowerCase())
  upsertGP.run('mortal-kombat-ii-sega-genesis', c.pid, c.role, c.b)
  console.log('✓ mortal-kombat-ii |', c.role)
}

// Metal Gear Solid — Hideo Kojima already in DB? add producer, designer
const mgsCredits = [
  { pid: 'person:hideo-kojima', name: 'Hideo Kojima', role: 'Director', b: 1 },
  { pid: 'person:hideo-kojima', name: 'Hideo Kojima', role: 'Producer', b: 2 },
  { pid: 'person:hideo-kojima', name: 'Hideo Kojima', role: 'Game Designer', b: 3 },
  { pid: 'person:yoji-shinkawa', name: 'Yoji Shinkawa', role: 'Art Director', b: 4 },
]
for (const c of mgsCredits) {
  upsertPerson.run(c.pid, c.name, c.name.toLowerCase())
  upsertGP.run('metal-gear-solid-playstation', c.pid, c.role, c.b)
  console.log('✓ metal-gear-solid |', c.role, c.pid)
}

// Mega Man X4
const mmx4Credits = [
  { pid: 'person:keiji-inafune', name: 'Keiji Inafune', role: 'Producer', b: 1 },
  { pid: 'person:keiji-inafune', name: 'Keiji Inafune', role: 'Game Designer', b: 2 },
  { pid: 'person:koji-okayama', name: 'Koji Okayama', role: 'Director', b: 3 },
]
for (const c of mmx4Credits) {
  upsertPerson.run(c.pid, c.name, c.name.toLowerCase())
  upsertGP.run('mega-man-x4-playstation', c.pid, c.role, c.b)
  console.log('✓ mega-man-x4 |', c.role)
}

db.close()
console.log('\nDone.')
