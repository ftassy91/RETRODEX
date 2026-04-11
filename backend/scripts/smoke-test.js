#!/usr/bin/env node
'use strict'

/**
 * smoke-test.js — Quick health check for RetroDex API
 *
 * Hits key endpoints on the deployed Vercel instance and reports pass/fail.
 * Usage:
 *   node backend/scripts/smoke-test.js
 *   node backend/scripts/smoke-test.js --base=http://localhost:3000
 */

const BASE = process.argv.find((a) => a.startsWith('--base='))
  ? process.argv.find((a) => a.startsWith('--base=')).split('=')[1]
  : 'https://retrodex-beryl.vercel.app'

const tests = [
  { name: 'API stats', path: '/api/stats', check: (d) => d.total_games > 0 },
  { name: 'Games list', path: '/api/items?limit=2', check: (d) => Array.isArray(d.items || d) },
  { name: 'Consoles', path: '/api/consoles', check: (d) => Array.isArray(d.consoles || d) },
  { name: 'Franchises', path: '/api/franchises', check: (d) => Array.isArray(d) || Array.isArray(d.franchises) },
  { name: 'Search', path: '/api/dex/search?q=zelda', check: (d) => d != null },
  { name: 'Collection stats', path: '/api/collection/stats', check: (d) => d != null },
  { name: 'Collection cockpit', path: '/api/collection/cockpit', check: (d) => d.fix_now != null || d.sell_candidates != null },
  { name: 'Prices recent', path: '/api/prices/recent', check: (d) => d != null },
  { name: 'Hub page', path: '/hub.html', check: (_, raw) => raw.includes('hub-search-input') },
  { name: 'Collection page', path: '/collection.html', check: (_, raw) => raw.includes('collection-cockpit-shell') },
  { name: 'Game detail page', path: '/game-detail.html', check: (_, raw) => raw.includes('Lecture principale') },
  { name: 'zones.css', path: '/zones.css', check: (_, raw) => raw.includes('data-zone') },
  { name: 'animations.js', path: '/js/animations.js', check: (_, raw) => raw.includes('rollTo') },
  { name: 'codec.js', path: '/js/codec.js', check: (_, raw) => raw.includes('rdx-codec') },
]

async function runTest(test) {
  const url = `${BASE}${test.path}`
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json, text/html' } })
    if (!res.ok) return { name: test.name, pass: false, error: `HTTP ${res.status}` }

    const contentType = res.headers.get('content-type') || ''
    const raw = await res.text()
    let data = null
    if (contentType.includes('json')) {
      try { data = JSON.parse(raw) } catch (_) {}
    }

    const pass = test.check(data, raw)
    return { name: test.name, pass: !!pass, error: pass ? null : 'Check failed' }
  } catch (err) {
    return { name: test.name, pass: false, error: err.message }
  }
}

async function run() {
  console.log(`\n  RETRODEX SMOKE TEST`)
  console.log(`  Target: ${BASE}`)
  console.log(`  Tests:  ${tests.length}\n`)

  const results = []
  for (const test of tests) {
    const result = await runTest(test)
    results.push(result)
    const icon = result.pass ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'
    console.log(`  [${icon}] ${result.name}${result.error && !result.pass ? ` — ${result.error}` : ''}`)
  }

  const passed = results.filter((r) => r.pass).length
  const failed = results.filter((r) => !r.pass).length
  console.log(`\n  ${passed}/${results.length} passed${failed ? `, ${failed} FAILED` : ''}\n`)

  process.exit(failed > 0 ? 1 : 0)
}

run()
