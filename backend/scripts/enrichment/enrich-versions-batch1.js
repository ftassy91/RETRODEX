#!/usr/bin/env node
'use strict'

const path = require('path')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.resolve(__dirname, '../../storage/retrodex.sqlite')

// Regional version notes — batch 1
// Writes to BOTH games.versions and game_editorial.versions (NULL / empty guard on each).
const VERSIONS = [
  {
    gameId: 'super-mario-bros-2-nintendo-entertainment-system',
    versions: [
      { region: 'Japan', title: 'Super Mario Bros. 2 (Famicom Disk System)', notes: 'The Japanese "Super Mario Bros. 2" is a much harder level pack using the original SMB engine, not released in the West until All-Stars.' },
      { region: 'North America / Europe', title: 'Super Mario Bros. 2', notes: 'The Western release is a reskin of Doki Doki Panic, with Mario characters replacing the original cast. Features Peach, Toad, and Luigi as playable characters with distinct movement styles.' },
    ],
  },
  {
    gameId: 'contra-nintendo-entertainment-system',
    versions: [
      { region: 'Japan', title: 'Contra (Famicom)', notes: 'Player characters Bill and Lance are depicted as Schwarzenegger and Stallone lookalikes in Japanese marketing art, which was toned down for Western releases.' },
      { region: 'North America', title: 'Contra (NES)', notes: 'Western cartridge version. Largely identical to the Famicom original but with different box art removing the muscular character likenesses.' },
      { region: 'Europe', title: 'Probotector', notes: 'Published in Europe as Probotector with the human characters replaced by robots, to comply with content regulations.' },
    ],
  },
  {
    gameId: 'final-fantasy-vi-super-nintendo',
    versions: [
      { region: 'Japan', title: 'Final Fantasy VI (SFC)', notes: 'Original Japanese release. Character named Tina Bradford; magic system uses Japanese terminology. Contains slightly more explicit content in some character scenes.' },
      { region: 'North America', title: 'Final Fantasy III (SNES)', notes: "Renamed Final Fantasy III in North America (as FF2, FF3, FF5 were not released in the West). Character renamed Terra Branford. Some censorship applied to Kefka's laugh and certain dialogue." },
      { region: 'Game Boy Advance', title: 'Final Fantasy VI Advance', notes: "Added new espers (Leviathan, Gilgamesh, Cactuar, Diabolos) and a new dungeon, the Dragon's Den. Slightly adjusted translation. Music quality reduced due to GBA audio limitations." },
    ],
  },
  {
    gameId: 'castlevania-symphony-of-the-night-playstation',
    versions: [
      { region: 'Japan', title: 'Akumajo Dracula X: Chi no Rondo (Saturn)', notes: 'The Saturn port added two playable characters (Maria and Richter with full movesets), two exclusive areas (Underground Garden and Cursed Prison), and arranged music tracks.' },
      { region: 'North America / Europe', title: 'Castlevania: Symphony of the Night (PlayStation)', notes: 'The Western PS1 release has a revised English script and voice acting — including the famous "What is a man?" line that became iconic in internet culture.' },
    ],
  },
  {
    gameId: 'mega-man-2-nintendo-entertainment-system',
    versions: [
      { region: 'Japan', title: 'Rockman 2 (Famicom)', notes: 'The Japanese version only has two difficulty modes: Normal and Difficult. Normal mode features reduced enemy damage. The US/EU release ships with Difficult as the default and sole mode.' },
      { region: 'North America / Europe', title: 'Mega Man 2 (NES)', notes: 'Only Difficult mode available. Slight differences in enemy hit points on certain weapons. Otherwise identical to the Famicom version.' },
    ],
  },
  {
    gameId: 'the-legend-of-zelda-nintendo-entertainment-system',
    versions: [
      { region: 'Japan', title: 'The Hyrule Fantasy: Zelda no Densetsu (Famicom Disk System)', notes: 'Original Japanese release on the Famicom Disk System. Used the save function of the Disk System rather than a battery-backed cartridge. Slightly different enemy placement in some rooms.' },
      { region: 'North America / Europe', title: 'The Legend of Zelda (NES)', notes: 'Gold cartridge with battery-backed save. The western title screen and manual introduced the Hyrule lore in English. Minor adjustments to level design to match cartridge format.' },
    ],
  },
  {
    gameId: 'castlevania-iii-draculas-curse-nintendo-entertainment-system',
    versions: [
      { region: 'Japan', title: 'Akumajo Densetsu (Famicom)', notes: 'The Japanese Famicom version uses the VRC6 sound chip, providing three extra sound channels and a dramatically richer soundtrack, including bass lines and additional instrument layers absent from the NES version.' },
      { region: 'North America', title: "Castlevania III: Dracula's Curse (NES)", notes: 'Standard NES audio — the VRC6 chip was not included in western cartridges due to licensing restrictions. The soundtrack is a noticeably reduced version of the Japanese original.' },
    ],
  },
  {
    gameId: 'chrono-trigger-super-nintendo',
    versions: [
      { region: 'Japan', title: 'Chrono Trigger (SFC)', notes: 'Original Japanese release. Some dialogue differences and slightly different enemy names compared to the Western localization.' },
      { region: 'North America', title: 'Chrono Trigger (SNES)', notes: "Ted Woolsey's localization is known for creative but sometimes liberal translation choices. Several character and item names differ from the Japanese originals." },
      { region: 'PlayStation / DS / PC', title: 'Chrono Trigger (ports)', notes: 'Later ports added animated cutscenes (PS1), touch controls and a new translation (DS), and widescreen support (PC Steam). The PC version initially had performance issues that were patched.' },
    ],
  },
  {
    gameId: 'final-fantasy-vii-playstation',
    versions: [
      { region: 'Japan', title: 'Final Fantasy VII (PS1 Japan)', notes: 'First release. Contains minor dialogue differences and some graphical details adjusted in Western versions.' },
      { region: 'North America / Europe', title: 'Final Fantasy VII (PS1 International)', notes: 'Added the International version content: a new optional boss (Emerald and Ruby Weapon), the W-Item duplication glitch, and a Master Materia that combines all magic.' },
    ],
  },
  {
    gameId: 'super-mario-world-super-nintendo',
    versions: [
      { region: 'Japan', title: 'Super Mario World (SFC, v1.0)', notes: "The original Japanese cartridge has minor graphical differences: Yoshi's sprite on the overworld map differs, and some text references are slightly different." },
      { region: 'North America', title: 'Super Mario World (SNES)', notes: 'Largely identical to the Japanese version. Later revisions removed a small graphical detail in the fire animation.' },
    ],
  },
  {
    gameId: 'castlevania-bloodlines-sega-genesis',
    versions: [
      { region: 'Japan', title: 'Vampire Killer (Mega Drive)', notes: 'Published in Japan as Vampire Killer. Features more explicit horror imagery, including decapitation-style enemy deaths that were toned down in Western releases.' },
      { region: 'Europe', title: 'Castlevania: The New Generation (Mega Drive)', notes: 'European title. Retains more of the Japanese blood effects than the American version. Considered slightly harder due to fewer continues.' },
      { region: 'North America', title: 'Castlevania: Bloodlines (Genesis)', notes: 'Most censored version — reduced blood colors, some enemies altered. Otherwise identical gameplay.' },
    ],
  },
  {
    gameId: 'contra-iii-alien-wars-super-nintendo',
    versions: [
      { region: 'Japan', title: 'Contra Spirits (SFC)', notes: 'The Japanese version features cinematic intro artwork referencing Terminator 2 and Aliens. Some enemy and explosion effects are more detailed.' },
      { region: 'North America', title: 'Contra III: The Alien Wars (SNES)', notes: 'Simplified some visual effects. Renamed from "Contra Spirits" and added the Alien Wars subtitle.' },
      { region: 'Europe', title: 'Super Probotector: Alien Rebels (SNES)', notes: 'Player characters replaced with robots, consistent with the European Probotector branding.' },
    ],
  },
  {
    gameId: 'donkey-kong-country-super-nintendo',
    versions: [
      { region: 'North America (v1.0)', title: 'DKC (SNES, original cart)', notes: 'The first pressing of the cartridge contained a level select cheat that was removed in later revisions.' },
      { region: 'Virtual Console / GBA', title: 'DKC (GBA: Donkey Kong Country)', notes: 'GBA port added a new boss, a photo album mode, and DK Coin challenges. Sound quality is reduced compared to the SNES original.' },
    ],
  },
  {
    gameId: 'earthbound-super-nintendo',
    versions: [
      { region: 'Japan', title: 'Mother 2: Gīgu no Gyakushū (SFC)', notes: 'The original Japanese release. Some text and cultural references differ from the Western version. The anti-piracy screen (which corrupts the save file late in the game) is present in both versions.' },
      { region: 'North America', title: 'EarthBound (SNES)', notes: "Localized by Nintendo of America with significant script rewrites for a Western audience. Some pop culture references were changed. A larger physical package with a 128-page strategy guide was included to compensate for the game's unconventional difficulty." },
    ],
  },
  {
    gameId: 'mega-man-x-super-nintendo',
    versions: [
      { region: 'Japan', title: 'Rockman X (SFC)', notes: 'The Japanese version contains slightly different difficulty tuning in some stages. The intro stage enemy behavior and hit detection have minor differences from the SNES version.' },
      { region: 'North America / Europe', title: 'Mega Man X (SNES)', notes: 'Western localization. Box art replaces the Japanese character art with a more Western-style action pose. Gameplay is virtually identical.' },
    ],
  },
]

