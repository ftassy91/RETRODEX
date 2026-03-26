'use strict'

const crypto = require('crypto')

const { QueryTypes } = require('sequelize')

const { sequelize } = require('../src/database')
const Game = require('../src/models/Game')
const Console = require('../src/models/Console')
const { runMigrations } = require('../src/services/migration-runner')
const { getConsoleById } = require('../src/lib/consoles')
const { getSourcePolicy, normalizeSourceKey } = require('../src/config/source-policy')

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function hashValue(value) {
  return crypto.createHash('sha1').update(String(value || '')).digest('hex')
}

function parseArgs(argv) {
  return argv.reduce((acc, token) => {
    const [key, rawValue] = token.split('=')
    acc[key.replace(/^--/, '')] = rawValue == null ? true : rawValue
    return acc
  }, {})
}

function parseMaybeJson(value, fallback = null) {
  if (value == null || value === '') {
    return fallback
  }
  if (Array.isArray(value) || typeof value === 'object') {
    return value
  }
  if (typeof value !== 'string') {
    return fallback
  }
  try {
    return JSON.parse(value)
  } catch (_error) {
    return fallback
  }
}

function normalizeSourceName(value, fallback = 'internal') {
  const key = normalizeSourceKey(value)
  if (!key || key === 'seed_local' || key === 'legacy') {
    return fallback
  }
  return key
}

function normalizeComplianceStatus(sourceName) {
  const policy = getSourcePolicy(sourceName)
  if (policy.status === 'blocked') {
    return getSourcePolicy('internal').status
  }
  return policy.status
}

function sourceConfidenceFor(sourceName, fallback = 0.6) {
  const policy = getSourcePolicy(sourceName)
  if (policy.status === 'blocked') {
    return fallback
  }
  if (sourceName === 'igdb') return 0.8
  if (sourceName === 'internet_archive') return 0.65
  if (sourceName === 'ebay') return 0.85
  if (sourceName === 'pricecharting') return 0.75
  return Math.max(fallback, policy.legalFeasibility * 0.75)
}

function detectMediaSource(url) {
  const value = String(url || '')
  if (value.includes('igdb.com')) {
    return 'igdb'
  }
  if (value.includes('archive.org')) {
    return 'internet_archive'
  }
  return 'internal'
}

function normalizeCondition(value) {
  const key = String(value || '').trim().toLowerCase()
  if (key === 'mint') return 'Mint'
  if (key === 'cib') return 'CIB'
  return 'Loose'
}

function normalizeContributorRole(value, fallback = 'developer') {
  const key = String(value || fallback || '').trim().toLowerCase()
  if (!key) return 'developer'
  if (key.includes('composer') || key.includes('music') || key.includes('sound')) return 'composer'
  if (key.includes('director')) return 'director'
  if (key.includes('producer')) return 'producer'
  if (key.includes('artist') || key.includes('art')) return 'artist'
  return 'developer'
}

function parseContributors(value, fallbackRole = 'developer') {
  const parsed = parseMaybeJson(value)
  const rawItems = Array.isArray(parsed)
    ? parsed
    : typeof value === 'string'
      ? value.split(/[,\n;]/).map((item) => item.trim()).filter(Boolean)
      : []

  const entries = []
  for (const item of rawItems) {
    if (!item) continue
    if (typeof item === 'string') {
      entries.push({
        name: item,
        role: normalizeContributorRole(fallbackRole, fallbackRole),
      })
      continue
    }

    const name = String(item.name || item.person || item.value || '').trim()
    if (!name) continue
    entries.push({
      name,
      role: normalizeContributorRole(item.role || item.job || fallbackRole, fallbackRole),
    })
  }

  const deduped = new Map()
  for (const entry of entries) {
    const key = `${normalizeText(entry.name)}::${entry.role}`
    if (!deduped.has(key)) {
      deduped.set(key, entry)
    }
  }
  return Array.from(deduped.values())
}

