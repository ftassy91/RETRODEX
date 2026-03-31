'use strict'
// DATA: Sequelize via ../../../database - admin/back-office only

const { QueryTypes } = require('sequelize')

const { sequelize } = require('../../../database')
const { tableExists } = require('./reads')

async function upsertQualityRecord(entry) {
  if (!(await tableExists('quality_records'))) {
    return
  }

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
        completenessScore: entry.completenessScore,
        confidenceScore: entry.confidenceScore,
        sourceCoverageScore: entry.sourceCoverageScore,
        freshnessScore: entry.freshnessScore,
        overallScore: entry.overallScore,
        tier: entry.tier,
        missingCriticalFields: JSON.stringify(entry.missingCriticalFields || []),
        breakdownJson: JSON.stringify(entry.breakdown || {}),
        priorityScore: entry.priorityScore,
        updatedAt: new Date().toISOString(),
      },
      type: QueryTypes.INSERT,
    }
  )
}

module.exports = {
  upsertQualityRecord,
}
