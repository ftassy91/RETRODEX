'use strict'
/**
 * backfill_game_ost.js
 * ══════════════════════════════════════════════════════════════
 * Phase 1 backfill: reads ost and ost_tracks, writes into game_ost and game_ost_tracks.
 * ADDITIVE ONLY — no UPDATE, DELETE, or ALTER on existing tables.
 *
 * Column mapping:
 *   ost        → game_ost       : id, game_id, title, source_record_id
 *   ost_tracks → game_ost_tracks: ost_id, track_title→title, track_number, composer_person_id,
 *                                  source_record_id, confidence
 *                                  (duration_seconds not in ost_tracks — will be NULL)
 *
 * Usage:
 *   node enrich-database/backfill_game_ost.js --dry-run
 *   node enrich-database/backfill_game_ost.js --limit 50
 *   node enrich-database/backfill_game_ost.js
 */

const { db, supabase, USE_SUPABASE } = require('./bootstrap')

const args  = process.argv.slice(2)
const DRY   = args.includes('--dry-run')
const LIMIT = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) : null
const sleep = ms => new Promise(r => setTimeout(r, ms))

// ── Counters ───────────────────────────────────────────────────────────────
const stats = { ostInserted: 0, ostSkipped: 0, ostErrors: 0, trackInserted: 0, trackSkipped: 0, trackErrors: 0 }

// ── Readers ────────────────────────────────────────────────────────────────
async function readOst() {
  if (USE_SUPABASE) {
    let q = supabase
      .from('ost')
      .select('id, game_id, title, source_record_id')
      .order('id', { ascending: true })
    if (LIMIT) q = q.limit(LIMIT)
    const { data, error } = await q
    if (error) { console.error('[ERROR] read ost failed:', error.message); return [] }
    return data || []
  }
  const limitClause = LIMIT ? `LIMIT ${LIMIT}` : ''
  return db.prepare(
    `SELECT id, game_id, title, source_record_id FROM ost ORDER BY id ${limitClause}`
  ).all()
}

async function readOstTracks(ostId) {
  if (USE_SUPABASE) {
    const { data, error } = await supabase
      .from('ost_tracks')
      .select('id, ost_id, track_title, track_number, composer_person_id, source_record_id, confidence')
      .eq('ost_id', ostId)
      .order('track_number', { ascending: true })
    if (error) { console.error(`[ERROR] read ost_tracks for ost_id=${ostId} failed:`, error.message); return [] }
    return data || []
  }
  return db.prepare(
    `SELECT id, ost_id, track_title, track_number, composer_person_id, source_record_id, confidence
     FROM ost_tracks WHERE ost_id = ? ORDER BY track_number`
  ).all(ostId)
}

// ── Writers ────────────────────────────────────────────────────────────────
async function insertGameOst(record) {
  if (DRY) {
    console.log(`  [DRY] INSERT game_ost: id=${record.id} game_id=${record.game_id} title=${record.title}`)
    stats.ostInserted++
    return
  }

  if (USE_SUPABASE) {
    const { error } = await supabase.from('game_ost').insert([record])
    if (error) {
      if (error.code === '23505' || (error.message && error.message.includes('unique'))) {
        stats.ostSkipped++
      } else {
        console.error(`  [ERROR] insert game_ost failed (id=${record.id}):`, error.message)
        stats.ostErrors++
      }
    } else {
      stats.ostInserted++
    }
  } else {
    try {
      db.prepare(
        `INSERT OR IGNORE INTO game_ost (id, game_id, title, source_record_id)
         VALUES (?,?,?,?)`
      ).run(record.id, record.game_id, record.title ?? null, record.source_record_id ?? null)
      stats.ostInserted++
    } catch (e) {
      console.error(`  [ERROR] insert game_ost (SQLite) failed:`, e.message)
      stats.ostErrors++
    }
  }
}

async function insertGameOstTrack(record) {
  if (DRY) {
    console.log(`  [DRY] INSERT game_ost_tracks: ost_id=${record.ost_id} title=${record.title}`)
    stats.trackInserted++
    return
  }

  if (USE_SUPABASE) {
    const { error } = await supabase.from('game_ost_tracks').insert([record])
    if (error) {
      if (error.code === '23505' || (error.message && error.message.includes('unique'))) {
        stats.trackSkipped++
      } else {
        console.error(`  [ERROR] insert game_ost_tracks failed (ost_id=${record.ost_id}):`, error.message)
        stats.trackErrors++
      }
    } else {
      stats.trackInserted++
    }
  } else {
    try {
      db.prepare(
        `INSERT OR IGNORE INTO game_ost_tracks
           (ost_id, track_number, title, composer_person_id, duration_seconds, source_record_id, confidence)
         VALUES (?,?,?,?,?,?,?)`
      ).run(
        record.ost_id,
        record.track_number ?? null,
        record.title,
        record.composer_person_id ?? null,
        record.duration_seconds ?? null,
        record.source_record_id ?? null,
        record.confidence ?? 0.5
      )
      stats.trackInserted++
    } catch (e) {
      console.error(`  [ERROR] insert game_ost_tracks (SQLite) failed:`, e.message)
      stats.trackErrors++
    }
  }
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('\nRetroDex — backfill_game_ost')
  if (DRY) console.log('[DRY RUN]')
  if (LIMIT) console.log(`[LIMIT] ${LIMIT} OST rows`)

  // ── Phase 1: ost → game_ost ────────────────────────────────────────────
  console.log('\n[1/2] Reading ost...')
  const ostRows = await readOst()
  console.log(`      Found ${ostRows.length} OST rows`)

  for (const row of ostRows) {
    await insertGameOst({
      id:               row.id,
      game_id:          row.game_id,
      title:            row.title ?? null,
      source_record_id: row.source_record_id ?? null,
    })
  }

  console.log(`      game_ost: inserted=${stats.ostInserted} skipped=${stats.ostSkipped} errors=${stats.ostErrors}`)

  // ── Phase 2: ost_tracks → game_ost_tracks ─────────────────────────────
  console.log('\n[2/2] Reading ost_tracks...')

  // Fetch tracks per OST to keep memory bounded
  for (const ost of ostRows) {
    const tracks = await readOstTracks(ost.id)
    for (const track of tracks) {
      await insertGameOstTrack({
        ost_id:             track.ost_id,
        track_number:       track.track_number ?? null,
        title:              track.track_title,        // ost_tracks.track_title → game_ost_tracks.title
        composer_person_id: track.composer_person_id ?? null,
        duration_seconds:   null,                     // not available in source ost_tracks table
        source_record_id:   track.source_record_id ?? null,
        confidence:         track.confidence ?? 0.5,
      })
    }
    if (tracks.length > 0) {
      process.stdout.write(
        `\r  game_ost_tracks: inserted=${stats.trackInserted} skipped=${stats.trackSkipped} errors=${stats.trackErrors}`
      )
    }
  }

  console.log(
    `\n      game_ost_tracks: inserted=${stats.trackInserted} skipped=${stats.trackSkipped} errors=${stats.trackErrors}`
  )

  console.log(
    `\n[DONE] OST inserted=${stats.ostInserted} skipped=${stats.ostSkipped} errors=${stats.ostErrors}` +
    ` | Tracks inserted=${stats.trackInserted} skipped=${stats.trackSkipped} errors=${stats.trackErrors}`
  )
  if (DRY) console.log('[DRY RUN — no writes were performed]')
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