function buildTrendSignal(rows) {
  const candidates = rows
    .filter((row) => Number(row.price) > 0)
    .sort((left, right) => String(left.sale_date || '').localeCompare(String(right.sale_date || '')))

  if (candidates.length < 4) {
    return 'stable'
  }

  const splitIndex = Math.floor(candidates.length / 2)
  const firstHalf = candidates.slice(0, splitIndex)
  const secondHalf = candidates.slice(splitIndex)
  const average = (values) => values.reduce((sum, row) => sum + Number(row.price || 0), 0) / Math.max(values.length, 1)
  const earlyAverage = average(firstHalf)
  const lateAverage = average(secondHalf)

  if (earlyAverage <= 0 || lateAverage <= 0) {
    return 'stable'
  }

  const delta = (lateAverage - earlyAverage) / earlyAverage
  if (delta >= 0.15) return 'up'
  if (delta <= -0.15) return 'down'
  return 'stable'
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

async function ensureSourceRecord({
  entityType,
  entityId,
  fieldName,
  sourceName,
  sourceType,
  sourceUrl = null,
  sourceLicense = null,
  confidenceLevel = 0.6,
  notes = null,
}) {
  const resolvedSourceName = normalizeSourceName(sourceName)
  const complianceStatus = normalizeComplianceStatus(resolvedSourceName)

  await sequelize.query(
    `INSERT INTO source_records (
      entity_type,
      entity_id,
      field_name,
      source_name,
      source_type,
      source_url,
      source_license,
      compliance_status,
      ingested_at,
      last_verified_at,
      confidence_level,
      notes
    ) VALUES (
      :entityType,
      :entityId,
      :fieldName,
      :sourceName,
      :sourceType,
      :sourceUrl,
      :sourceLicense,
      :complianceStatus,
      :ingestedAt,
      :lastVerifiedAt,
      :confidenceLevel,
      :notes
    )
    ON CONFLICT(entity_type, entity_id, field_name, source_name, source_type) DO UPDATE SET
      source_url = excluded.source_url,
      source_license = excluded.source_license,
      compliance_status = excluded.compliance_status,
      ingested_at = excluded.ingested_at,
      last_verified_at = excluded.last_verified_at,
      confidence_level = excluded.confidence_level,
      notes = excluded.notes`,
    {
      replacements: {
        entityType,
        entityId,
        fieldName,
        sourceName: resolvedSourceName,
        sourceType,
        sourceUrl,
        sourceLicense,
        complianceStatus,
        ingestedAt: new Date().toISOString(),
        lastVerifiedAt: new Date().toISOString(),
        confidenceLevel,
        notes,
      },
      type: QueryTypes.INSERT,
    }
  )

  const [row] = await sequelize.query(
    `SELECT id
     FROM source_records
     WHERE entity_type = :entityType
       AND entity_id = :entityId
       AND field_name = :fieldName
       AND source_name = :sourceName
       AND source_type = :sourceType
     LIMIT 1`,
    {
      replacements: {
        entityType,
        entityId,
        fieldName,
        sourceName: resolvedSourceName,
        sourceType,
      },
      type: QueryTypes.SELECT,
    }
  )

  return row?.id || null
}

async function upsertFieldProvenance({
  entityType,
  entityId,
  fieldName,
  sourceRecordId,
  value,
  isInferred = 0,
  confidenceLevel = 0.6,
}) {
  await sequelize.query(
    `INSERT INTO field_provenance (
      entity_type,
      entity_id,
      field_name,
      source_record_id,
      value_hash,
      is_inferred,
      confidence_level,
      verified_at
    ) VALUES (
      :entityType,
      :entityId,
      :fieldName,
      :sourceRecordId,
      :valueHash,
      :isInferred,
      :confidenceLevel,
      :verifiedAt
    )
    ON CONFLICT(entity_type, entity_id, field_name) DO UPDATE SET
      source_record_id = excluded.source_record_id,
      value_hash = excluded.value_hash,
      is_inferred = excluded.is_inferred,
      confidence_level = excluded.confidence_level,
      verified_at = excluded.verified_at`,
    {
      replacements: {
        entityType,
        entityId,
        fieldName,
        sourceRecordId,
        valueHash: hashValue(value),
        isInferred,
        confidenceLevel,
        verifiedAt: new Date().toISOString(),
      },
      type: QueryTypes.INSERT,
    }
  )
}

async function upsertRelease(game) {
  await sequelize.query(
    `INSERT INTO releases (
      id,
      game_id,
      console_id,
      region_code,
      edition_name,
      release_year,
      release_date,
      release_identity,
      created_at,
      updated_at
    ) VALUES (
      :id,
      :gameId,
      :consoleId,
      NULL,
      'default',
      :releaseYear,
      :releaseDate,
      :releaseIdentity,
      :createdAt,
      :updatedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      console_id = excluded.console_id,
      release_year = excluded.release_year,
      release_date = excluded.release_date,
      release_identity = excluded.release_identity,
      updated_at = excluded.updated_at`,
    {
      replacements: {
        id: `release:${game.id}:default`,
        gameId: game.id,
        consoleId: game.consoleId || null,
        releaseYear: game.year || null,
        releaseDate: game.releaseDate || null,
        releaseIdentity: `${game.id}:default`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      type: QueryTypes.INSERT,
    }
  )
}

async function upsertGameEditorial(game) {
  const hasEditorial = Boolean(
    game.summary
      || game.synopsis
      || game.lore
      || game.dev_anecdotes
      || game.cheat_codes
      || game.characters
      || game.gameplay_description
  )

  if (!hasEditorial) {
    return false
  }

  await sequelize.query(
    `INSERT INTO game_editorial (
      game_id,
      summary,
      synopsis,
      lore,
      dev_notes,
      cheat_codes,
      characters,
      gameplay_description,
      created_at,
      updated_at
    ) VALUES (
      :gameId,
      :summary,
      :synopsis,
      :lore,
      :devNotes,
      :cheatCodes,
      :characters,
      :gameplayDescription,
      :createdAt,
      :updatedAt
    )
    ON CONFLICT(game_id) DO UPDATE SET
      summary = excluded.summary,
      synopsis = excluded.synopsis,
      lore = excluded.lore,
      dev_notes = excluded.dev_notes,
      cheat_codes = excluded.cheat_codes,
      characters = excluded.characters,
      gameplay_description = excluded.gameplay_description,
      updated_at = excluded.updated_at`,
    {
      replacements: {
        gameId: game.id,
        summary: game.summary || null,
        synopsis: game.synopsis || null,
        lore: game.lore || null,
        devNotes: game.dev_anecdotes || null,
        cheatCodes: game.cheat_codes || null,
        characters: game.characters || null,
        gameplayDescription: game.gameplay_description || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      type: QueryTypes.INSERT,
    }
  )

  return true
}

async function ensurePerson(name, role, sourceRecordId) {
  const personId = `person:${normalizeText(name)}`
  await sequelize.query(
    `INSERT INTO people (
      id,
      name,
      normalized_name,
      primary_role,
      source_record_id,
      created_at,
      updated_at
    ) VALUES (
      :id,
      :name,
      :normalizedName,
      :primaryRole,
      :sourceRecordId,
      :createdAt,
      :updatedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      normalized_name = excluded.normalized_name,
      primary_role = COALESCE(people.primary_role, excluded.primary_role),
      source_record_id = COALESCE(people.source_record_id, excluded.source_record_id),
      updated_at = excluded.updated_at`,
    {
      replacements: {
        id: personId,
        name,
        normalizedName: normalizeText(name),
        primaryRole: role,
        sourceRecordId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      type: QueryTypes.INSERT,
    }
  )
  return personId
}

async function upsertGamePerson(gameId, personId, role, billingOrder, sourceRecordId, confidence) {
  await sequelize.query(
    `INSERT INTO game_people (
      game_id,
      person_id,
      role,
      billing_order,
      source_record_id,
      confidence,
      is_inferred
    ) VALUES (
      :gameId,
      :personId,
      :role,
      :billingOrder,
      :sourceRecordId,
      :confidence,
      0
    )
    ON CONFLICT(game_id, person_id, role) DO UPDATE SET
      billing_order = excluded.billing_order,
      source_record_id = excluded.source_record_id,
      confidence = excluded.confidence`,
    {
      replacements: {
        gameId,
        personId,
        role,
        billingOrder,
        sourceRecordId,
        confidence,
      },
      type: QueryTypes.INSERT,
    }
  )
}

async function upsertGameCompany(gameId, companyId, role, sourceRecordId, confidence) {
  if (!companyId) {
    return
  }

  await sequelize.query(
    `INSERT INTO game_companies (
      game_id,
      company_id,
      role,
      source_record_id,
      confidence,
      is_inferred
    ) VALUES (
      :gameId,
      :companyId,
      :role,
      :sourceRecordId,
      :confidence,
      0
    )
    ON CONFLICT(game_id, company_id, role) DO UPDATE SET
      source_record_id = excluded.source_record_id,
      confidence = excluded.confidence`,
    {
      replacements: {
        gameId,
        companyId,
        role,
        sourceRecordId,
        confidence,
      },
      type: QueryTypes.INSERT,
    }
  )
}

async function upsertMediaReference(gameId, mediaType, url, sourceRecordId) {
  if (!url) {
    return false
  }

  const sourceName = detectMediaSource(url)
  await sequelize.query(
    `INSERT INTO media_references (
      entity_type,
      entity_id,
      media_type,
      url,
      provider,
      compliance_status,
      storage_mode,
      source_record_id,
      created_at,
      updated_at
    ) VALUES (
      'game',
      :gameId,
      :mediaType,
      :url,
      :provider,
      :complianceStatus,
      'external_reference',
      :sourceRecordId,
      :createdAt,
      :updatedAt
    )
    ON CONFLICT(entity_type, entity_id, media_type, url) DO UPDATE SET
      provider = excluded.provider,
      compliance_status = excluded.compliance_status,
      source_record_id = excluded.source_record_id,
      updated_at = excluded.updated_at`,
    {
      replacements: {
        gameId,
        mediaType,
        url,
        provider: sourceName,
        complianceStatus: normalizeComplianceStatus(sourceName),
        sourceRecordId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      type: QueryTypes.INSERT,
    }
  )

  return true
}

async function insertPriceObservation(row) {
  const sourceName = normalizeSourceName(row.source)
  const listingReference = row.ebay_item_id
    ? `ebay:${row.ebay_item_id}`
    : `price_history:${row.id}`

  await sequelize.query(
    `INSERT OR IGNORE INTO price_observations (
      game_id,
      edition_id,
      condition,
      price,
      currency,
      observed_at,
      source_name,
      listing_reference,
      listing_url,
      confidence,
      is_verified,
      raw_payload
    ) VALUES (
      :gameId,
      NULL,
      :condition,
      :price,
      'USD',
      :observedAt,
      :sourceName,
      :listingReference,
      :listingUrl,
      :confidence,
      :isVerified,
      :rawPayload
    )`,
    {
      replacements: {
        gameId: row.game_id,
        condition: normalizeCondition(row.condition),
        price: Number(row.price || 0),
        observedAt: row.sale_date || row.created_at || new Date().toISOString(),
        sourceName,
        listingReference,
        listingUrl: row.listing_url || null,
        confidence: sourceConfidenceFor(sourceName, 0.6),
        isVerified: sourceName === 'ebay' ? 1 : 0,
        rawPayload: JSON.stringify({
          legacyPriceHistoryId: row.id,
          legacySource: row.source,
          legacyListingTitle: row.listing_title || null,
        }),
      },
      type: QueryTypes.INSERT,
    }
  )
}

async function upsertMarketSnapshot(game, historyRows) {
  const prices = {
    loosePrice: Number(game.loosePrice || 0) > 0 ? Number(game.loosePrice) : null,
    cibPrice: Number(game.cibPrice || 0) > 0 ? Number(game.cibPrice) : null,
    mintPrice: Number(game.mintPrice || 0) > 0 ? Number(game.mintPrice) : null,
  }
  const observationCount = historyRows.length
  const lastObservedAt = historyRows
    .map((row) => row.sale_date || row.created_at)
    .filter(Boolean)
    .sort((left, right) => String(right).localeCompare(String(left)))[0] || null
  const distinctSources = Array.from(new Set(historyRows.map((row) => normalizeSourceName(row.source))))
  const sourceCoverage = distinctSources.length || (
    prices.loosePrice || prices.cibPrice || prices.mintPrice ? 1 : 0
  )
  const trendSignal = buildTrendSignal(historyRows)
  const confidenceScore = observationCount >= 12 ? 0.85 : observationCount >= 4 ? 0.7 : observationCount > 0 ? 0.55 : 0.45

  await sequelize.query(
    `INSERT INTO market_snapshots (
      game_id,
      loose_price,
      cib_price,
      mint_price,
      observation_count,
      last_observed_at,
      trend_signal,
      confidence_score,
      source_coverage,
      computed_at
    ) VALUES (
      :gameId,
      :loosePrice,
      :cibPrice,
      :mintPrice,
      :observationCount,
      :lastObservedAt,
      :trendSignal,
      :confidenceScore,
      :sourceCoverage,
      :computedAt
    )
    ON CONFLICT(game_id) DO UPDATE SET
      loose_price = excluded.loose_price,
      cib_price = excluded.cib_price,
      mint_price = excluded.mint_price,
      observation_count = excluded.observation_count,
      last_observed_at = excluded.last_observed_at,
      trend_signal = excluded.trend_signal,
      confidence_score = excluded.confidence_score,
      source_coverage = excluded.source_coverage,
      computed_at = excluded.computed_at`,
    {
      replacements: {
        gameId: game.id,
        loosePrice: prices.loosePrice,
        cibPrice: prices.cibPrice,
        mintPrice: prices.mintPrice,
        observationCount,
        lastObservedAt,
        trendSignal,
        confidenceScore,
        sourceCoverage,
        computedAt: new Date().toISOString(),
      },
      type: QueryTypes.INSERT,
    }
  )

  return {
    observationCount,
    lastObservedAt,
    trendSignal,
    sourceCoverage,
    hasPrices: Boolean(prices.loosePrice || prices.cibPrice || prices.mintPrice),
  }
}

async function backfillGame(game, historyRows, stats) {
  await upsertRelease(game)
  stats.itemsUpdated += 1

  const confidenceLevel = Math.max(Number(game.source_confidence || 0), 0.55)
  const identitySourceRecordId = await ensureSourceRecord({
    entityType: 'game',
    entityId: game.id,
    fieldName: 'identity',
    sourceName: 'internal',
    sourceType: 'legacy_backfill',
    confidenceLevel,
    notes: 'Backfilled from legacy games read-model; upstream source unresolved in v1 dataset.',
  })

  for (const fieldName of ['title', 'console', 'year', 'slug']) {
    if (game[fieldName] != null && game[fieldName] !== '') {
      await upsertFieldProvenance({
        entityType: 'game',
        entityId: game.id,
        fieldName,
        sourceRecordId: identitySourceRecordId,
        value: game[fieldName],
        confidenceLevel,
      })
    }
  }

  const hasEditorial = await upsertGameEditorial(game)
  if (hasEditorial) {
    const editorialSourceRecordId = await ensureSourceRecord({
      entityType: 'game',
      entityId: game.id,
      fieldName: 'editorial',
      sourceName: 'internal',
      sourceType: 'legacy_backfill',
      confidenceLevel,
      notes: 'Canonical editorial layer derived from legacy game columns.',
    })

    for (const [fieldName, value] of [
      ['summary', game.summary],
      ['synopsis', game.synopsis],
      ['lore', game.lore],
      ['dev_notes', game.dev_anecdotes],
      ['cheat_codes', game.cheat_codes],
      ['characters', game.characters],
      ['gameplay_description', game.gameplay_description],
    ]) {
      if (value) {
        await upsertFieldProvenance({
          entityType: 'game',
          entityId: game.id,
          fieldName,
          sourceRecordId: editorialSourceRecordId,
          value,
          confidenceLevel,
        })
      }
    }

    const contributors = [
      ...parseContributors(game.dev_team, 'developer'),
      ...(game.developer ? [{ name: game.developer, role: 'developer' }] : []),
      ...parseContributors(game.ost_composers, 'composer'),
    ]
    const uniqueContributors = new Map()
    for (const contributor of contributors) {
      const key = `${normalizeText(contributor.name)}::${contributor.role}`
      if (!uniqueContributors.has(key)) {
        uniqueContributors.set(key, contributor)
      }
    }

    let billingOrder = 0
    for (const contributor of uniqueContributors.values()) {
      billingOrder += 1
      const personId = await ensurePerson(contributor.name, contributor.role, editorialSourceRecordId)
      await upsertGamePerson(
        game.id,
        personId,
        contributor.role,
        billingOrder,
        editorialSourceRecordId,
        confidenceLevel
      )
    }
  }

  if (game.developerId) {
    await upsertGameCompany(game.id, game.developerId, 'developer', identitySourceRecordId, confidenceLevel)
  }
  if (game.publisherId) {
    await upsertGameCompany(game.id, game.publisherId, 'publisher', identitySourceRecordId, confidenceLevel)
  }

  for (const [mediaType, url, fieldName] of [
    ['cover', game.cover_url || game.coverImage || null, 'cover_image'],
    ['manual', game.manual_url || null, 'manual_reference'],
  ]) {
    if (!url) continue
    const mediaSourceName = detectMediaSource(url)
    const mediaSourceRecordId = await ensureSourceRecord({
      entityType: 'game',
      entityId: game.id,
      fieldName,
      sourceName: mediaSourceName,
      sourceType: 'external_reference',
      sourceUrl: url,
      confidenceLevel: sourceConfidenceFor(mediaSourceName, 0.6),
      notes: 'External reference preserved; asset not stored locally.',
    })
    await upsertMediaReference(game.id, mediaType, url, mediaSourceRecordId)
    await upsertFieldProvenance({
      entityType: 'game',
      entityId: game.id,
      fieldName,
      sourceRecordId: mediaSourceRecordId,
      value: url,
      confidenceLevel: sourceConfidenceFor(mediaSourceName, 0.6),
    })
  }

  for (const row of historyRows) {
    await insertPriceObservation(row)
  }

  const snapshot = await upsertMarketSnapshot(game, historyRows)
  if (snapshot.hasPrices || snapshot.observationCount > 0) {
    const marketSourceRecordId = await ensureSourceRecord({
      entityType: 'game',
      entityId: game.id,
      fieldName: 'market_snapshot',
      sourceName: 'internal',
      sourceType: 'derived_backfill',
      confidenceLevel: snapshot.observationCount >= 4 ? 0.75 : 0.55,
      notes: `Derived canonical market snapshot from legacy prices and ${snapshot.observationCount} historical observations.`,
    })

    for (const fieldName of ['loosePrice', 'cibPrice', 'mintPrice']) {
      if (game[fieldName] != null && Number(game[fieldName]) > 0) {
        await upsertFieldProvenance({
          entityType: 'game',
          entityId: game.id,
          fieldName,
          sourceRecordId: marketSourceRecordId,
          value: game[fieldName],
          confidenceLevel: snapshot.observationCount >= 4 ? 0.75 : 0.55,
        })
      }
    }
  }
}

async function backfillConsoles(stats) {
  const consoles = await Console.findAll({
    attributes: ['id', 'name', 'manufacturer', 'releaseYear', 'slug'],
  })

  for (const record of consoles) {
    const consoleItem = record.get({ plain: true })
    const knowledge = getConsoleById(consoleItem.id) || getConsoleById(consoleItem.slug) || getConsoleById(consoleItem.name)
    const sourceRecordId = await ensureSourceRecord({
      entityType: 'console',
      entityId: consoleItem.id,
      fieldName: 'identity',
      sourceName: 'internal',
      sourceType: 'knowledge_registry',
      confidenceLevel: 0.8,
      notes: knowledge ? 'Console identity aligned with versioned local console registry.' : 'Console identity from primary consoles table.',
    })

    for (const [fieldName, value] of [
      ['name', consoleItem.name],
      ['manufacturer', consoleItem.manufacturer],
      ['releaseYear', consoleItem.releaseYear],
      ['slug', consoleItem.slug],
    ]) {
      if (!value) continue
      await upsertFieldProvenance({
        entityType: 'console',
        entityId: consoleItem.id,
        fieldName,
        sourceRecordId,
        value,
        confidenceLevel: 0.8,
      })
    }

    if (knowledge?.overview) {
      const overviewSourceRecordId = await ensureSourceRecord({
        entityType: 'console',
        entityId: consoleItem.id,
        fieldName: 'overview',
        sourceName: 'internal',
        sourceType: 'knowledge_registry',
        confidenceLevel: 0.75,
        notes: 'Overview sourced from versioned local console registry.',
      })
      await upsertFieldProvenance({
        entityType: 'console',
        entityId: consoleItem.id,
        fieldName: 'overview',
        sourceRecordId: overviewSourceRecordId,
        value: knowledge.overview,
        confidenceLevel: 0.75,
      })
    }

    stats.consoleRecordsTouched += 1
  }
}

async function loadPriceHistoryMap() {
  const rows = await sequelize.query(
    `SELECT id, game_id, price, condition, sale_date, source, listing_url, ebay_item_id, listing_title, created_at
     FROM price_history
     ORDER BY game_id ASC, sale_date ASC, id ASC`,
    { type: QueryTypes.SELECT }
  ).catch(() => [])

  const map = new Map()
  for (const row of rows) {
    const key = String(row.game_id)
    if (!map.has(key)) {
      map.set(key, [])
    }
    map.get(key).push(row)
  }
  return map
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const dryRun = args['dry-run'] === 'true'

  await runMigrations(sequelize)

  const runKey = `backfill:canonical:${Date.now()}`
  await createRunRecord({
    runKey,
    pipelineName: 'canonical-backfill',
    mode: 'legacy-to-canonical',
    sourceName: 'internal',
    status: 'running',
    dryRun: dryRun ? 1 : 0,
    startedAt: new Date().toISOString(),
    notes: 'Legacy games/consoles to canonical provenance, editorial, market and media layers',
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
    observationsCreated: 0,
    consoleRecordsTouched: 0,
  }

  try {
    if (dryRun) {
      const [gamesCountRow, consolesCountRow, historyCountRow] = await Promise.all([
        sequelize.query(`SELECT COUNT(*) AS count FROM games WHERE type = 'game'`, { type: QueryTypes.SELECT }),
        sequelize.query(`SELECT COUNT(*) AS count FROM consoles`, { type: QueryTypes.SELECT }),
        sequelize.query(`SELECT COUNT(*) AS count FROM price_history`, { type: QueryTypes.SELECT }).catch(() => [{ count: 0 }]),
      ])

      stats.itemsSeen = Number(gamesCountRow[0]?.count || 0)
      stats.notes = JSON.stringify({
        dryRun,
        games: stats.itemsSeen,
        consoles: Number(consolesCountRow[0]?.count || 0),
        priceHistoryRows: Number(historyCountRow[0]?.count || 0),
      })
      await updateRunRecord(runKey, {
        ...stats,
        finishedAt: new Date().toISOString(),
      })
      console.log(JSON.stringify({ ok: true, runKey, dryRun, stats }, null, 2))
      return
    }

    const [games, historyMap, beforeObservationRows] = await Promise.all([
      Game.findAll({
        where: { type: 'game' },
        attributes: [
          'id',
          'title',
          'console',
          'consoleId',
          'year',
          'slug',
          'source_confidence',
          'releaseDate',
          'developer',
          'developerId',
          'publisherId',
          'summary',
          'synopsis',
          'lore',
          'dev_anecdotes',
          'dev_team',
          'ost_composers',
          'cheat_codes',
          'characters',
          'gameplay_description',
          'cover_url',
          'coverImage',
          'manual_url',
          'loosePrice',
          'cibPrice',
          'mintPrice',
        ],
      }),
      loadPriceHistoryMap(),
      sequelize.query(`SELECT COUNT(*) AS count FROM price_observations`, { type: QueryTypes.SELECT }),
    ])

    for (const record of games) {
      const game = record.get({ plain: true })
      stats.itemsSeen += 1
      await backfillGame(game, historyMap.get(String(game.id)) || [], stats)
    }

    await backfillConsoles(stats)

    const [afterObservationRows] = await sequelize.query(
      `SELECT COUNT(*) AS count FROM price_observations`,
      { type: QueryTypes.SELECT }
    )
    stats.observationsCreated = Math.max(
      0,
      Number(afterObservationRows?.count || 0) - Number(beforeObservationRows[0]?.count || 0)
    )

    stats.notes = JSON.stringify({
      gamesProcessed: stats.itemsSeen,
      observationsCreated: stats.observationsCreated,
      consolesTouched: stats.consoleRecordsTouched,
    })
    await updateRunRecord(runKey, {
      ...stats,
      finishedAt: new Date().toISOString(),
    })

    console.log(JSON.stringify({
      ok: true,
      runKey,
      dryRun,
      stats,
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
    console.error('[backfill-canonical]', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await sequelize.close()
  })
