'use strict'
/**
 * backfill_price_summary.js
 * ══════════════════════════════════════════════════════════════
 * Phase 1 backfill: reads price_observations, computes per-game aggregate stats,
 * writes into price_summary.
 * ADDITIVE ONLY — upsert only on price_summary (no writes to existing tables).
 *
 * Per game_id:
 *   - Computes p25/p50/p75 for loose/cib/mint using observations from last 90 days
 *   - Computes sample_count per condition
 *   - Computes trend_90d: compare median now vs median at start of window (>5% = up/down)
 *   - Sets confidence_score: 0-10 samples → 20, 11-30 → 50, 31+ → 80
 *   - Upserts into price_summary (on conflict game_id, update all fields)
 *
 * Conditions are normalized to lowercase (loose/cib/mint).
 *
 * Usage:
 *   node enrich-database/backfill_price_summary.js --dry-run
 *   node enrich-database/backfill_price_summary.js --limit 50
 *   node enrich-database/backfill_price_summary.js
 */

const { db, supabase, USE_SUPABASE } = require('./bootstrap')

const args  = process.argv.slice(2)
const DRY   = args.includes('--dry-run')
const LIMIT = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) : null
const sleep = ms => new Promise(r => setTimeout(r, ms))

const WINDOW_DAYS  = 90
const TREND_THRESH = 0.05   // 5% change threshold

// ── Stats counters ─────────────────────────────────────────────────────────
let upserted = 0
let skipped  = 0
let errors   = 0

// ── Percentile helper ──────────────────────────────────────────────────────
function percentile(sortedArr, p) {
  if (!sortedArr.length) return null
  if (sortedArr.length === 1) return sortedArr[0]
  const idx = (p / 100) * (sortedArr.length - 1)
  const lo  = Math.floor(idx)
  const hi  = Math.ceil(idx)
  if (lo === hi) return sortedArr[lo]
  return sortedArr[lo] + (sortedArr[hi] - sortedArr[lo]) * (idx - lo)
}

// Round to 2 decimal places, or null
function round2(v) {
  return v == null ? null : Math.round(v * 100) / 100
}

// ── Fetch distinct game_ids ────────────────────────────────────────────────
async function fetchGameIds() {
  if (USE_SUPABASE) {
    // Supabase doesn't support DISTINCT directly via .select() without raw SQL,
    // so we fetch all game_ids and deduplicate in JS.
    // For large datasets, use RPC or pagination — here we page through.
    const PAGE    = 1000
    let offset    = 0
    const gameSet = new Set()

    while (true) {
      const { data, error } = await supabase
        .from('price_observations')
        .select('game_id')
        .range(offset, offset + PAGE - 1)
      if (error) { console.error('[ERROR] fetchGameIds page failed:', error.message); break }
      if (!data || data.length === 0) break
      for (const row of data) gameSet.add(row.game_id)
      if (data.length < PAGE) break
      offset += PAGE
    }

    let ids = Array.from(gameSet)
    if (LIMIT) ids = ids.slice(0, LIMIT)
    return ids
  }

  // SQLite
  const limitClause = LIMIT ? `LIMIT ${LIMIT}` : ''
  const rows = db.prepare(
    `SELECT DISTINCT game_id FROM price_observations ORDER BY game_id ${limitClause}`
  ).all()
  return rows.map(r => r.game_id)
}

// ── Fetch observations for one game_id (last 90 days + up to 90 days before that) ──
async function fetchObservations(gameId, since) {
  if (USE_SUPABASE) {
    const { data, error } = await supabase
      .from('price_observations')
      .select('condition, price, observed_at')
      .eq('game_id', gameId)
      .gte('observed_at', since)
    if (error) { console.error(`[ERROR] fetchObservations(${gameId}) failed:`, error.message); return [] }
    return data || []
  }
  return db.prepare(
    `SELECT condition, price, observed_at FROM price_observations
     WHERE game_id = ? AND observed_at >= ?`
  ).all(gameId, since)
}

