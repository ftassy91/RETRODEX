'use strict'

const fs = require('fs')
const path = require('path')

const { QueryTypes } = require('sequelize')

const { sequelize } = require('../src/database')
const Game = require('../src/models/Game')
const Console = require('../src/models/Console')
const { runMigrations } = require('../src/services/migration-runner')
const { getSourcePolicy, normalizeSourceKey } = require('../src/config/source-policy')

function parseArgs(argv) {
  return argv.reduce((acc, token) => {
    const [key, rawValue] = token.split('=')
    const normalizedKey = key.replace(/^--/, '')
    acc[normalizedKey] = rawValue == null ? true : rawValue
    return acc
  }, {})
}

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function makeGameId(title, platform, year) {
  const base = [title, platform].map(normalizeText).filter(Boolean).join('-')
  return year ? `${base}-${year}` : base
}

function ensureIntegerYear(value) {
  const year = Number.parseInt(String(value || ''), 10)
  if (!Number.isInteger(year) || year < 1970 || year > 2035) {
    return null
  }
  return year
}

function loadJsonEntries(inputPath) {
  const resolved = path.resolve(process.cwd(), inputPath)
  const stats = fs.statSync(resolved)

  if (stats.isDirectory()) {
    return fs.readdirSync(resolved)
      .filter((fileName) => fileName.endsWith('.json'))
      .map((fileName) => JSON.parse(fs.readFileSync(path.join(resolved, fileName), 'utf8')))
  }

  const parsed = JSON.parse(fs.readFileSync(resolved, 'utf8'))
  return Array.isArray(parsed) ? parsed : [parsed]
}

async function createRunRecord(payload) {
  await sequelize.query(
    `INSERT INTO enrichment_runs (
      run_key,
      pipeline_name,
      mode,
      source_name,
      status,
      dry_run,
      started_at,
      notes
    ) VALUES (
      :runKey,
      :pipelineName,
      :mode,
      :sourceName,
      :status,
      :dryRun,
      :startedAt,
      :notes
    )`,
    {
      replacements: payload,
      type: QueryTypes.INSERT,
    }
  )
}

async function updateRunRecord(runKey, payload) {
  await sequelize.query(
    `UPDATE enrichment_runs
     SET status = :status,
         finished_at = :finishedAt,
         items_seen = :itemsSeen,
         items_created = :itemsCreated,
         items_updated = :itemsUpdated,
         items_skipped = :itemsSkipped,
         items_flagged = :itemsFlagged,
         error_count = :errorCount,
         notes = :notes
     WHERE run_key = :runKey`,
    {
      replacements: {
        runKey,
        ...payload,
      },
      type: QueryTypes.UPDATE,
    }
  )
}

async function upsertSourceRecord(gameId, sourceName) {
  await sequelize.query(
    `INSERT INTO source_records (
      entity_type,
      entity_id,
      field_name,
      source_name,
      source_type,
      compliance_status,
      ingested_at,
      confidence_level,
      notes
    ) VALUES (
      'game',
      :gameId,
      'identity',
      :sourceName,
      'catalog_import',
      :complianceStatus,
      :ingestedAt,
      :confidenceLevel,
      :notes
    )
    ON CONFLICT(entity_type, entity_id, field_name, source_name, source_type) DO UPDATE SET
      compliance_status = excluded.compliance_status,
      ingested_at = excluded.ingested_at,
      confidence_level = excluded.confidence_level,
      notes = excluded.notes`,
    {
      replacements: {
        gameId,
        sourceName,
        complianceStatus: getSourcePolicy(sourceName).status,
        ingestedAt: new Date().toISOString(),
        confidenceLevel: 0.8,
        notes: 'identity-first catalog import',
      },
      type: QueryTypes.INSERT,
    }
  )
}

function validateEntry(entry, expectedPlatform) {
  const title = String(entry.name || entry.title || '').trim()
  const platform = String(entry.platform || entry.console || '').trim()
  const year = ensureIntegerYear(entry.year || entry.release_year)

  const errors = []
  if (!title) errors.push('missing title')
  if (!platform) errors.push('missing platform')
  if (expectedPlatform && normalizeText(platform) !== normalizeText(expectedPlatform)) {
    errors.push('platform mismatch')
  }
  if (!year) errors.push('invalid year')

  return {
    title,
    platform,
    year,
    developer: String(entry.developer || '').trim() || null,
    genre: String(entry.genre || '').trim() || null,
    source: normalizeSourceKey(entry._source || entry.source || ''),
    errors,
  }
}

