'use strict'

const fs = require('fs')
const path = require('path')
const dotenv = require('dotenv')
const { Client } = require('pg')

const {
  RULES_VERSION,
  normalizeSql,
  buildStatusPreviewSql,
  buildStatusApplySql,
  buildRulesDocFragment,
} = require('./lib/games-status-rules')

dotenv.config({ path: path.join(__dirname, '..', '.env') })

const PREVIEW_PATH = path.join(__dirname, '..', 'migrations', '_pending_review', '20260331_009_games_status_backfill_preview.sql')
const APPLY_PATH = path.join(__dirname, '..', 'migrations', '_pending_review', '20260331_010_games_status_backfill_apply.sql')
const PHASE3_DOC_PATH = path.join(__dirname, '..', '..', 'docs', 'PHASE3_DB_READINESS.md')

function parseProjectReference() {
  const raw =
    process.env.SUPABASE_URL
    || process.env.SUPABASE_Project_URL
    || process.env.SUPERDATA_Project_URL
    || ''
  const match = String(raw).match(/doipqgkhfzqvmzrdfvuq|([a-z0-9]{20})/i)
  return match ? String(match[0]) : ''
}

function buildRemotePgConfig() {
  const projectReference = parseProjectReference()
  const rawUrl = process.env.SUPABASE_Project_URL || process.env.DATABASE_URL || ''
  let password = ''

  const passwordMatch = rawUrl.match(/postgres(?:\.[^:]+)?:\[?([^\]@]+)\]?@/i)
  if (passwordMatch) {
    password = passwordMatch[1]
  }

  if (!projectReference || !password) {
    throw new Error('Missing Supabase pooler configuration. Expected project ref and password in backend/.env.')
  }

  return {
    host: 'aws-1-eu-west-1.pooler.supabase.com',
    port: 6543,
    user: `postgres.${projectReference}`,
    password,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
  }
}

function readNormalizedFile(filePath) {
  return normalizeSql(fs.readFileSync(filePath, 'utf8'))
}

async function fetchVerifiedColumns(client) {
  const result = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'games'
      AND column_name IN (
        'youtube_id', 'youtube_verified', 'archive_id', 'archive_verified',
        'editorial_status', 'media_status', 'price_status'
      )
    ORDER BY column_name
  `)

  return result.rows
}

async function runPreview(client, previewSql) {
  const result = await client.query(previewSql)
  if (!result.rows.length || !result.rows[0].report) {
    throw new Error('Preview SQL did not return a report payload.')
  }
  return result.rows[0].report
}

async function main() {
  const expectedPreviewSql = normalizeSql(buildStatusPreviewSql())
  const expectedApplySql = normalizeSql(buildStatusApplySql())
  const previewFileSql = readNormalizedFile(PREVIEW_PATH)
  const applyFileSql = readNormalizedFile(APPLY_PATH)
  const phase3Doc = fs.readFileSync(PHASE3_DOC_PATH, 'utf8')
  const docFragment = buildRulesDocFragment()

  const client = new Client(buildRemotePgConfig())
  await client.connect()

  try {
    const verifiedColumns = await fetchVerifiedColumns(client)
    const report = await runPreview(client, previewFileSql)

    const validations = {
      rulesVersion: report.rulesVersion === RULES_VERSION,
      previewSqlMatchesCanonical: previewFileSql === expectedPreviewSql,
      applySqlMatchesCanonical: applyFileSql === expectedApplySql,
      documentationContainsCanonicalRules: phase3Doc.includes(docFragment),
      allGamesHaveDerivedStatuses: report.allGamesHaveDerivedStatuses === true,
      missingDerivedCountIsZero: Number(report.missingDerivedCount || 0) === 0,
    }

    const payload = {
      verifiedColumns,
      totalGamesAudited: report.totalGamesAudited,
      derivedCounts: report.derivedCounts,
      storedCounts: report.storedCounts,
      divergenceCounts: report.divergenceCounts,
      missingDerivedCount: report.missingDerivedCount,
      divergenceSamples: report.divergenceSamples,
      allGamesHaveDerivedStatuses: report.allGamesHaveDerivedStatuses,
      validations,
    }

    console.log(JSON.stringify(payload, null, 2))

    if (!Object.values(validations).every(Boolean)) {
      process.exitCode = 1
    }
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error))
  process.exit(1)
})