// ── Compute stats for one game ─────────────────────────────────────────────
function computeStats(observations) {
  const now          = new Date()
  const cutoff90     = new Date(now - WINDOW_DAYS * 24 * 3600 * 1000)
  const cutoff90str  = cutoff90.toISOString().slice(0, 10)
  const halfPoint    = new Date(now - (WINDOW_DAYS / 2) * 24 * 3600 * 1000)
  const halfPointStr = halfPoint.toISOString().slice(0, 10)

  // Normalize conditions and bucket by recency
  const recent  = { loose: [], cib: [], mint: [] }  // last 90 days
  const older   = { loose: [], cib: [], mint: [] }  // older half of window (trend baseline)
  let lastObservedAt = null

  for (const obs of observations) {
    const cond = (obs.condition || '').toLowerCase()
    if (!['loose', 'cib', 'mint'].includes(cond)) continue
    const price = parseFloat(obs.price)
    if (!price || price <= 0) continue
    const obsDate = (obs.observed_at || '').slice(0, 10)
    if (!obsDate) continue
    if (obsDate >= cutoff90str) {
      recent[cond].push(price)
      if (!lastObservedAt || obsDate > lastObservedAt) lastObservedAt = obsDate
    }
    // Older bucket: from cutoff180 to halfway through window (for trend baseline)
    if (obsDate < halfPointStr && obsDate >= cutoff90str.slice(0, 4) + '-01-01') {
      // actually we want the early portion of the 90-day window as baseline
    }
    if (obsDate < halfPointStr && obsDate >= cutoff90str) {
      older[cond].push(price)
    }
  }

  // Sort all buckets
  for (const cond of ['loose', 'cib', 'mint']) {
    recent[cond].sort((a, b) => a - b)
    older[cond].sort((a, b) => a - b)
  }

  // Compute p25/p50/p75 per condition
  const stats = {}
  let totalSamples = 0
  for (const cond of ['loose', 'cib', 'mint']) {
    const arr = recent[cond]
    stats[`${cond}_price_p50`] = round2(percentile(arr, 50))
    stats[`${cond}_price_p25`] = round2(percentile(arr, 25))
    stats[`${cond}_price_p75`] = round2(percentile(arr, 75))
    stats[`${cond}_sample_count`] = arr.length
    totalSamples += arr.length
  }

  // Trend: compare p50 across all conditions (use loose as primary, fallback to cib/mint)
  let trend90d = 'stable'
  const primaryCond = ['loose', 'cib', 'mint'].find(c => recent[c].length > 0 && older[c].length > 0)
  if (primaryCond) {
    const nowMedian   = percentile(recent[primaryCond], 50)
    const thenMedian  = percentile(older[primaryCond], 50)
    if (nowMedian != null && thenMedian != null && thenMedian > 0) {
      const change = (nowMedian - thenMedian) / thenMedian
      if (change > TREND_THRESH)       trend90d = 'up'
      else if (change < -TREND_THRESH) trend90d = 'down'
    }
  }

  // Confidence score based on total sample count
  let confidenceScore = 0
  if (totalSamples >= 31)       confidenceScore = 80
  else if (totalSamples >= 11)  confidenceScore = 50
  else if (totalSamples >= 1)   confidenceScore = 20

  return { ...stats, trend90d, last_observed_at: lastObservedAt, confidence_score: confidenceScore }
}

