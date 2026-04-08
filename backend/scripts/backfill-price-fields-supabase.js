'use strict'

const path = require('path')
const dotenv = require('dotenv')
const { Client } = require('pg')

dotenv.config({ path: path.join(__dirname, '..', '.env') })

const APPLY = process.argv.includes('--apply')

function getPoolerConfig() {
  const rawUrl = process.env.SUPABASE_Project_URL || process.env.DATABASE_URL || ''
  const projectMatch = String(rawUrl).match(/([a-z0-9]{20})/i)
  const passwordMatch = String(rawUrl).match(/postgres(?:\.[^:]+)?:\[?([^\]@]+)\]?@/i)

  if (!projectMatch || !passwordMatch) {
    throw new Error('Missing Supabase pooler credentials. Expected SUPABASE_Project_URL or DATABASE_URL in backend/.env.')
  }

  return {
    host: 'aws-1-eu-west-1.pooler.supabase.com',
    port: 6543,
    user: `postgres.${projectMatch[1]}`,
    password: passwordMatch[1],
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
  }
}

const SOURCE_CASE_SQL = `
  case lower(btrim(coalesce(ph.source, '')))
    when 'pricecharting' then 'PriceCharting'
    when 'ebay' then 'eBay'
    when 'moby' then 'MobyGames'
    when 'mobygames' then 'MobyGames'
    when 'igdb' then 'IGDB'
    when 'vgpc' then 'VGPC'
    else nullif(btrim(ph.source), '')
  end
`

async function readSummary(client) {
  const { rows } = await client.query(`
    with price_agg as (
      select
        ph.game_id,
        max(ph.sale_date)::date as latest_sale_date,
        string_agg(distinct ${SOURCE_CASE_SQL}, ', ' order by ${SOURCE_CASE_SQL}) as source_names
      from public.price_history ph
      where ph.game_id is not null
      group by ph.game_id
    )
    select
      (select count(*)::int from public.games) as total_games,
      (select count(*)::int from public.price_history) as total_price_history,
      (select count(*)::int from price_agg) as priced_games,
      (
        select count(*)::int
        from public.games g
        join price_agg pa on pa.game_id = g.id
        where (g.source_names is null or btrim(g.source_names) = '')
           or g.price_last_updated is null
      ) as pending_updates,
      (
        select count(*)::int
        from public.games
        where source_names is not null and btrim(source_names) <> ''
      ) as games_with_source_names,
      (
        select count(*)::int
        from public.games
        where price_last_updated is not null
      ) as games_with_price_last_updated
  `)

  return rows[0]
}

async function readSamples(client, limit = 10) {
  const { rows } = await client.query(`
    with price_agg as (
      select
        ph.game_id,
        max(ph.sale_date)::date as latest_sale_date,
        string_agg(distinct ${SOURCE_CASE_SQL}, ', ' order by ${SOURCE_CASE_SQL}) as source_names
      from public.price_history ph
      where ph.game_id is not null
      group by ph.game_id
    )
    select
      g.id,
      g.title,
      g.source_names as current_source_names,
      g.price_last_updated as current_price_last_updated,
      pa.source_names as next_source_names,
      pa.latest_sale_date as next_price_last_updated
    from public.games g
    join price_agg pa on pa.game_id = g.id
    where (g.source_names is null or btrim(g.source_names) = '')
       or g.price_last_updated is null
    order by g.title asc
    limit $1
  `, [limit])

  return rows
}

async function applyBackfill(client) {
  const { rows } = await client.query(`
    with price_agg as (
      select
        ph.game_id,
        max(ph.sale_date)::date as latest_sale_date,
        string_agg(distinct ${SOURCE_CASE_SQL}, ', ' order by ${SOURCE_CASE_SQL}) as source_names
      from public.price_history ph
      where ph.game_id is not null
      group by ph.game_id
    ),
    updated as (
      update public.games g
      set
        source_names = case
          when g.source_names is null or btrim(g.source_names) = '' then pa.source_names
          else g.source_names
        end,
        price_last_updated = coalesce(g.price_last_updated, pa.latest_sale_date)
      from price_agg pa
      where pa.game_id = g.id
        and (
          (g.source_names is null or btrim(g.source_names) = '')
          or g.price_last_updated is null
        )
      returning g.id
    )
    select count(*)::int as updated_rows from updated
  `)

  return Number(rows[0]?.updated_rows || 0)
}

async function main() {
  const client = new Client(getPoolerConfig())
  await client.connect()

  try {
    const before = await readSummary(client)
    const samples = await readSamples(client, 12)

    console.log(JSON.stringify({
      mode: APPLY ? 'apply' : 'plan',
      before,
      sample: samples,
    }, null, 2))

    if (!APPLY) {
      return
    }

    const updatedRows = await applyBackfill(client)
    const after = await readSummary(client)

    console.log(JSON.stringify({
      mode: 'apply',
      updatedRows,
      after,
    }, null, 2))
  } finally {
    await client.end().catch(() => {})
  }
}

main().catch((error) => {
  console.error('[backfill-price-fields-supabase] Failed:', error && error.stack ? error.stack : error)
  process.exitCode = 1
})
