'use strict'

const { getSourcePolicy } = require('../../../config/source-policy')

function resolvePolicySupport(keys) {
  const uniqueKeys = Array.from(new Set((keys || []).filter(Boolean)))
  if (!uniqueKeys.length) {
    const fallback = getSourcePolicy('unknown')
    return {
      policies: [fallback.name],
      legalFeasibility: fallback.legalFeasibility,
      sourceAvailability: fallback.sourceAvailability,
    }
  }

  const policies = uniqueKeys.map((key) => getSourcePolicy(key))
  return {
    policies: policies.map((policy) => policy.name),
    legalFeasibility: Math.max(...policies.map((policy) => policy.legalFeasibility)),
    sourceAvailability: Math.max(...policies.map((policy) => policy.sourceAvailability)),
  }
}

function detectGameSourceKeys(game) {
  const keys = []
  if (String(game.cover_url || game.coverImage || '').includes('igdb.com')) {
    keys.push('igdb')
  }
  if (String(game.manual_url || '').includes('archive.org')) {
    keys.push('internet_archive')
  }
  if (Number(game.source_confidence || 0) > 0) {
    keys.push('internal')
  }
  return keys
}

function detectConsoleSourceKeys(_consoleItem, knowledgeEntry) {
  const keys = ['internal']
  if (knowledgeEntry) {
    keys.push('internal')
  }
  return keys
}

module.exports = {
  resolvePolicySupport,
  detectGameSourceKeys,
  detectConsoleSourceKeys,
}
