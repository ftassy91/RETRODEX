#!/usr/bin/env node
'use strict'

/**
 * Applies migrations 014 + 015 directly to Supabase via pg pooler.
 * Safe: all DDL uses IF NOT EXISTS / column-existence checks.
 */

const { Client } = require('pg')

const PG_CONFIG = {
  host: 'aws-1-eu-west-1.pooler.supabase.com',
  port: 6543,
  user: 'postgres.doipqgkhfzqvmzrdfvuq',
  password: 'Didierdrogba1991',
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
}

const PRICE_SOURCE_SEED_ROWS = [
  { slug: 'yahoo_auctions_jp', name: 'Yahoo Auctions Japan', marketBucket: 'jp', sourceType: 'marketplace', reliabilityWeight: 0.9, defaultCurrency: 'JPY', complianceStatus: 'approved_with_review', isActive: true, isPrimarySoldTruth: true, publishEligible: true, notes: 'Closed/completed auction results only.' },
  { slug: 'mercari_jp', name: 'Mercari Japan', marketBucket: 'jp', sourceType: 'marketplace', reliabilityWeight: 0.82, defaultCurrency: 'JPY', complianceStatus: 'approved_with_review', isActive: true, isPrimarySoldTruth: true, publishEligible: true, notes: 'Sold items only.' },
  { slug: 'rakuma', name: 'Rakuma', marketBucket: 'jp', sourceType: 'marketplace', reliabilityWeight: 0.76, defaultCurrency: 'JPY', complianceStatus: 'approved_with_review', isActive: true, isPrimarySoldTruth: true, publishEligible: true, notes: 'Sold items only.' },
  { slug: 'mercari_us', name: 'Mercari US', marketBucket: 'us', sourceType: 'marketplace', reliabilityWeight: 0.8, defaultCurrency: 'USD', complianceStatus: 'approved_with_review', isActive: true, isPrimarySoldTruth: true, publishEligible: true, notes: 'Sold items only.' },
  { slug: 'shopgoodwill', name: 'ShopGoodwill', marketBucket: 'us', sourceType: 'auction_house', reliabilityWeight: 0.72, defaultCurrency: 'USD', complianceStatus: 'approved_with_review', isActive: true, isPrimarySoldTruth: true, publishEligible: true, notes: 'Closed auctions only.' },
  { slug: 'heritage', name: 'Heritage Auctions', marketBucket: 'us', sourceType: 'auction_house', reliabilityWeight: 0.95, defaultCurrency: 'USD', complianceStatus: 'approved_with_review', isActive: true, isPrimarySoldTruth: true, publishEligible: true, notes: 'Realized prices only. Premium validation source.' },
  { slug: 'catawiki', name: 'Catawiki', marketBucket: 'eu', sourceType: 'auction_house', reliabilityWeight: 0.72, defaultCurrency: 'EUR', complianceStatus: 'approved_with_review', isActive: true, isPrimarySoldTruth: true, publishEligible: true, notes: 'Closed auction results only.' },
  { slug: 'ebay', name: 'eBay', marketBucket: 'us', sourceType: 'marketplace', reliabilityWeight: 0.85, defaultCurrency: 'USD', complianceStatus: 'approved', isActive: true, isPrimarySoldTruth: true, publishEligible: false, notes: 'Legacy real-sale source retained for compatibility and historical backfill only.' },
  { slug: 'pricecharting_calibration', name: 'PriceCharting Calibration', marketBucket: 'us', sourceType: 'aggregator', reliabilityWeight: 0.55, defaultCurrency: 'USD', complianceStatus: 'approved_with_review', isActive: true, isPrimarySoldTruth: false, publishEligible: false, notes: 'Calibration only. Never primary sold truth.' },
  { slug: 'collector_media_signal', name: 'Collector Media Signal', marketBucket: 'eu', sourceType: 'manual_signal', reliabilityWeight: 0.2, defaultCurrency: 'EUR', complianceStatus: 'reference_only', isActive: true, isPrimarySoldTruth: false, publishEligible: false, notes: 'Secondary only for anomaly detection, rarity hints, or manual review queues.' },
  { slug: 'json_fixture', name: 'JSON Fixture', marketBucket: 'eu', sourceType: 'manual_signal', reliabilityWeight: 0.1, defaultCurrency: 'EUR', complianceStatus: 'approved', isActive: true, isPrimarySoldTruth: false, publishEligible: false, notes: 'Local fixture source for deterministic tests and dry runs.' },
]

