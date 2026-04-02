#!/usr/bin/env node
'use strict'

const {
  getCompletionOverview,
  parseStringFlag,
} = require('../../src/services/admin/completion-service')

async function main() {
  const top1200Path = parseStringFlag(process.argv, 'top1200', null)
  const auditSummaryPath = parseStringFlag(process.argv, 'audit-summary', null)
  const auditGamesPath = parseStringFlag(process.argv, 'audit-games', null)
  const overview = await getCompletionOverview({
    top1200Path,
    auditSummaryPath,
    auditGamesPath,
  })

  const top1200Band = overview.bands.find((band) => band.band === 'top1200')
  const fields = Object.fromEntries(top1200Band.field_summaries.map((field) => [field.field, {
    label: field.label,
    family: field.family,
    target_class: field.target_class,
    strong_target: field.strong_target,
    filled_count: field.filled_count,
    eligible_count: field.eligible_count,
    coverage_pct: field.coverage_pct,
    gap_to_target: field.gap_to_target,
    blocked_count: field.blocked_count,
    status: field.status,
  }]))

  const summary = {
    strong: top1200Band.field_summaries.filter((field) => field.status === 'strong').map((field) => field.field),
    close: top1200Band.field_summaries.filter((field) => field.status === 'close').map((field) => field.field),
    weak: top1200Band.field_summaries.filter((field) => field.status === 'weak').map((field) => field.field),
    blocked_by_source: top1200Band.field_summaries.filter((field) => field.status === 'blocked_by_source').map((field) => field.field),
  }

  console.log(JSON.stringify({
    generatedAt: overview.generated_at,
    sources: overview.sources,
    top1200: {
      total: top1200Band.game_count,
      label: top1200Band.label,
    },
    summary,
    families: overview.families,
    fields,
    blocked_by_source: overview.blocked_by_source,
  }, null, 2))
}

main().catch((error) => {
  console.error('[report-top1200-richness]', error && error.stack ? error.stack : error)
  process.exitCode = 1
})
