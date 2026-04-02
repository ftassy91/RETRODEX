'use strict'
// DATA: pure ranking over premium coverage entries - admin/back-office only

function getCurationBonus(entry) {
  switch (String(entry.curation?.status || '').toLowerCase()) {
    case 'published':
      return 18
    case 'locked':
      return 15
    case 'complete':
      return 10
    case 'in_progress':
      return 5
    default:
      return 0
  }
}

function getRarityBonus(entry) {
  switch (String(entry.rarity || '').toUpperCase()) {
    case 'LEGENDARY':
      return 10
    case 'EPIC':
      return 7
    case 'RARE':
      return 4
    default:
      return 0
  }
}

function computePremiumPriorityScore(entry) {
  const auditPriority = Number(entry.audit?.priorityScore || 0)
  const completeness = Number(entry.completenessScore || 0)
  const evidenceDensity = Math.min(
    100,
    (Number(entry.evidence?.sourceRecordCount || 0) * 2)
    + (Number(entry.evidence?.attributedFieldCount || 0) * 0.5)
  )
  const curationBonus = getCurationBonus(entry)
  const rarityBonus = getRarityBonus(entry)
  const publishableBonus = entry.isPublishable ? 8 : 0
  const candidateBonus = entry.isTop100Candidate ? 10 : 0

  return Math.round(
    (auditPriority * 0.35)
    + (completeness * 0.35)
    + (evidenceDensity * 0.20)
    + (curationBonus + rarityBonus + publishableBonus + candidateBonus)
  )
}

function comparePremiumCandidates(left, right) {
  if (Number(left.premiumPriorityScore || 0) !== Number(right.premiumPriorityScore || 0)) {
    return Number(right.premiumPriorityScore || 0) - Number(left.premiumPriorityScore || 0)
  }
  if (Number(left.completenessScore || 0) !== Number(right.completenessScore || 0)) {
    return Number(right.completenessScore || 0) - Number(left.completenessScore || 0)
  }
  return String(left.title || '').localeCompare(String(right.title || ''), 'fr', { sensitivity: 'base' })
}

function selectTopPremiumCandidates(entries = [], { limit = 100, includeNonCandidates = false } = {}) {
  const ranked = (entries || [])
    .filter((entry) => includeNonCandidates || entry.isTop100Candidate)
    .map((entry) => ({
      ...entry,
      premiumPriorityScore: computePremiumPriorityScore(entry),
    }))
    .sort(comparePremiumCandidates)

  return ranked.slice(0, Math.max(1, Number(limit || 100)))
}

module.exports = {
  computePremiumPriorityScore,
  selectTopPremiumCandidates,
}
