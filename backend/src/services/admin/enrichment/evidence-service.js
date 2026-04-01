'use strict'
// DATA: Sequelize via ../../../database and canonical provenance tables - admin/back-office only

const { QueryTypes } = require('sequelize')

const { sequelize } = require('../../../database')
const { tableExists } = require('../../publication-service')

function normalizeGameIds(gameIds = []) {
  return Array.from(new Set((gameIds || []).filter(Boolean).map((value) => String(value))))
}

function createEmptyEvidenceSummary() {
  return {
    sourceRecordCount: 0,
    fieldProvenanceCount: 0,
    attributedFieldCount: 0,
    inferredFieldCount: 0,
    verifiedFieldCount: 0,
    avgFieldConfidence: 0,
    sourceNames: [],
    fieldNames: [],
  }
}

function ensureEvidenceSummary(map, gameId) {
  const key = String(gameId || '')
  if (!map.has(key)) {
    map.set(key, createEmptyEvidenceSummary())
  }
  return map.get(key)
}

async function loadSourceRecordRows(gameIds = []) {
  if (!(await tableExists('source_records'))) {
    return []
  }

  const ids = normalizeGameIds(gameIds)
  const whereClause = ids.length
    ? 'AND entity_id IN (:gameIds)'
    : ''

  return sequelize.query(
    `SELECT entity_id AS gameId,
            field_name AS fieldName,
            source_name AS sourceName
     FROM source_records
     WHERE entity_type = 'game'
       ${whereClause}`,
    {
      replacements: ids.length ? { gameIds: ids } : {},
      type: QueryTypes.SELECT,
    }
  )
}

async function loadFieldProvenanceRows(gameIds = []) {
  if (!(await tableExists('field_provenance'))) {
    return []
  }

  const ids = normalizeGameIds(gameIds)
  const whereClause = ids.length
    ? 'AND entity_id IN (:gameIds)'
    : ''

  return sequelize.query(
    `SELECT entity_id AS gameId,
            field_name AS fieldName,
            is_inferred AS isInferred,
            confidence_level AS confidenceLevel,
            verified_at AS verifiedAt
     FROM field_provenance
     WHERE entity_type = 'game'
       ${whereClause}`,
    {
      replacements: ids.length ? { gameIds: ids } : {},
      type: QueryTypes.SELECT,
    }
  )
}

async function buildGameEvidenceSummaryMap(gameIds = []) {
  const [sourceRows, provenanceRows] = await Promise.all([
    loadSourceRecordRows(gameIds),
    loadFieldProvenanceRows(gameIds),
  ])

  const map = new Map()

  for (const row of sourceRows) {
    const summary = ensureEvidenceSummary(map, row.gameId)
    summary.sourceRecordCount += 1
    if (row.sourceName && !summary.sourceNames.includes(String(row.sourceName))) {
      summary.sourceNames.push(String(row.sourceName))
    }
  }

  for (const row of provenanceRows) {
    const summary = ensureEvidenceSummary(map, row.gameId)
    summary.fieldProvenanceCount += 1

    if (row.fieldName && !summary.fieldNames.includes(String(row.fieldName))) {
      summary.fieldNames.push(String(row.fieldName))
    }
    if (Number(row.isInferred || 0) === 1) {
      summary.inferredFieldCount += 1
    }
    if (row.verifiedAt) {
      summary.verifiedFieldCount += 1
    }

    const confidence = Number(row.confidenceLevel || 0)
    if (Number.isFinite(confidence) && confidence > 0) {
      summary.avgFieldConfidence += confidence
    }
  }

  for (const summary of map.values()) {
    summary.attributedFieldCount = summary.fieldNames.length
    summary.sourceNames.sort((left, right) => left.localeCompare(right, 'fr', { sensitivity: 'base' }))
    summary.fieldNames.sort((left, right) => left.localeCompare(right, 'fr', { sensitivity: 'base' }))
    summary.avgFieldConfidence = summary.fieldProvenanceCount > 0
      ? Number((summary.avgFieldConfidence / summary.fieldProvenanceCount).toFixed(4))
      : 0
  }

  return map
}

async function getGameEvidenceSummary(gameId) {
  const map = await buildGameEvidenceSummaryMap([gameId])
  return map.get(String(gameId || '')) || createEmptyEvidenceSummary()
}

module.exports = {
  buildGameEvidenceSummaryMap,
  getGameEvidenceSummary,
}
