'use strict'

function classifyConfidence(score) {
  const normalized = Number(score || 0)
  if (normalized >= 0.8) return 'strong'
  if (normalized >= 0.6) return 'qualified'
  if (normalized >= 0.4) return 'weak'
  return 'reject'
}

function scoreLifecycle(score) {
  const normalized = Number(score || 0)
  return {
    classifier: classifyConfidence(normalized),
    keepRaw: normalized >= 0.4,
    includeInSnapshot: normalized >= 0.6,
  }
}

module.exports = {
  classifyConfidence,
  scoreLifecycle,
}
