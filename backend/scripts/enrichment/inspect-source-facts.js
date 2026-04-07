#!/usr/bin/env node
'use strict'

/**
 * inspect-source-facts.js
 *
 * Validates a source-facts manifest without writing anything.
 * Reports: game existence, usable facts count, field targets, conflict detection.
 *
 * Usage:
 *   node inspect-source-facts.js --manifest=manifests/source-facts-batch-NAME.json
 *   node inspect-source-facts.js --manifest=manifests/source-facts-batch-NAME.json --json
 *
 * Output:
 *   Human-readable table by default.
 *   --json for machine-readable output.
 */

const fs = require('fs')
const path = require('path')
const Database = require('better-sqlite3')

const SQLITE_PATH = path.resolve(__dirname, '../../storage/retrodex.sqlite')
const JSON_MODE = process.argv.includes('--json')

// ---------------------------------------------------------------------------
// Reuse resolution logic from apply-source-facts.js
// ---------------------------------------------------------------------------

const CATEGORY_FIELD_MAP = {
  dev: 'dev_anecdotes',
  technique: 'dev_anecdotes',
  histoire: 'dev_anecdotes',
  historique: 'dev_anecdotes',
  contexte: 'dev_anecdotes',
  history: 'dev_anecdotes',
  context: 'dev_anecdotes',
  gameplay: 'dev_anecdotes',
  OST: 'dev_anecdotes',
  ost: 'dev_anecdotes',
  audio: 'dev_anecdotes',
  cheat: 'cheat_codes',
  cheats: 'cheat_codes',
  version: 'versions',
  edition: 'versions',
  regional: 'versions',
  credits: 'dev_team',
}

const ALLOWED_FIELDS = new Set([
  'dev_anecdotes', 'cheat_codes', 'versions',
  'dev_team', 'ost_composers', 'ost_notable_tracks',
])

function resolveTargetField(fact) {
  if (fact.targetField && ALLOWED_FIELDS.has(fact.targetField)) return fact.targetField
  if (fact.category) {
    const mapped = CATEGORY_FIELD_MAP[fact.category] || CATEGORY_FIELD_MAP[String(fact.category).toLowerCase()]
    if (mapped) return mapped
  }
  return 'dev_anecdotes'
}