async function columnExists(client, tableName, columnName) {
  const { rows } = await client.query(`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
  `, [tableName, columnName])
  return rows.length > 0
}

async function addColumnIfMissing(client, tableName, columnName, definition) {
  const exists = await columnExists(client, tableName, columnName)
  if (exists) {
    console.log(`  column ${tableName}.${columnName} already exists — skip`)
    return
  }
  await client.query(`ALTER TABLE public.${tableName} ADD COLUMN IF NOT EXISTS ${columnName} ${definition}`)
  console.log(`  + column ${tableName}.${columnName}`)
}

async function runSafe(client, label, sql) {
  try {
    await client.query(sql)
    console.log(`  ✓ ${label}`)
  } catch (err) {
    const msg = String(err.message || '').toLowerCase()
    if (msg.includes('already exists') || msg.includes('does not exist')) {
      console.log(`  ~ ${label} (already applied or n/a)`)
    } else {
      console.error(`  ✗ ${label}: ${err.message}`)
      throw err
    }
  }
}

async function main() {
  const client = new Client(PG_CONFIG)
  await client.connect()
  console.log('Connected to Supabase pg pooler')

  try {
    // ─── Migration 014 ────────────────────────────────────────────────

    console.log('\n[014] Creating price_sources table…')
    await runSafe(client, 'CREATE price_sources', `
      CREATE TABLE IF NOT EXISTS public.price_sources (
        id                    SERIAL PRIMARY KEY,
        slug                  TEXT NOT NULL UNIQUE,
        name                  TEXT NOT NULL,
        market_bucket         TEXT NOT NULL,
        source_type           TEXT NOT NULL,
        reliability_weight    FLOAT NOT NULL DEFAULT 0,
        default_currency      VARCHAR(8),
        compliance_status     TEXT NOT NULL DEFAULT 'approved_with_review',
        is_active             BOOLEAN NOT NULL DEFAULT TRUE,
        is_primary_sold_truth BOOLEAN NOT NULL DEFAULT FALSE,
        publish_eligible      BOOLEAN NOT NULL DEFAULT FALSE,
        notes                 TEXT,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    console.log('\n[014] Creating price_ingest_runs table…')
    await runSafe(client, 'CREATE price_ingest_runs', `
      CREATE TABLE IF NOT EXISTS public.price_ingest_runs (
        id                    SERIAL PRIMARY KEY,
        source_id             INTEGER,
        source_market         TEXT,
        status                TEXT NOT NULL,
        started_at            TIMESTAMPTZ NOT NULL,
        finished_at           TIMESTAMPTZ,
        fetched_count         INTEGER NOT NULL DEFAULT 0,
        normalized_count      INTEGER NOT NULL DEFAULT 0,
        inserted_count        INTEGER NOT NULL DEFAULT 0,
        deduped_count         INTEGER NOT NULL DEFAULT 0,
        matched_count         INTEGER NOT NULL DEFAULT 0,
        rejected_count        INTEGER NOT NULL DEFAULT 0,
        published_games_count INTEGER NOT NULL DEFAULT 0,
        notes                 TEXT,
        error_summary         TEXT
      )
    `)

    console.log('\n[014] Creating price_rejections table…')
    await runSafe(client, 'CREATE price_rejections', `
      CREATE TABLE IF NOT EXISTS public.price_rejections (
        id                SERIAL PRIMARY KEY,
        source_id         INTEGER,
        source_market     TEXT,
        listing_reference TEXT,
        title_raw         TEXT,
        rejection_reason  TEXT NOT NULL,
        rejection_stage   TEXT NOT NULL,
        raw_payload       TEXT,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    console.log('\n[014] Adding new columns to price_history…')
    await addColumnIfMissing(client, 'price_history', 'source_id', 'INTEGER')
    await addColumnIfMissing(client, 'price_history', 'source_market', 'TEXT')
    await addColumnIfMissing(client, 'price_history', 'is_real_sale', 'BOOLEAN')
    await addColumnIfMissing(client, 'price_history', 'sale_type', 'TEXT')
    await addColumnIfMissing(client, 'price_history', 'listing_reference', 'TEXT')
    await addColumnIfMissing(client, 'price_history', 'sold_at', 'TIMESTAMPTZ')
    await addColumnIfMissing(client, 'price_history', 'currency', 'VARCHAR(8)')
    await addColumnIfMissing(client, 'price_history', 'price_original', 'FLOAT')
    await addColumnIfMissing(client, 'price_history', 'price_eur', 'FLOAT')
    await addColumnIfMissing(client, 'price_history', 'title_raw', 'TEXT')
    await addColumnIfMissing(client, 'price_history', 'condition_normalized', 'TEXT')
    await addColumnIfMissing(client, 'price_history', 'normalized_region', 'TEXT')
    await addColumnIfMissing(client, 'price_history', 'country_code', 'VARCHAR(8)')
    await addColumnIfMissing(client, 'price_history', 'match_confidence', 'FLOAT')
    await addColumnIfMissing(client, 'price_history', 'source_confidence', 'FLOAT')
    await addColumnIfMissing(client, 'price_history', 'payload_hash', 'VARCHAR(128)')
    await addColumnIfMissing(client, 'price_history', 'raw_payload', 'JSONB')

    console.log('\n[014] Adding new columns to games…')
    await addColumnIfMissing(client, 'games', 'price_confidence_tier', 'TEXT')
    await addColumnIfMissing(client, 'games', 'price_confidence_reason', 'TEXT')

    console.log('\n[014] Seeding price_sources…')
    for (const source of PRICE_SOURCE_SEED_ROWS) {
      await client.query(`
        INSERT INTO public.price_sources (
          slug, name, market_bucket, source_type, reliability_weight,
          default_currency, compliance_status, is_active, is_primary_sold_truth,
          publish_eligible, notes, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name,
          market_bucket = EXCLUDED.market_bucket,
          source_type = EXCLUDED.source_type,
          reliability_weight = EXCLUDED.reliability_weight,
          default_currency = EXCLUDED.default_currency,
          compliance_status = EXCLUDED.compliance_status,
          is_active = EXCLUDED.is_active,
          is_primary_sold_truth = EXCLUDED.is_primary_sold_truth,
          publish_eligible = EXCLUDED.publish_eligible,
          notes = EXCLUDED.notes,
          updated_at = NOW()
      `, [
        source.slug, source.name, source.marketBucket, source.sourceType,
        source.reliabilityWeight, source.defaultCurrency, source.complianceStatus,
        source.isActive, source.isPrimarySoldTruth, source.publishEligible, source.notes,
      ])
      console.log(`  upserted: ${source.slug}`)
    }

    console.log('\n[014] Creating indexes…')
    await runSafe(client, 'idx_price_sources_slug', `CREATE INDEX IF NOT EXISTS idx_price_sources_slug ON public.price_sources(slug)`)
    await runSafe(client, 'idx_price_sources_bucket_active', `CREATE INDEX IF NOT EXISTS idx_price_sources_bucket_active ON public.price_sources(market_bucket, is_active)`)
    await runSafe(client, 'idx_price_ingest_runs_source_started', `CREATE INDEX IF NOT EXISTS idx_price_ingest_runs_source_started ON public.price_ingest_runs(source_id, started_at)`)
    await runSafe(client, 'idx_price_ingest_runs_status_started', `CREATE INDEX IF NOT EXISTS idx_price_ingest_runs_status_started ON public.price_ingest_runs(status, started_at)`)
    await runSafe(client, 'idx_price_rejections_source_stage', `CREATE INDEX IF NOT EXISTS idx_price_rejections_source_stage ON public.price_rejections(source_id, rejection_stage)`)
    await runSafe(client, 'idx_price_history_source_market_sold_at', `CREATE INDEX IF NOT EXISTS idx_price_history_source_market_sold_at ON public.price_history(source_market, sold_at)`)
    await runSafe(client, 'idx_price_history_normalized_region_game_sold_at', `CREATE INDEX IF NOT EXISTS idx_price_history_normalized_region_game_sold_at ON public.price_history(normalized_region, game_id, sold_at)`)
    await runSafe(client, 'idx_price_history_game_condition_sold_at', `CREATE INDEX IF NOT EXISTS idx_price_history_game_condition_sold_at ON public.price_history(game_id, condition_normalized, sold_at)`)
    await runSafe(client, 'idx_price_history_payload_hash', `CREATE INDEX IF NOT EXISTS idx_price_history_payload_hash ON public.price_history(payload_hash)`)
    await runSafe(client, 'idx_price_history_listing_reference', `CREATE INDEX IF NOT EXISTS idx_price_history_listing_reference ON public.price_history(listing_reference)`)

    console.log('\n[014] Adding constraints…')
    await runSafe(client, 'check sale_type', `ALTER TABLE public.price_history ADD CONSTRAINT price_history_sale_type_check CHECK (sale_type IS NULL OR sale_type IN ('auction', 'fixed_price_sold', 'realized_price'))`)
    await runSafe(client, 'check condition_normalized', `ALTER TABLE public.price_history ADD CONSTRAINT price_history_condition_normalized_check CHECK (condition_normalized IS NULL OR condition_normalized IN ('Loose', 'CIB', 'Mint'))`)
    await runSafe(client, 'check normalized_region', `ALTER TABLE public.price_history ADD CONSTRAINT price_history_normalized_region_check CHECK (normalized_region IS NULL OR normalized_region IN ('PAL', 'NTSC-U', 'NTSC-J', 'NTSC-B', 'MULTI', 'unknown'))`)
    await runSafe(client, 'check confidence_tier', `ALTER TABLE public.games ADD CONSTRAINT games_price_confidence_tier_check CHECK (price_confidence_tier IS NULL OR price_confidence_tier IN ('high', 'medium', 'low', 'unknown'))`)
    await runSafe(client, 'unique source_id+listing_reference', `ALTER TABLE public.price_history ADD CONSTRAINT price_history_source_listing_unique UNIQUE (source_id, listing_reference)`)

    // ─── Migration 015 ────────────────────────────────────────────────

    console.log('\n[015] Adding columns to price_ingest_runs…')
    await addColumnIfMissing(client, 'price_ingest_runs', 'run_key', 'TEXT')
    await addColumnIfMissing(client, 'price_ingest_runs', 'pipeline_name', 'TEXT')
    await addColumnIfMissing(client, 'price_ingest_runs', 'source_scope', 'TEXT')
    await addColumnIfMissing(client, 'price_ingest_runs', 'dry_run', 'BOOLEAN')

    console.log('\n[015] Creating indexes…')
    await runSafe(client, 'idx_price_ingest_runs_run_key_unique', `CREATE UNIQUE INDEX IF NOT EXISTS idx_price_ingest_runs_run_key_unique ON public.price_ingest_runs(run_key) WHERE run_key IS NOT NULL`)
    await runSafe(client, 'idx_price_ingest_runs_pipeline_started', `CREATE INDEX IF NOT EXISTS idx_price_ingest_runs_pipeline_started ON public.price_ingest_runs(pipeline_name, started_at)`)
    await runSafe(client, 'idx_price_history_source_listing_unique', `CREATE UNIQUE INDEX IF NOT EXISTS idx_price_history_source_listing_unique ON public.price_history(source_id, listing_reference) WHERE source_id IS NOT NULL AND listing_reference IS NOT NULL`)

    // ─── Verify ───────────────────────────────────────────────────────
    console.log('\n[verify] Checking price_sources count…')
    const { rows: countRows } = await client.query('SELECT COUNT(*) AS n FROM public.price_sources')
    console.log(`  price_sources rows: ${countRows[0].n}`)

    console.log('\n✅ Migrations 014 + 015 applied successfully.')
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error('[FATAL]', err.message)
  process.exitCode = 1
})
