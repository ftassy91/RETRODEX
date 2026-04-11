#!/usr/bin/env node
'use strict'

/**
 * enrich-archive-ids.js — Match games to Archive.org playable ROMs
 *
 * Usage:
 *   node backend/scripts/enrich-archive-ids.js --limit=50
 *   node backend/scripts/enrich-archive-ids.js --limit=33 --rarity=LEGENDARY,EPIC
 *   node backend/scripts/enrich-archive-ids.js --dry-run --limit=10
 *   node backend/scripts/enrich-archive-ids.js --apply --limit=50
 */

const path = require('path')
const https = require('https')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

function parseArgs(argv) {
  return argv.reduce((acc, token) => {
    const [rawKey, ...rest] = String(token || '').split('=')
    const key = rawKey.replace(/^--/, '')
    const value = rest.length ? rest.join('=') : true
    if (key) acc[key] = value
    return acc
  }, {})
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 10000 }, res => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (_) { reject(new Error('Invalid JSON')) }
      })
    }).on('error', reject).on('timeout', function () { this.destroy(); reject(new Error('Timeout')) })
  })
}

function normalize(str) {
  return String(str || '').toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function titleMatch(searchTitle, archiveTitle) {
  const a = normalize(searchTitle)
  const b = normalize(archiveTitle)
  if (!a || !b) return false
  if (a === b) return true
  if (b.includes(a)) return true
  if (a.includes(b) && b.length >= a.length * 0.5) return true
  return false
}

async function searchArchive(title, platform) {
  const query = encodeURIComponent(`title:(${title}) AND mediatype:software`)
  const url = `https://archive.org/advancedsearch.php?q=${query}&output=json&rows=5&fl[]=identifier,title,description`

  try {
    const data = await fetchJson(url)
    const docs = data?.response?.docs || []
    if (!docs.length) return null

    // Find best match
    for (const doc of docs) {
      const archiveTitle = doc.title || ''
      if (titleMatch(title, archiveTitle)) {
        return {
          identifier: doc.identifier,
          title: archiveTitle,
        }
      }
    }

    // Fallback: return first result if title is partially in it
    const first = docs[0]
    const firstNorm = normalize(first.title || '')
    const titleNorm = normalize(title)
    if (firstNorm.includes(titleNorm.split(' ')[0]) && titleNorm.split(' ').length <= 3) {
      return { identifier: first.identifier, title: first.title }
    }

    return null
  } catch (err) {
    return null
  }
}

async function run() {
  const args = parseArgs(process.argv.slice(2))
  const limit = Number(args.limit || 50)
  const dryRun = !args.apply
  const rarityFilter = args.rarity ? args.rarity.split(',') : null

  const { Client } = require('pg')
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()

  // Fetch candidates
  let query = `
    SELECT id, title, console, rarity
    FROM games
    WHERE type = 'game' AND (archive_id IS NULL OR archive_id = '')
  `
  const params = []

  if (rarityFilter) {
    query += ` AND rarity = ANY($1)`
    params.push(rarityFilter)
  }

  query += ` ORDER BY
    CASE rarity
      WHEN 'LEGENDARY' THEN 1
      WHEN 'EPIC' THEN 2
      WHEN 'RARE' THEN 3
      WHEN 'UNCOMMON' THEN 4
      ELSE 5
    END,
    title
    LIMIT ${Number(limit)}`

  const { rows: candidates } = await client.query(query, params)
  console.log(`\n  ARCHIVE.ORG ENRICHMENT${dryRun ? ' (DRY-RUN)' : ''}`)
  console.log(`  Candidates: ${candidates.length} | Rarity filter: ${rarityFilter || 'all'}\n`)

  let matched = 0
  let missed = 0

  for (let i = 0; i < candidates.length; i++) {
    const game = candidates[i]
    console.log(`  [${i + 1}/${candidates.length}] ${game.title} (${game.console}) [${game.rarity}]`)

    const result = await searchArchive(game.title, game.console)

    if (result) {
      matched++
      console.log(`    -> MATCH: ${result.identifier} ("${result.title}")`)

      if (!dryRun) {
        await client.query(
          `UPDATE games SET archive_id = $2, archive_verified = true WHERE id = $1`,
          [game.id, result.identifier]
        )
      }
    } else {
      missed++
      console.log(`    -> no match`)
    }

    // Rate limit: 1 second between requests
    if (i < candidates.length - 1) {
      await sleep(1000)
    }
  }

  console.log(`\n  Results: ${matched} matched, ${missed} missed`)
  console.log(`  ${dryRun ? 'DRY-RUN — use --apply to write to database' : `${matched} archive_ids written to database`}`)

  await client.end()
}

run().catch(e => {
  console.error('FATAL:', e.message)
  process.exit(1)
})
