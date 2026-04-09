'use strict'

const { CONDITION_VALUES } = require('../source-registry')
const { buildBalancedSnapshot } = require('./build-balanced-snapshot')
const { buildBucketSnapshots, groupSnapshotsByGame } = require('./buckets')
const { classifyConfidenceTier, daysSince, enrichObservationConfidence, scoreObservation } = require('./confidence')

function scoreMatchedRecords(records = []) {
  return records.map((record) => enrichObservationConfidence(record))
}

function buildScoredMarketSnapshots(records = []) {
  const scoredRecords = scoreMatchedRecords(records)
  const bucketSnapshots = buildBucketSnapshots(scoredRecords)
  const groupedSnapshots = groupSnapshotsByGame(bucketSnapshots)

  const gameSnapshots = [...groupedSnapshots.values()].map((entry) => {
    const conditions = CONDITION_VALUES.reduce((acc, condition) => {
      const conditionSnapshot = entry.conditions[condition]
      const observationRows = scoredRecords.filter((record) =>
        record.match?.game?.id === entry.gameId
        && record.normalized_condition === condition
        && record.include_in_snapshot
      )

      acc[condition] = conditionSnapshot
        ? buildBalancedSnapshot(conditionSnapshot, observationRows)
        : null
      return acc
    }, {})

    const allConditionSnapshots = Object.values(conditions).filter(Boolean)
    const latestSoldAt = allConditionSnapshots
      .map((snapshot) => snapshot.latestSoldAt)
      .filter(Boolean)
      .sort((left, right) => String(right).localeCompare(String(left)))[0] || null
    const sourceNames = Array.from(new Set(
      allConditionSnapshots.flatMap((snapshot) => snapshot.sourceNames || [])
    ))
    const confidenceTier = classifyConfidenceTier({
      totalObservations: allConditionSnapshots.reduce((sum, snapshot) => sum + Number(snapshot.totalObservations || 0), 0),
      representedBuckets: Math.max(0, ...allConditionSnapshots.map((snapshot) => Number(snapshot.representedBuckets || 0))),
      latestSoldAt,
      crossBucketVariance: Math.max(0, ...allConditionSnapshots.map((snapshot) => Number(snapshot.crossBucketVariance || 0))),
      averageMatchConfidence: averageSnapshotMetric(allConditionSnapshots, 'averageMatchConfidence'),
      averageSourceConfidence: averageSnapshotMetric(allConditionSnapshots, 'averageSourceConfidence'),
    })

    return {
      gameId: entry.gameId,
      conditions,
      latestSoldAt,
      sourceNames,
      sourceCount: sourceNames.length,
      confidenceTier,
      confidenceReason: buildGameConfidenceReason(confidenceTier, allConditionSnapshots),
    }
  })

  return {
    scoredRecords,
    bucketSnapshots,
    gameSnapshots,
  }
}

function averageSnapshotMetric(snapshots = [], fieldName) {
  const values = snapshots
    .map((snapshot) => Number(snapshot?.[fieldName]))
    .filter((value) => Number.isFinite(value))
  if (!values.length) {
    return 0
  }
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4))
}

function buildGameConfidenceReason(confidenceTier, conditionSnapshots = []) {
  if (!conditionSnapshots.length) {
    return 'No publishable sold observations.'
  }

  const maxFreshness = Math.min(...conditionSnapshots
    .map((snapshot) => daysSince(snapshot.latestSoldAt))
    .filter((value) => Number.isFinite(value)))
  const buckets = Math.max(0, ...conditionSnapshots.map((snapshot) => Number(snapshot.representedBuckets || 0)))
  const observationCount = conditionSnapshots.reduce((sum, snapshot) => sum + Number(snapshot.totalObservations || 0), 0)

  if (confidenceTier === 'high') {
    return `Balanced ${buckets}-bucket sold signal across ${observationCount} observations, latest ${maxFreshness} day(s) ago.`
  }
  if (confidenceTier === 'medium') {
    return `Usable sold signal across ${buckets} bucket(s) and ${observationCount} observations.`
  }
  if (confidenceTier === 'low') {
    return `Limited sold signal: ${buckets} bucket(s), ${observationCount} observations.`
  }
  return 'No balanced sold signal available.'
}

module.exports = {
  buildBucketSnapshots,
  buildScoredMarketSnapshots,
  classifyConfidenceTier,
  daysSince,
  enrichObservationConfidence,
  scoreObservation,
}