function nowIso() {
  return new Date().toISOString()
}

function isNullOrEmpty(val) {
  return val === null || val === undefined || val === ''
}

function buildDryRunPlan(db) {
  const gameIds = VERSIONS.map((e) => e.gameId)
  const placeholders = gameIds.map(() => '?').join(', ')

  const gameRows = db.prepare(
    `SELECT id, versions FROM games WHERE id IN (${placeholders})`
  ).all(...gameIds)
  const gameMap = new Map(gameRows.map((r) => [r.id, r]))

  const editorialRows = db.prepare(
    `SELECT game_id, versions FROM game_editorial WHERE game_id IN (${placeholders})`
  ).all(...gameIds)
  const editorialMap = new Map(editorialRows.map((r) => [r.game_id, r]))

  const plan = {
    totalInMap: VERSIONS.length,
    notFound: [],
    entries: [],
  }

  for (const entry of VERSIONS) {
    if (!gameMap.has(entry.gameId)) {
      plan.notFound.push(entry.gameId)
      continue
    }

    const gRow = gameMap.get(entry.gameId)
    const eRow = editorialMap.get(entry.gameId) || null

    const willWriteGames = isNullOrEmpty(gRow.versions)
    const willWriteEditorial = !eRow || isNullOrEmpty(eRow.versions)

    if (!willWriteGames && !willWriteEditorial) {
      plan.entries.push({ gameId: entry.gameId, action: 'skip', reason: 'both fields already populated' })
    } else {
      plan.entries.push({
        gameId: entry.gameId,
        action: 'write',
        games: willWriteGames,
        editorial: willWriteEditorial,
        editorialExists: Boolean(eRow),
        regionCount: entry.versions.length,
      })
    }
  }

  return plan
}

