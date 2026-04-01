'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')
const { getSourcePolicy } = require('../../src/config/source-policy')

const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

function nowIso() {
  return new Date().toISOString()
}

function hashValue(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex')
}

function normalizeString(value, fallback = '') {
  if (value == null) return fallback
  const text = String(value).trim()
  return text || fallback
}

function normalizeNullableString(value) {
  const normalized = normalizeString(value, '')
  return normalized || null
}

function normalizeNumeric(value) {
  if (value === null || value === undefined || value === '') return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function stringifyJson(value) {
  return value == null ? null : JSON.stringify(value)
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizeDirection(value) {
  const normalized = normalizeString(value, '').toLowerCase()
  if (['asc', 'ascending', 'low', 'lower', 'time'].includes(normalized)) return 'asc'
  if (['desc', 'descending', 'high', 'higher', 'score'].includes(normalized)) return 'desc'
  return 'asc'
}

function normalizeMetricType(value) {
  const normalized = normalizeString(value, '').toLowerCase()
  if (!normalized) return 'time'
  if (normalized.includes('score')) return 'score'
  if (normalized.includes('time')) return 'time'
  return normalized
}

function buildCategoryId(gameId, category) {
  const key = slugify(category.categoryKey || category.label || 'record')
  return normalizeString(category.id, '') || `recordcat:${gameId}:${key || 'record'}`
}

function buildEntryId(gameId, categoryId, entry) {
  const base = slugify(entry.playerHandle || entry.scoreDisplay || `${entry.rankPosition || 'x'}`)
  return normalizeString(entry.id, '') || `recordentry:${gameId}:${slugify(categoryId)}:${entry.rankPosition || 'x'}:${base || 'entry'}`
}

function normalizeProjection(primaryProjection, fallback = {}) {
  if (!primaryProjection || typeof primaryProjection !== 'object') {
    return null
  }

  const value = normalizeString(primaryProjection.value || primaryProjection.time || primaryProjection.scoreDisplay, '')
  if (!value) return null

  const metricType = normalizeMetricType(primaryProjection.metricType || fallback.metricType)
  return {
    category: normalizeString(primaryProjection.category || primaryProjection.label, ''),
    value,
    time: metricType === 'time' ? value : normalizeNullableString(primaryProjection.time),
    runner: normalizeString(primaryProjection.runner || primaryProjection.playerHandle, ''),
    source: normalizeString(primaryProjection.source || primaryProjection.sourceName || fallback.sourceName, ''),
    url: normalizeNullableString(primaryProjection.url || primaryProjection.externalUrl || fallback.sourceUrl),
    metricType,
    observedAt: normalizeNullableString(primaryProjection.observedAt || fallback.observedAt),
  }
}

function normalizePayloadEntry(entry) {
  const fallbackSourceName = normalizeString(entry.sourceName, '')
  const fallbackSourceType = normalizeString(entry.sourceType, '')
  const fallbackSourceUrl = normalizeNullableString(entry.sourceUrl)

  const categories = (Array.isArray(entry.recordCategories) ? entry.recordCategories : [])
    .map((category, index) => {
      if (!category || typeof category !== 'object') return null
      const normalized = {
        ...category,
        id: buildCategoryId(entry.gameId, category),
        gameId: normalizeString(category.gameId || entry.gameId, ''),
        categoryKey: normalizeString(category.categoryKey || category.slug, ''),
        label: normalizeString(category.label || category.name, ''),
        recordKind: normalizeMetricType(category.recordKind || category.type),
        valueDirection: normalizeDirection(category.valueDirection || category.sortDirection || category.recordKind),
        externalUrl: normalizeNullableString(category.externalUrl || category.url),
        sourceName: normalizeString(category.sourceName || fallbackSourceName, ''),
        sourceType: normalizeString(category.sourceType || fallbackSourceType, ''),
        sourceUrl: normalizeNullableString(category.sourceUrl || fallbackSourceUrl),
        observedAt: normalizeNullableString(category.observedAt),
        isPrimary: Boolean(category.isPrimary || index === 0),
        displayOrder: normalizeNumeric(category.displayOrder) ?? index,
      }
      return normalized.label ? normalized : null
    })
    .filter(Boolean)

  const categoryById = new Map(categories.map((category) => [category.id, category]))
  const entries = (Array.isArray(entry.recordEntries) ? entry.recordEntries : [])
    .map((record, index) => {
      if (!record || typeof record !== 'object') return null
      const categoryId = normalizeString(record.categoryId, '') || categories[0]?.id || ''
      const category = categoryById.get(categoryId) || null
      const normalized = {
        ...record,
        id: buildEntryId(entry.gameId, categoryId, record),
        categoryId,
        gameId: normalizeString(record.gameId || entry.gameId, ''),
        rankPosition: normalizeNumeric(record.rankPosition ?? record.rank) ?? index + 1,
        playerHandle: normalizeString(record.playerHandle || record.runner || record.player, ''),
        scoreRaw: normalizeString(record.scoreRaw || record.valueRaw || record.score, ''),
        scoreDisplay: normalizeString(record.scoreDisplay || record.valueDisplay || record.time || record.value, ''),
        achievedAt: normalizeNullableString(record.achievedAt || record.submittedAt || record.date),
        externalUrl: normalizeNullableString(record.externalUrl || record.url || category?.externalUrl),
        sourceName: normalizeString(record.sourceName || category?.sourceName || fallbackSourceName, ''),
        sourceType: normalizeString(record.sourceType || category?.sourceType || fallbackSourceType, ''),
        sourceUrl: normalizeNullableString(record.sourceUrl || category?.sourceUrl || fallbackSourceUrl),
        observedAt: normalizeNullableString(record.observedAt || category?.observedAt),
      }
      return normalized.categoryId && normalized.scoreDisplay ? normalized : null
    })
    .filter(Boolean)

  const achievementProfile = entry.achievementProfile && typeof entry.achievementProfile === 'object'
    ? {
      ...entry.achievementProfile,
      gameId: normalizeString(entry.achievementProfile.gameId || entry.gameId, ''),
      sourceName: normalizeString(entry.achievementProfile.sourceName || fallbackSourceName, ''),
      sourceType: normalizeString(entry.achievementProfile.sourceType || fallbackSourceType, ''),
      sourceUrl: normalizeNullableString(entry.achievementProfile.sourceUrl || fallbackSourceUrl),
      pointsTotal: normalizeNumeric(entry.achievementProfile.pointsTotal),
      achievementCount: normalizeNumeric(entry.achievementProfile.achievementCount),
      leaderboardCount: normalizeNumeric(entry.achievementProfile.leaderboardCount),
      masterySummary: normalizeNullableString(entry.achievementProfile.masterySummary),
      highScoreSummary: normalizeNullableString(entry.achievementProfile.highScoreSummary),
      observedAt: normalizeNullableString(entry.achievementProfile.observedAt),
    }
    : null

  return {
    ...entry,
    gameId: normalizeString(entry.gameId, ''),
    title: normalizeString(entry.title, ''),
    notes: normalizeString(entry.notes, ''),
    sourceName: fallbackSourceName,
    sourceType: fallbackSourceType,
    sourceUrl: fallbackSourceUrl,
    competitiveProfile: entry.competitiveProfile && typeof entry.competitiveProfile === 'object'
      ? {
        speedrunRelevant: Boolean(entry.competitiveProfile.speedrunRelevant),
        scoreAttackRelevant: Boolean(entry.competitiveProfile.scoreAttackRelevant),
        leaderboardRelevant: Boolean(entry.competitiveProfile.leaderboardRelevant),
        achievementCompetitive: Boolean(entry.competitiveProfile.achievementCompetitive),
        primarySource: normalizeString(entry.competitiveProfile.primarySource || fallbackSourceName, ''),
        freshnessCheckedAt: normalizeNullableString(entry.competitiveProfile.freshnessCheckedAt),
        sourceSummary: entry.competitiveProfile.sourceSummary || {},
      }
      : null,
    recordCategories: categories,
    recordEntries: entries,
    achievementProfile,
    primaryProjection: normalizeProjection(entry.primaryProjection, {
      sourceName: fallbackSourceName,
      sourceUrl: fallbackSourceUrl,
    }),
    candidateContext: entry.candidateContext || {},
  }
}

function ensureGameIds(db, payload) {
  const rows = db.prepare(`
    SELECT id
    FROM games
    WHERE id IN (${payload.map(() => '?').join(', ')})
  `).all(...payload.map((entry) => entry.gameId))

  const ids = new Set(rows.map((row) => String(row.id)))
  const missing = payload.map((entry) => entry.gameId).filter((id) => !ids.has(id))
  if (missing.length) {
    throw new Error(`Missing target games in sqlite: ${missing.join(', ')}`)
  }
}

function getComplianceStatus(sourceName) {
  return getSourcePolicy(sourceName).status || 'approved_with_review'
}

function ensureSourceRecord(db, row, timestamp) {
  const complianceStatus = getComplianceStatus(row.sourceName)
  const existing = db.prepare(`
    SELECT id
    FROM source_records
    WHERE entity_type = 'game'
      AND entity_id = ?
      AND field_name = ?
      AND source_name = ?
      AND source_type = ?
    ORDER BY id DESC
    LIMIT 1
  `).get(row.gameId, row.fieldName, row.sourceName, row.sourceType)

  if (existing) {
    db.prepare(`
      UPDATE source_records
      SET source_url = ?,
          compliance_status = ?,
          last_verified_at = ?,
          confidence_level = ?,
          notes = ?
      WHERE id = ?
    `).run(row.sourceUrl, complianceStatus, timestamp, Number(row.confidenceLevel ?? 0.84), row.notes || null, existing.id)
    return Number(existing.id)
  }

  const result = db.prepare(`
    INSERT INTO source_records (
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
      'game',
      ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?
    )
  `).run(
    row.gameId,
    row.fieldName,
    row.sourceName,
    row.sourceType,
    row.sourceUrl,
    complianceStatus,
    timestamp,
    timestamp,
    Number(row.confidenceLevel ?? 0.84),
    row.notes || null
  )

  return Number(result.lastInsertRowid)
}

function ensureProjectionProvenance(db, gameId, projection, sourceRecordId, timestamp) {
  const valueHash = hashValue(JSON.stringify(projection))
  const existing = db.prepare(`
    SELECT id
    FROM field_provenance
    WHERE entity_type = 'game'
      AND entity_id = ?
      AND field_name = 'speedrun_wr'
    ORDER BY id DESC
    LIMIT 1
  `).get(gameId)

  if (existing) {
    db.prepare(`
      UPDATE field_provenance
      SET source_record_id = ?,
          value_hash = ?,
          is_inferred = 0,
          confidence_level = 0.84,
          verified_at = ?
      WHERE id = ?
    `).run(sourceRecordId, valueHash, timestamp, existing.id)
    return
  }

  db.prepare(`
    INSERT INTO field_provenance (
      entity_type,
      entity_id,
      field_name,
      source_record_id,
      value_hash,
      is_inferred,
      confidence_level,
      verified_at
    ) VALUES ('game', ?, 'speedrun_wr', ?, ?, 0, 0.84, ?)
  `).run(gameId, sourceRecordId, valueHash, timestamp)
}

function upsertCompetitiveProfile(db, gameId, profile, sourceRecordId, timestamp) {
  db.prepare(`
    INSERT INTO game_competitive_profiles (
      game_id,
      speedrun_relevant,
      score_attack_relevant,
      leaderboard_relevant,
      achievement_competitive,
      primary_source,
      source_summary,
      source_record_id,
      freshness_checked_at,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(game_id) DO UPDATE SET
      speedrun_relevant = excluded.speedrun_relevant,
      score_attack_relevant = excluded.score_attack_relevant,
      leaderboard_relevant = excluded.leaderboard_relevant,
      achievement_competitive = excluded.achievement_competitive,
      primary_source = excluded.primary_source,
      source_summary = excluded.source_summary,
      source_record_id = excluded.source_record_id,
      freshness_checked_at = excluded.freshness_checked_at,
      updated_at = excluded.updated_at
  `).run(
    gameId,
    profile.speedrunRelevant ? 1 : 0,
    profile.scoreAttackRelevant ? 1 : 0,
    profile.leaderboardRelevant ? 1 : 0,
    profile.achievementCompetitive ? 1 : 0,
    profile.primarySource || null,
    stringifyJson(profile.sourceSummary || null),
    sourceRecordId,
    profile.freshnessCheckedAt || timestamp,
    timestamp,
    timestamp
  )
}

function upsertRecordCategory(db, category, sourceRecordId, timestamp) {
  db.prepare(`
    INSERT INTO game_record_categories (
      id,
      game_id,
      category_key,
      label,
      record_kind,
      value_direction,
      external_url,
      source_name,
      source_type,
      source_url,
      observed_at,
      is_primary,
      display_order,
      source_record_id,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      category_key = excluded.category_key,
      label = excluded.label,
      record_kind = excluded.record_kind,
      value_direction = excluded.value_direction,
      external_url = excluded.external_url,
      source_name = excluded.source_name,
      source_type = excluded.source_type,
      source_url = excluded.source_url,
      observed_at = excluded.observed_at,
      is_primary = excluded.is_primary,
      display_order = excluded.display_order,
      source_record_id = excluded.source_record_id,
      updated_at = excluded.updated_at
  `).run(
    category.id,
    category.gameId,
    category.categoryKey || null,
    category.label,
    category.recordKind || null,
    category.valueDirection || null,
    category.externalUrl || null,
    category.sourceName,
    category.sourceType,
    category.sourceUrl || null,
    category.observedAt || timestamp,
    category.isPrimary ? 1 : 0,
    Number(category.displayOrder ?? 0),
    sourceRecordId,
    timestamp,
    timestamp
  )
}

function upsertRecordEntry(db, record, sourceRecordId, timestamp) {
  db.prepare(`
    INSERT INTO game_record_entries (
      id,
      category_id,
      game_id,
      rank_position,
      player_handle,
      score_raw,
      score_display,
      achieved_at,
      external_url,
      source_name,
      source_type,
      source_url,
      observed_at,
      source_record_id,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      rank_position = excluded.rank_position,
      player_handle = excluded.player_handle,
      score_raw = excluded.score_raw,
      score_display = excluded.score_display,
      achieved_at = excluded.achieved_at,
      external_url = excluded.external_url,
      source_name = excluded.source_name,
      source_type = excluded.source_type,
      source_url = excluded.source_url,
      observed_at = excluded.observed_at,
      source_record_id = excluded.source_record_id,
      updated_at = excluded.updated_at
  `).run(
    record.id,
    record.categoryId,
    record.gameId,
    Number(record.rankPosition || 0) || null,
    record.playerHandle || null,
    record.scoreRaw || null,
    record.scoreDisplay,
    record.achievedAt || null,
    record.externalUrl || null,
    record.sourceName,
    record.sourceType,
    record.sourceUrl || null,
    record.observedAt || timestamp,
    sourceRecordId,
    timestamp,
    timestamp
  )
}

function upsertAchievementProfile(db, profile, sourceRecordId, timestamp) {
  db.prepare(`
    INSERT INTO game_achievement_profiles (
      game_id,
      source_name,
      source_type,
      source_url,
      points_total,
      achievement_count,
      leaderboard_count,
      mastery_summary,
      high_score_summary,
      observed_at,
      source_record_id,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(game_id) DO UPDATE SET
      source_name = excluded.source_name,
      source_type = excluded.source_type,
      source_url = excluded.source_url,
      points_total = excluded.points_total,
      achievement_count = excluded.achievement_count,
      leaderboard_count = excluded.leaderboard_count,
      mastery_summary = excluded.mastery_summary,
      high_score_summary = excluded.high_score_summary,
      observed_at = excluded.observed_at,
      source_record_id = excluded.source_record_id,
      updated_at = excluded.updated_at
  `).run(
    profile.gameId,
    profile.sourceName,
    profile.sourceType,
    profile.sourceUrl || null,
    profile.pointsTotal,
    profile.achievementCount,
    profile.leaderboardCount,
    profile.masterySummary || null,
    profile.highScoreSummary || null,
    profile.observedAt || timestamp,
    sourceRecordId,
    timestamp,
    timestamp
  )
}

function createRun(db, batchKey, timestamp, dryRun, notes) {
  const result = db.prepare(`
    INSERT INTO enrichment_runs (
      run_key,
      pipeline_name,
      mode,
      source_name,
      status,
      dry_run,
      started_at,
      items_seen,
      items_created,
      items_updated,
      items_skipped,
      items_flagged,
      error_count,
      notes
    ) VALUES (?, ?, 'apply', 'competitive_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(`${batchKey}-${timestamp}`, batchKey, dryRun ? 1 : 0, timestamp, notes)

  return Number(result.lastInsertRowid)
}

function finalizeRun(db, runId, timestamp, metrics) {
  db.prepare(`
    UPDATE enrichment_runs
    SET status = 'completed',
        finished_at = ?,
        items_seen = ?,
        items_created = 0,
        items_updated = ?,
        items_skipped = ?,
        items_flagged = ?,
        error_count = 0,
        notes = ?
    WHERE id = ?
  `).run(timestamp, metrics.itemsSeen, metrics.itemsUpdated, metrics.itemsSkipped, metrics.itemsFlagged, metrics.notes, runId)
}

function readBefore(db, payload) {
  const gameRows = db.prepare(`
    SELECT id, speedrun_wr
    FROM games
    WHERE id IN (${payload.map(() => '?').join(', ')})
  `).all(...payload.map((entry) => entry.gameId))
  const categoryRows = db.prepare(`
    SELECT game_id, COUNT(*) AS categoryCount
    FROM game_record_categories
    WHERE game_id IN (${payload.map(() => '?').join(', ')})
    GROUP BY game_id
  `).all(...payload.map((entry) => entry.gameId))

  return {
    projectionByGameId: new Map(gameRows.map((row) => [String(row.id), normalizeString(row.speedrun_wr, '')])),
    categoryCountByGameId: new Map(categoryRows.map((row) => [String(row.game_id), Number(row.categoryCount || 0)])),
  }
}

function dryRun(db, payload) {
  const before = readBefore(db, payload)
  return {
    targetedGames: payload.length,
    competitiveProfiles: payload.filter((entry) => entry.competitiveProfile).length,
    recordCategories: payload.reduce((sum, entry) => sum + entry.recordCategories.length, 0),
    recordEntries: payload.reduce((sum, entry) => sum + entry.recordEntries.length, 0),
    achievementProfiles: payload.filter((entry) => entry.achievementProfile).length,
    projectionUpdates: payload.filter((entry) => {
      if (!entry.primaryProjection) return false
      return before.projectionByGameId.get(entry.gameId) !== JSON.stringify(entry.primaryProjection)
    }).length,
    targets: payload.map((entry) => ({
      gameId: entry.gameId,
      title: entry.title,
      categoryCountBefore: before.categoryCountByGameId.get(entry.gameId) || 0,
      categoryCountPlanned: entry.recordCategories.length,
      recordCountPlanned: entry.recordEntries.length,
      hasAchievementProfile: Boolean(entry.achievementProfile),
      hasPrimaryProjection: Boolean(entry.primaryProjection),
      sourceName: entry.sourceName,
    })),
  }
}

function applyBatch(db, batchKey, notes, payload) {
  const startedAt = nowIso()
  const runId = createRun(db, batchKey, startedAt, false, notes)
  const metrics = {
    itemsSeen: payload.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    profilesUpserted: 0,
    categoriesUpserted: 0,
    recordsUpserted: 0,
    achievementsUpserted: 0,
    projectionsUpserted: 0,
    notes,
  }

  const transaction = db.transaction(() => {
    for (const rawEntry of payload) {
      const entry = normalizePayloadEntry(rawEntry)

      if (entry.competitiveProfile) {
        const sourceRecordId = ensureSourceRecord(db, {
          gameId: entry.gameId,
          fieldName: 'competitive_profile',
          sourceName: entry.sourceName || entry.competitiveProfile.primarySource,
          sourceType: entry.sourceType,
          sourceUrl: entry.sourceUrl,
          confidenceLevel: 0.84,
          notes: entry.notes || 'Competitive profile import',
        }, startedAt)
        upsertCompetitiveProfile(db, entry.gameId, entry.competitiveProfile, sourceRecordId, startedAt)
        metrics.profilesUpserted += 1
      }

      for (const category of entry.recordCategories) {
        const sourceRecordId = ensureSourceRecord(db, {
          gameId: entry.gameId,
          fieldName: `record_category:${slugify(category.categoryKey || category.label) || 'record'}`,
          sourceName: category.sourceName,
          sourceType: category.sourceType,
          sourceUrl: category.sourceUrl || category.externalUrl,
          confidenceLevel: 0.84,
          notes: entry.notes || `Competitive category ${category.label}`,
        }, startedAt)
        upsertRecordCategory(db, category, sourceRecordId, startedAt)
        metrics.categoriesUpserted += 1
      }

      for (const record of entry.recordEntries) {
        const sourceRecordId = ensureSourceRecord(db, {
          gameId: entry.gameId,
          fieldName: `record_entry:${slugify(record.categoryId)}:${record.rankPosition || 'x'}`,
          sourceName: record.sourceName,
          sourceType: record.sourceType,
          sourceUrl: record.sourceUrl || record.externalUrl,
          confidenceLevel: 0.84,
          notes: entry.notes || `Competitive entry ${record.categoryId}`,
        }, startedAt)
        upsertRecordEntry(db, record, sourceRecordId, startedAt)
        metrics.recordsUpserted += 1
      }

      if (entry.achievementProfile) {
        const sourceRecordId = ensureSourceRecord(db, {
          gameId: entry.gameId,
          fieldName: 'achievement_profile',
          sourceName: entry.achievementProfile.sourceName,
          sourceType: entry.achievementProfile.sourceType,
          sourceUrl: entry.achievementProfile.sourceUrl,
          confidenceLevel: 0.84,
          notes: entry.notes || 'Achievement profile import',
        }, startedAt)
        upsertAchievementProfile(db, entry.achievementProfile, sourceRecordId, startedAt)
        metrics.achievementsUpserted += 1
      }

      if (entry.primaryProjection) {
        const sourceRecordId = ensureSourceRecord(db, {
          gameId: entry.gameId,
          fieldName: 'speedrun_wr',
          sourceName: entry.primaryProjection.source || entry.sourceName,
          sourceType: entry.sourceType,
          sourceUrl: entry.primaryProjection.url || entry.sourceUrl,
          confidenceLevel: 0.84,
          notes: entry.notes || 'Competitive projection to games.speedrun_wr',
        }, startedAt)
        db.prepare(`
          UPDATE games
          SET speedrun_wr = ?
          WHERE id = ?
        `).run(JSON.stringify(entry.primaryProjection), entry.gameId)
        ensureProjectionProvenance(db, entry.gameId, entry.primaryProjection, sourceRecordId, startedAt)
        metrics.projectionsUpserted += 1
      }

      metrics.itemsUpdated += 1
    }
  })

  transaction()
  finalizeRun(db, runId, nowIso(), metrics)
  return { runId, metrics }
}

function runCompetitiveBatch({ batchKey, notes, payload, argv = process.argv }) {
  const apply = argv.includes('--apply')
  const normalizedPayload = payload.map((entry) => normalizePayloadEntry(entry))
  const db = new Database(SQLITE_PATH)
  try {
    ensureGameIds(db, normalizedPayload)
    if (!apply) {
      console.log(JSON.stringify({
        mode: 'dry-run',
        sqlitePath: SQLITE_PATH,
        summary: dryRun(db, normalizedPayload),
      }, null, 2))
      return
    }

    console.log(JSON.stringify({
      mode: 'apply',
      sqlitePath: SQLITE_PATH,
      summary: dryRun(db, normalizedPayload),
      result: applyBatch(db, batchKey, notes, normalizedPayload),
    }, null, 2))
  } finally {
    db.close()
  }
}

module.exports = {
  SQLITE_PATH,
  runCompetitiveBatch,
}