function parseJsonSafe(value, fallback = []) {
  if (Array.isArray(value)) return value
  if (!value) return fallback
  try {
    const parsed = JSON.parse(String(value))
    return Array.isArray(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

function isAlreadyPresent(existing, factText) {
  const needle = String(factText).trim().toLowerCase()
  return existing.some((e) => {
    const hay = String(e.text || e.description || e.effect || e.name || e || '').trim().toLowerCase()
    return hay === needle
  })
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateManifest(manifestPath) {
  if (!fs.existsSync(manifestPath)) {
    return { error: `File not found: ${manifestPath}` }
  }
  let manifest
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  } catch (e) {
    return { error: `JSON parse error: ${e.message}` }
  }
  if (!manifest.batchKey) return { error: 'Missing batchKey' }
  if (manifest.batchType !== 'source_facts') return { error: `Wrong batchType: ${manifest.batchType}` }
  if (!Array.isArray(manifest.payload)) return { error: 'payload must be an array' }
  return { manifest }
}

function inspectManifest(db, manifest) {
  const results = []
  const totals = { games: 0, found: 0, missing: 0, factsTotal: 0, factsUsable: 0, factsSkipped: 0, factsConflict: 0, factsNew: 0 }

  for (const entry of manifest.payload) {
    const gameId = String(entry.gameId || '').trim()
    totals.games++

    const game = db.prepare(
      `SELECT id, dev_anecdotes, cheat_codes, versions, dev_team, ost_composers, ost_notable_tracks FROM games WHERE id = ?`
    ).get(gameId)

    if (!game) {
      totals.missing++
      results.push({ gameId, title: entry.title, found: false, facts: [] })
      continue
    }

    totals.found++
    const factResults = []

    for (const fact of entry.facts || []) {
      totals.factsTotal++
      const targetField = resolveTargetField(fact)
      const factText = String(fact.fact || '').trim()

      if (fact.status === 'reject') {
        totals.factsSkipped++
        factResults.push({ status: 'rejected', targetField, text: factText.slice(0, 80) })
        continue
      }

      if (fact.status === 'verify') {
        totals.factsSkipped++
        factResults.push({ status: 'needs_verify', targetField, text: factText.slice(0, 80) })
        continue
      }

      // usable — check for duplicates
      const existing = parseJsonSafe(game[targetField])
      const duplicate = isAlreadyPresent(existing, factText)

      if (duplicate) {
        totals.factsConflict++
        factResults.push({ status: 'duplicate', targetField, text: factText.slice(0, 80) })
      } else {
        totals.factsNew++
        factResults.push({
          status: 'new',
          targetField,
          source: fact.sourceType,
          sourceName: fact.sourceName,
          confidence: fact.confidence,
          text: factText.slice(0, 100),
        })
      }
    }

    results.push({ gameId, title: entry.title, found: true, facts: factResults })
  }

  return { totals, results }
}

// ---------------------------------------------------------------------------
// Output formatters
// ---------------------------------------------------------------------------

function printHuman(manifest, report) {
  const { totals, results } = report
  const line = '─'.repeat(72)

  console.log(`\n${line}`)
  console.log(`  SOURCE FACTS INSPECTOR — ${manifest.batchKey}`)
  console.log(line)
  console.log(`  Games   : ${totals.games} total | ${totals.found} found | ${totals.missing} missing`)
  console.log(`  Facts   : ${totals.factsTotal} total | ${totals.factsNew} new | ${totals.factsConflict} duplicate | ${totals.factsSkipped} skipped`)
  console.log(line)

  for (const entry of results) {
    if (!entry.found) {
      console.log(`\n  ✗ NOT FOUND   ${entry.gameId}`)
      continue
    }

    const newCount = entry.facts.filter((f) => f.status === 'new').length
    const icon = newCount > 0 ? '✓' : '·'
    console.log(`\n  ${icon} ${entry.title} (${entry.gameId})`)

    for (const fact of entry.facts) {
      const statusLabel = {
        new: '  [NEW]     ',
        duplicate: '  [DUP]     ',
        needs_verify: '  [VERIFY]  ',
        rejected: '  [REJECT]  ',
      }[fact.status] || '  [?]       '

      const source = fact.sourceName ? ` (${fact.sourceName})` : ''
      const field = `→ ${fact.targetField}`
      const text = fact.text ? `"${fact.text.slice(0, 70)}${fact.text.length > 70 ? '…' : ''}"` : ''
      console.log(`${statusLabel}${field}${source}`)
      if (text) console.log(`             ${text}`)
    }
  }

  console.log(`\n${line}`)
  if (totals.factsNew > 0) {
    console.log(`  → ${totals.factsNew} new fact(s) ready to apply.`)
    console.log(`  → Run with --apply to write to SQLite.`)
  } else {
    console.log(`  → Nothing new to apply.`)
  }
  console.log(line)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const arg = process.argv.find((a) => a.startsWith('--manifest='))
  if (!arg) {
    console.error('Usage: node inspect-source-facts.js --manifest=manifests/source-facts-batch-NAME.json')
    process.exit(1)
  }

  const rel = arg.slice('--manifest='.length)
  const abs = path.isAbsolute(rel) ? rel : path.resolve(__dirname, rel)
  const { error, manifest } = validateManifest(abs)

  if (error) {
    console.error(`Manifest error: ${error}`)
    process.exit(1)
  }

  const db = new Database(SQLITE_PATH, { readonly: true })
  const report = inspectManifest(db, manifest)
  db.close()

  if (JSON_MODE) {
    console.log(JSON.stringify({ batchKey: manifest.batchKey, ...report }, null, 2))
  } else {
    printHuman(manifest, report)
  }
}

main()
