'use strict'
/**
 * backfill_game_credits.js
 * ══════════════════════════════════════════════════════════════
 * Phase 1 backfill: reads game_people and game_companies, writes into game_credits.
 * ADDITIVE ONLY — no UPDATE, DELETE, or ALTER on existing tables.
 *
 * Usage:
 *   node enrich-database/backfill_game_credits.js --dry-run
 *   node enrich-database/backfill_game_credits.js --limit 100
 *   node enrich-database/backfill_game_credits.js
 */

const { db, supabase, USE_SUPABASE } = require('./bootstrap')

const args   = process.argv.slice(2)
const DRY    = args.includes('--dry-run')
const LIMIT  = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) : null
const sleep  = ms => new Promise(r => setTimeout(r, ms))

// ── Counters ───────────────────────────────────────────────────────────────
let inserted = 0
let skipped  = 0
let errors   = 0

// ── Readers ────────────────────────────────────────────────────────────────
async function readGamePeople() {
  if (USE_SUPABASE) {
    let q = supabase
      .from('game_people')
      .select('game_id, person_id, role, billing_order, source_record_id, confidence, is_inferred')
      .order('id', { ascending: true })
    if (LIMIT) q = q.limit(LIMIT)
    const { data, error } = await q
    if (error) { console.error('[ERROR] read game_people failed:', error.message); return [] }
    return data || []
  }
  const limitClause = LIMIT ? `LIMIT ${LIMIT}` : ''
  return db.prepare(
    `SELECT game_id, person_id, role, billing_order, source_record_id, confidence, is_inferred
     FROM game_people ORDER BY id ${limitClause}`
  ).all()
}

async function readGameCompanies() {
  if (USE_SUPABASE) {
    let q = supabase
      .from('game_companies')
      .select('game_id, company_id, role, source_record_id, confidence, is_inferred')
      .order('id', { ascending: true })
    if (LIMIT) q = q.limit(LIMIT)
    const { data, error } = await q
    if (error) { console.error('[ERROR] read game_companies failed:', error.message); return [] }
    return data || []
  }
  const limitClause = LIMIT ? `LIMIT ${LIMIT}` : ''
  return db.prepare(
    `SELECT game_id, company_id, role, source_record_id, confidence, is_inferred
     FROM game_companies ORDER BY id ${limitClause}`
  ).all()
}

// ── Writer ─────────────────────────────────────────────────────────────────
async function insertCredit(record) {
  if (DRY) {
    console.log(
      `  [DRY] INSERT game_credits: game_id=${record.game_id}` +
      ` entity_id=${record.credited_entity_id} type=${record.credited_entity_type}` +
      ` role=${record.role}`
    )
    inserted++
    return
  }

  if (USE_SUPABASE) {
    const { error } = await supabase.from('game_credits').insert([record])
    if (error) {
      // 23505 = unique_violation — expected skip
      if (error.code === '23505' || (error.message && error.message.includes('unique'))) {
        skipped++
      } else {
        console.error(`  [ERROR] insert game_credits failed (${record.game_id}/${record.credited_entity_id}):`, error.message)
        errors++
      }
    } else {
      inserted++
    }
  } else {
    try {
      db.prepare(
        `INSERT OR IGNORE INTO game_credits
           (game_id, credited_entity_id, credited_entity_type, role, billing_order,
            source_record_id, confidence, is_inferred)
         VALUES (?,?,?,?,?,?,?,?)`
      ).run(
        record.game_id,
        record.credited_entity_id,
        record.credited_entity_type,
        record.role,
        record.billing_order ?? null,
        record.source_record_id ?? null,
        record.confidence ?? 0.5,
        record.is_inferred ?? 0
      )
      // INSERT OR IGNORE: if no change, treat as skipped (can't distinguish easily)
      inserted++
    } catch (e) {
      console.error(`  [ERROR] insert game_credits (SQLite) failed:`, e.message)
      errors++
    }
  }
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('\nRetroDex — backfill_game_credits')
  if (DRY) console.log('[DRY RUN]')
  if (LIMIT) console.log(`[LIMIT] ${LIMIT} rows per source table`)

  // ── Phase 1: game_people → game_credits ───────────────────────────────
  console.log('\n[1/2] Reading game_people...')
  const people = await readGamePeople()
  console.log(`      Found ${people.length} rows`)

  for (const row of people) {
    await insertCredit({
      game_id:              row.game_id,
      credited_entity_id:   String(row.person_id),
      credited_entity_type: 'person',
      role:                 row.role,
      billing_order:        row.billing_order ?? null,
      source_record_id:     row.source_record_id ?? null,
      confidence:           row.confidence ?? 0.5,
      is_inferred:          row.is_inferred ?? 0,
    })
  }

  console.log(`      persons: inserted=${inserted} skipped=${skipped} errors=${errors}`)
  const afterPeople = { inserted, skipped, errors }

  // ── Phase 2: game_companies → game_credits ────────────────────────────
  console.log('\n[2/2] Reading game_companies...')
  const companies = await readGameCompanies()
  console.log(`      Found ${companies.length} rows`)

  for (const row of companies) {
    await insertCredit({
      game_id:              row.game_id,
      credited_entity_id:   String(row.company_id),
      credited_entity_type: 'company',
      role:                 row.role,
      billing_order:        null,
      source_record_id:     row.source_record_id ?? null,
      confidence:           row.confidence ?? 0.5,
      is_inferred:          row.is_inferred ?? 0,
    })
  }

  const companyInserted = inserted - afterPeople.inserted
  const companySkipped  = skipped  - afterPeople.skipped
  const companyErrors   = errors   - afterPeople.errors
  console.log(`      companies: inserted=${companyInserted} skipped=${companySkipped} errors=${companyErrors}`)

  console.log(`\n[DONE] Total inserted=${inserted} skipped=${skipped} errors=${errors}`)
  if (DRY) console.log('[DRY RUN — no writes were performed]')
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