async function findExistingGame(normalized) {
  return Game.findOne({
    where: {
      title: normalized.title,
      console: normalized.platform,
      year: normalized.year,
      type: 'game',
    },
  })
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const input = args.input || 'data/raw/game'
  const platform = args.platform || ''
  const source = normalizeSourceKey(args.source || 'wikidata')
  const dryRun = args['dry-run'] !== 'false'
  const limit = args.limit ? Number.parseInt(String(args.limit), 10) : null
  const consoleId = args['console-id'] || null

  if (!platform) {
    throw new Error('Missing required --platform')
  }

  await runMigrations(sequelize)

  const sourcePolicy = getSourcePolicy(source)
  if (sourcePolicy.status === 'blocked') {
    throw new Error(`Source ${source} is blocked by policy`)
  }

  const runKey = `catalog:${normalizeText(platform)}:${Date.now()}`
  await createRunRecord({
    runKey,
    pipelineName: 'catalog-import',
    mode: 'identity-first',
    sourceName: source,
    status: 'running',
    dryRun: dryRun ? 1 : 0,
    startedAt: new Date().toISOString(),
    notes: `${platform} | ${input}`,
  })

  const stats = {
    status: 'completed',
    itemsSeen: 0,
    itemsCreated: 0,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    errorCount: 0,
    notes: '',
  }

  try {
    const consoleRecord = consoleId
      ? await Console.findOne({ where: { id: consoleId } })
      : await Console.findOne({ where: { name: platform } })

    const rawEntries = loadJsonEntries(input)
    const filteredEntries = rawEntries
      .filter((entry) => normalizeText(entry.platform || entry.console || '') === normalizeText(platform))

    const limitedEntries = limit ? filteredEntries.slice(0, limit) : filteredEntries
    const preview = []

    for (const rawEntry of limitedEntries) {
      stats.itemsSeen += 1
      const normalized = validateEntry(rawEntry, platform)

      if (normalized.errors.length) {
        stats.itemsFlagged += 1
        preview.push({ status: 'flagged', title: normalized.title || rawEntry.name || rawEntry.title || null, errors: normalized.errors })
        continue
      }

      const existing = await findExistingGame(normalized)
      const gameId = existing?.id || makeGameId(normalized.title, normalized.platform, normalized.year)
      preview.push({
        status: existing ? 'update' : 'create',
        id: gameId,
        title: normalized.title,
        platform: normalized.platform,
        year: normalized.year,
      })

      if (dryRun) {
        if (existing) stats.itemsUpdated += 1
        else stats.itemsCreated += 1
        continue
      }

      const payload = {
        id: gameId,
        title: normalized.title,
        console: normalized.platform,
        consoleId: consoleRecord?.id || null,
        year: normalized.year,
        developer: normalized.developer,
        genre: normalized.genre,
        type: 'game',
        source_confidence: 0.8,
      }

      if (existing) {
        await existing.update(payload)
        stats.itemsUpdated += 1
      } else {
        await Game.create(payload)
        stats.itemsCreated += 1
      }

      await upsertSourceRecord(gameId, source)
    }

    stats.notes = JSON.stringify({
      platform,
      source,
      input,
      preview: preview.slice(0, 20),
      dryRun,
    })
    await updateRunRecord(runKey, {
      ...stats,
      finishedAt: new Date().toISOString(),
    })

    console.log(JSON.stringify({
      ok: true,
      runKey,
      platform,
      source,
      dryRun,
      stats,
      sample: preview.slice(0, 20),
    }, null, 2))
  } catch (error) {
    stats.status = 'failed'
    stats.errorCount += 1
    stats.notes = error.message
    await updateRunRecord(runKey, {
      ...stats,
      finishedAt: new Date().toISOString(),
    })
    throw error
  }
}

main()
  .catch((error) => {
    console.error('[import-catalog]', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await sequelize.close()
  })