function applyVersions(db) {
  const timestamp = nowIso()
  const runKey = `enrich-versions-batch1-${timestamp}`

  const runId = Number(db.prepare(`
    INSERT INTO enrichment_runs (
      run_key, pipeline_name, mode, source_name, status, dry_run,
      started_at, items_seen, items_created, items_updated, items_skipped, items_flagged, error_count, notes
    ) VALUES (?, 'enrich_versions_batch1', 'apply', 'internal_curated', 'running', 0,
      ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, timestamp, 'Batch 1 regional version notes — games + game_editorial').lastInsertRowid)

  const metrics = {
    itemsSeen: 0,
    itemsCreated: 0,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    gamesFieldsWritten: 0,
    editorialFieldsWritten: 0,
    editorialRowsCreated: 0,
  }

  const transaction = db.transaction(() => {
    for (const entry of VERSIONS) {
      metrics.itemsSeen += 1

      const gRow = db.prepare('SELECT id, versions FROM games WHERE id = ?').get(entry.gameId)

      if (!gRow) {
        console.log(`  ✗ [NOT FOUND]  ${entry.gameId}`)
        metrics.itemsFlagged += 1
        continue
      }

      const versionsJson = JSON.stringify(entry.versions)

      // ---- games table ----
      let gWritten = 0
      if (isNullOrEmpty(gRow.versions)) {
        db.prepare('UPDATE games SET versions = ? WHERE id = ?').run(versionsJson, entry.gameId)
        gWritten = 1
        metrics.gamesFieldsWritten += 1
      }

      // ---- game_editorial table ----
      const eRow = db.prepare('SELECT game_id, versions FROM game_editorial WHERE game_id = ?').get(entry.gameId)
      let eWritten = 0

      if (!eRow) {
        db.prepare(`
          INSERT INTO game_editorial (game_id, versions, created_at, updated_at)
          VALUES (?, ?, ?, ?)
        `).run(entry.gameId, versionsJson, timestamp, timestamp)
        metrics.editorialRowsCreated += 1
        metrics.itemsCreated += 1
        eWritten = 1
        metrics.editorialFieldsWritten += 1
      } else if (isNullOrEmpty(eRow.versions)) {
        db.prepare(
          'UPDATE game_editorial SET versions = ?, updated_at = ? WHERE game_id = ?'
        ).run(versionsJson, timestamp, entry.gameId)
        eWritten = 1
        metrics.editorialFieldsWritten += 1
      }

      const totalWritten = gWritten + eWritten

      if (totalWritten === 0) {
        console.log(`  - [SKIP]       ${entry.gameId}  (both fields already populated)`)
        metrics.itemsSkipped += 1
      } else {
        const parts = []
        if (gWritten) parts.push('games')
        if (eWritten) parts.push('editorial')
        console.log(`  ✓ [WRITE]      ${entry.gameId}  → ${parts.join(' + ')}  (${entry.versions.length} regions)`)
        metrics.itemsUpdated += 1
      }
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
    `versions-batch1: ${metrics.itemsUpdated} written, ${metrics.itemsSkipped} skipped, ${metrics.itemsFlagged} missing, ${metrics.editorialRowsCreated} editorial rows created`,
    runId
  )

  return { runId, runKey, metrics }
}

function main() {
  const db = new Database(SQLITE_PATH)
  try {
    if (!APPLY) {
      console.log('[DRY-RUN] enrich-versions-batch1 — pass --apply to write\n')
      const plan = buildDryRunPlan(db)

      if (plan.notFound.length) {
        console.log(`Not found in DB (${plan.notFound.length}):`)
        for (const id of plan.notFound) console.log(`  ✗ ${id}`)
        console.log()
      }

      const writes = plan.entries.filter((e) => e.action === 'write')
      const skips = plan.entries.filter((e) => e.action === 'skip')

      console.log(`Would write (${writes.length}):`)
      for (const entry of writes) {
        const targets = []
        if (entry.games) targets.push('games')
        if (entry.editorial) targets.push(entry.editorialExists ? 'editorial (update)' : 'editorial (insert)')
        console.log(`  ✓ ${entry.gameId}  → ${targets.join(' + ')}  (${entry.regionCount} regions)`)
      }

      if (skips.length) {
        console.log(`\nWould skip (${skips.length}) — both fields already populated:`)
        for (const entry of skips) console.log(`  - ${entry.gameId}`)
      }

      console.log(
        `\nSummary: ${writes.length} writes, ${skips.length} skips, ${plan.notFound.length} not found (of ${plan.totalInMap} in map)`
      )
      return
    }

    console.log('[APPLY] enrich-versions-batch1\n')
    const result = applyVersions(db)
    const m = result.metrics
    console.log(`\nDone — run #${result.runId} (${result.runKey})`)
    console.log(`  Written          : ${m.itemsUpdated}`)
    console.log(`  Created editorial: ${m.editorialRowsCreated}`)
    console.log(`  games fields     : ${m.gamesFieldsWritten}`)
    console.log(`  editorial fields : ${m.editorialFieldsWritten}`)
    console.log(`  Skipped          : ${m.itemsSkipped}`)
    console.log(`  Missing          : ${m.itemsFlagged}`)
    console.log(`  Total seen       : ${m.itemsSeen}`)
  } finally {
    db.close()
  }
}

main()
