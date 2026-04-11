#!/usr/bin/env node
'use strict'

/**
 * ingest-transcript.js — Import curated facts from video transcripts
 *
 * Reads JSON files from backend/scripts/transcripts/ and inserts
 * matching facts into game_anecdotes.
 *
 * Usage:
 *   node backend/scripts/ingest-transcript.js
 *   node backend/scripts/ingest-transcript.js --dry-run
 *   node backend/scripts/ingest-transcript.js --file=transcripts/didyouknow-snes.json
 *
 * JSON format:
 *   {
 *     "source_name": "Did You Know Gaming",
 *     "source_url": "https://youtube.com/watch?v=...",
 *     "episode": "Things You Didn't Know About SNES",
 *     "facts": [
 *       {
 *         "slug": "chrono-trigger-super-nintendo",
 *         "text": "Le projet a reuni Sakaguchi, Horii et Toriyama...",
 *         "category": "dev"
 *       }
 *     ]
 *   }
 */

const path = require('path')
const fs = require('fs')
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

const TYPE_MAP = { dev: 'dev', trivia: 'trivia', cultural: 'cultural', market: 'market', history: 'history', easter_egg: 'trivia', production: 'dev', technique: 'trivia', culture: 'cultural', marche: 'market' }

async function run() {
  const args = parseArgs(process.argv.slice(2))
  const dryRun = Boolean(args['dry-run'])
  const transcriptsDir = path.join(__dirname, 'transcripts')

  // Find JSON files
  let files = []
  if (args.file) {
    files = [path.resolve(args.file)]
  } else {
    files = fs.readdirSync(transcriptsDir)
      .filter(f => f.endsWith('.json'))
      .map(f => path.join(transcriptsDir, f))
  }

  if (!files.length) {
    console.log('No transcript JSON files found in', transcriptsDir)
    console.log('See transcripts/README.md for format.')
    return
  }

  const { Client } = require('pg')
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()

  const { rows: validGames } = await client.query("SELECT id FROM games WHERE type = 'game'")
  const validSet = new Set(validGames.map(r => r.id))

  let totalInserted = 0, totalSkipped = 0, totalInvalid = 0

  for (const file of files) {
    console.log(`\n  Processing: ${path.basename(file)}`)
    const data = JSON.parse(fs.readFileSync(file, 'utf8'))
    const sourceName = data.source_name || 'Unknown'
    const sourceUrl = data.source_url || ''
    const episode = data.episode || ''
    const facts = data.facts || []

    let inserted = 0, skipped = 0, invalid = 0

    for (const fact of facts) {
      if (!fact.slug || !fact.text || fact.text.length < 15) { invalid++; continue }
      if (!validSet.has(fact.slug)) { invalid++; continue }

      const mappedType = TYPE_MAP[fact.category] || 'trivia'
      const source = `${sourceName}${episode ? ' — ' + episode : ''}${sourceUrl ? ' (' + sourceUrl + ')' : ''}`

      // Dedup
      const { rows: ex } = await client.query(
        'SELECT 1 FROM game_anecdotes WHERE game_id = $1 AND anecdote_text = $2 LIMIT 1',
        [fact.slug, fact.text]
      )
      if (ex.length) { skipped++; continue }

      if (!dryRun) {
        await client.query(
          'INSERT INTO game_anecdotes (game_id, anecdote_text, anecdote_type, source, baz_intro, validated) VALUES ($1, $2, $3, $4, $5, true)',
          [fact.slug, fact.text, mappedType, source, 'Source verifiee.']
        )
      }
      inserted++
    }

    console.log(`  ${sourceName}: ${inserted} inserted, ${skipped} dupes, ${invalid} invalid`)
    totalInserted += inserted
    totalSkipped += skipped
    totalInvalid += invalid
  }

  console.log(`\nTotal: ${totalInserted} inserted, ${totalSkipped} dupes, ${totalInvalid} invalid`)
  if (dryRun) console.log('DRY-RUN — use without --dry-run to write')

  const { rows: [{ c }] } = await client.query('SELECT count(*)::int as c FROM game_anecdotes')
  console.log('Total anecdotes:', c)
  await client.end()
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
