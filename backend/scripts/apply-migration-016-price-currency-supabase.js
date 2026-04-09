#!/usr/bin/env node
'use strict'

/**
 * Migration 016: Add games.price_currency column.
 *
 * Represents the currency of the values persisted in games.loose_price,
 * games.cib_price, games.mint_price. Written by publishMarketSnapshot()
 * at pipeline publish time. NULL means no pipeline data has been published.
 *
 * Safe: uses IF NOT EXISTS / column-existence check.
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

async function columnExists(client, tableName, columnName) {
  const { rows } = await client.query(`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
  `, [tableName, columnName])
  return rows.length > 0
}

async function run() {
  const client = new Client(PG_CONFIG)
  await client.connect()
  console.log('[016] Connected to Supabase pg pooler')

  try {
    // Add price_currency to games table
    if (await columnExists(client, 'games', 'price_currency')) {
      console.log('[016] games.price_currency already exists — skipping')
    } else {
      await client.query(`
        ALTER TABLE public.games
        ADD COLUMN price_currency VARCHAR(8) NULL
      `)
      console.log('[016] Added games.price_currency VARCHAR(8) NULL')
    }

    // Backfill: games that already have price data from the pipeline get 'EUR'
    // (all Yahoo JP pipeline output is EUR-converted)
    const { rowCount } = await client.query(`
      UPDATE public.games
      SET price_currency = 'EUR'
      WHERE price_currency IS NULL
        AND price_confidence_tier IS NOT NULL
        AND (loose_price IS NOT NULL OR cib_price IS NOT NULL OR mint_price IS NOT NULL)
    `)
    console.log(`[016] Backfilled price_currency='EUR' on ${rowCount} games with existing pipeline data`)

    console.log('[016] Migration complete.')
  } finally {
    await client.end()
  }
}

run().catch((err) => {
  console.error('[016] Fatal error:', err)
  process.exit(1)
})