// ── Upsert price_summary ───────────────────────────────────────────────────
async function upsertPriceSummary(gameId, stats) {
  const record = {
    game_id:             gameId,
    loose_price_p50:     stats.loose_price_p50,
    loose_price_p25:     stats.loose_price_p25,
    loose_price_p75:     stats.loose_price_p75,
    loose_sample_count:  stats.loose_sample_count,
    cib_price_p50:       stats.cib_price_p50,
    cib_price_p25:       stats.cib_price_p25,
    cib_price_p75:       stats.cib_price_p75,
    cib_sample_count:    stats.cib_sample_count,
    mint_price_p50:      stats.mint_price_p50,
    mint_price_p25:      stats.mint_price_p25,
    mint_price_p75:      stats.mint_price_p75,
    mint_sample_count:   stats.mint_sample_count,
    trend_90d:           stats.trend90d,
    last_observed_at:    stats.last_observed_at,
    confidence_score:    stats.confidence_score,
    computed_at:         new Date().toISOString(),
  }

  if (DRY) {
    console.log(
      `  [DRY] UPSERT price_summary: game_id=${gameId}` +
      ` loose_p50=${record.loose_price_p50}` +
      ` cib_p50=${record.cib_price_p50}` +
      ` mint_p50=${record.mint_price_p50}` +
      ` trend=${record.trend_90d}` +
      ` samples=${stats.loose_sample_count + stats.cib_sample_count + stats.mint_sample_count}` +
      ` confidence=${record.confidence_score}`
    )
    upserted++
    return
  }

  if (USE_SUPABASE) {
    const { error } = await supabase
      .from('price_summary')
      .upsert([record], { onConflict: 'game_id' })
    if (error) {
      console.error(`  [ERROR] upsert price_summary failed (${gameId}):`, error.message)
      errors++
    } else {
      upserted++
    }
  } else {
    try {
      db.prepare(
        `INSERT INTO price_summary
           (game_id, loose_price_p50, loose_price_p25, loose_price_p75, loose_sample_count,
            cib_price_p50, cib_price_p25, cib_price_p75, cib_sample_count,
            mint_price_p50, mint_price_p25, mint_price_p75, mint_sample_count,
            trend_90d, last_observed_at, confidence_score, computed_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(game_id) DO UPDATE SET
           loose_price_p50=excluded.loose_price_p50,
           loose_price_p25=excluded.loose_price_p25,
           loose_price_p75=excluded.loose_price_p75,
           loose_sample_count=excluded.loose_sample_count,
           cib_price_p50=excluded.cib_price_p50,
           cib_price_p25=excluded.cib_price_p25,
           cib_price_p75=excluded.cib_price_p75,
           cib_sample_count=excluded.cib_sample_count,
           mint_price_p50=excluded.mint_price_p50,
           mint_price_p25=excluded.mint_price_p25,
           mint_price_p75=excluded.mint_price_p75,
           mint_sample_count=excluded.mint_sample_count,
           trend_90d=excluded.trend_90d,
           last_observed_at=excluded.last_observed_at,
           confidence_score=excluded.confidence_score,
           computed_at=excluded.computed_at`
      ).run(
        record.game_id,
        record.loose_price_p50, record.loose_price_p25, record.loose_price_p75, record.loose_sample_count,
        record.cib_price_p50,   record.cib_price_p25,   record.cib_price_p75,   record.cib_sample_count,
        record.mint_price_p50,  record.mint_price_p25,  record.mint_price_p75,  record.mint_sample_count,
        record.trend_90d, record.last_observed_at, record.confidence_score, record.computed_at
      )
      upserted++
    } catch (e) {
      console.error(`  [ERROR] upsert price_summary (SQLite) failed (${gameId}):`, e.message)
      errors++
    }
  }
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('\nRetroDex — backfill_price_summary')
  if (DRY) console.log('[DRY RUN]')
  if (LIMIT) console.log(`[LIMIT] ${LIMIT} games`)

  console.log('\nFetching distinct game_ids from price_observations...')
  const gameIds = await fetchGameIds()
  console.log(`Found ${gameIds.length} games to process`)

  // We need observations from 2× the window to compute trend
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 3600 * 1000).toISOString().slice(0, 10)

  let processed = 0
  for (const gameId of gameIds) {
    const observations = await fetchObservations(gameId, since)
    if (observations.length === 0) {
      skipped++
      continue
    }
    const stats = computeStats(observations)
    await upsertPriceSummary(gameId, stats)
    processed++
    if (processed % 25 === 0 || processed === gameIds.length) {
      process.stdout.write(
        `\r  Processed: ${processed}/${gameIds.length} | upserted=${upserted} skipped=${skipped} errors=${errors}`
      )
    }
  }

  console.log(
    `\n\n[DONE] processed=${processed} upserted=${upserted} skipped=${skipped} errors=${errors}`
  )
  if (DRY) console.log('[DRY RUN — no writes were performed]')
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
