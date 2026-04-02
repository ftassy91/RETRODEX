'use strict'
// DATA: Sequelize via ../../../database - admin/back-office only

const { QueryTypes } = require('sequelize')

const { sequelize } = require('../../../database')
const { tableExists } = require('./reads')

function sortJsonValue(value) {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue)
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortJsonValue(value[key])
        return acc
      }, {})
  }

  return value
}

function normalizeJsonForCompare(value, fallback) {
  if (value == null || value === '') {
    return JSON.stringify(fallback)
  }

  if (typeof value === 'string') {
    try {
      return JSON.stringify(sortJsonValue(JSON.parse(value)))
    } catch (_error) {
      return JSON.stringify(value)
    }
  }

  return JSON.stringify(sortJsonValue(value))
}

function normalizeNumberForCompare(value) {
  if (value == null || value === '') {
    return null
  }

  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function normalizeTextForCompare(value) {
  return value == null ? null : String(value)
}

function buildComparableQualityPayload(entry) {
  return {
    completenessScore: normalizeNumberForCompare(entry.completenessScore),
    confidenceScore: normalizeNumberForCompare(entry.confidenceScore),
    sourceCoverageScore: normalizeNumberForCompare(entry.sourceCoverageScore),
    freshnessScore: normalizeNumberForCompare(entry.freshnessScore),
    overallScore: normalizeNumberForCompare(entry.overallScore),
    tier: normalizeTextForCompare(entry.tier),
    missingCriticalFields: normalizeJsonForCompare(entry.missingCriticalFields, []),
    breakdownJson: normalizeJsonForCompare(entry.breakdown, {}),
    priorityScore: normalizeNumberForCompare(entry.priorityScore),
  }
}

async function fetchExistingQualityRecord(entry) {
  const rows = await sequelize.query(
    `SELECT
      completeness_score,
      confidence_score,
      source_coverage_score,
      freshness_score,
      overall_score,
      tier,
      missing_critical_fields,
      breakdown_json,
      priority_score,
      updated_at
    FROM quality_records
    WHERE entity_type = :entityType
      AND entity_id = :entityId
    LIMIT 1`,
    {
      replacements: {
        entityType: entry.entityType,
        entityId: entry.entityId,
      },
      type: QueryTypes.SELECT,
    }
  )

  return rows[0] || null
}

function qualityPayloadChanged(existingRow, nextPayload) {
  if (!existingRow) {
    return true
  }

  const currentPayload = {
    completenessScore: normalizeNumberForCompare(existingRow.completeness_score),
    confidenceScore: normalizeNumberForCompare(existingRow.confidence_score),
    sourceCoverageScore: normalizeNumberForCompare(existingRow.source_coverage_score),
    freshnessScore: normalizeNumberForCompare(existingRow.freshness_score),
    overallScore: normalizeNumberForCompare(existingRow.overall_score),
    tier: normalizeTextForCompare(existingRow.tier),
    missingCriticalFields: normalizeJsonForCompare(existingRow.missing_critical_fields, []),
    breakdownJson: normalizeJsonForCompare(existingRow.breakdown_json, {}),
    priorityScore: normalizeNumberForCompare(existingRow.priority_score),
  }

  return Object.keys(nextPayload).some((key) => currentPayload[key] !== nextPayload[key])
}

async function upsertQualityRecord(entry) {
  if (!(await tableExists('quality_records'))) {
    return { changed: false, reason: 'table-missing' }
  }

  const nextPayload = buildComparableQualityPayload(entry)
  const existingRow = await fetchExistingQualityRecord(entry)
  const hasSemanticChange = qualityPayloadChanged(existingRow, nextPayload)

  if (!hasSemanticChange) {
    return { changed: false, reason: 'unchanged' }
  }

  const updatedAt = new Date().toISOString()

  await sequelize.query(
    `INSERT INTO quality_records (
      entity_type,
      entity_id,
      completeness_score,
      confidence_score,
      source_coverage_score,
      freshness_score,
      overall_score,
      tier,
      missing_critical_fields,
      breakdown_json,
      priority_score,
      updated_at
    ) VALUES (
      :entityType,
      :entityId,
      :completenessScore,
      :confidenceScore,
      :sourceCoverageScore,
      :freshnessScore,
      :overallScore,
      :tier,
      :missingCriticalFields,
      :breakdownJson,
      :priorityScore,
      :updatedAt
    )
    ON CONFLICT(entity_type, entity_id) DO UPDATE SET
      completeness_score = excluded.completeness_score,
      confidence_score = excluded.confidence_score,
      source_coverage_score = excluded.source_coverage_score,
      freshness_score = excluded.freshness_score,
      overall_score = excluded.overall_score,
      tier = excluded.tier,
      missing_critical_fields = excluded.missing_critical_fields,
      breakdown_json = excluded.breakdown_json,
      priority_score = excluded.priority_score,
      updated_at = excluded.updated_at`,
    {
      replacements: {
        entityType: entry.entityType,
        entityId: entry.entityId,
        completenessScore: nextPayload.completenessScore,
        confidenceScore: nextPayload.confidenceScore,
        sourceCoverageScore: nextPayload.sourceCoverageScore,
        freshnessScore: nextPayload.freshnessScore,
        overallScore: nextPayload.overallScore,
        tier: nextPayload.tier,
        missingCriticalFields: nextPayload.missingCriticalFields,
        breakdownJson: nextPayload.breakdownJson,
        priorityScore: nextPayload.priorityScore,
        updatedAt,
      },
      type: QueryTypes.INSERT,
    }
  )

  return { changed: true, reason: existingRow ? 'updated' : 'inserted' }
}

module.exports = {
  upsertQualityRecord,
}
