'use strict'

const { TRUST } = require('../config/constants')

function getTier(confidence_pct) {
  if (confidence_pct >= TRUST.T1_MIN) return 'T1'
  if (confidence_pct >= TRUST.T2_MIN) return 'T2'
  if (confidence_pct >= TRUST.T3_MIN) return 'T3'
  if (confidence_pct >= TRUST.T4_MIN) return 'T4'
  return 'T0'
}

function getTierLabel(tier) {
  return { T1: '✓ VÉRIFIÉ', T2: '~ FIABLE', T3: '≈ INDICATIF', T4: '? ESTIMÉ', T0: '— INCONNU' }[tier]
}

function getTierColor(tier) {
  return {
    T1: 'var(--confidence-high)',
    T2: 'var(--confidence-high)',
    T3: 'var(--confidence-mid)',
    T4: 'var(--text-muted)',
    T0: 'var(--text-muted)',
  }[tier]
}

function buildTrustInfo(indexEntry) {
  if (!indexEntry) return { tier: 'T0', label: '— INCONNU', confidence: 0 }
  const tier = getTier(indexEntry.confidence_pct)
  return {
    tier,
    label: getTierLabel(tier),
    confidence: indexEntry.confidence_pct,
    sources_editorial: indexEntry.sources_editorial,
    last_sale: indexEntry.last_sale_date,
  }
}

module.exports = { getTier, getTierLabel, getTierColor, buildTrustInfo }
