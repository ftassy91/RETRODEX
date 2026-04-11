#!/usr/bin/env node
'use strict'

/**
 * enrich-youtube-ids.js — Search YouTube for gameplay/longplay videos
 *
 * Requires: YOUTUBE_API_KEY in backend/.env (YouTube Data API v3)
 *
 * Usage:
 *   node backend/scripts/enrich-youtube-ids.js --limit=100 --apply
 *   node backend/scripts/enrich-youtube-ids.js --limit=50 --dry-run
 *   node backend/scripts/enrich-youtube-ids.js --rarity=LEGENDARY,EPIC --limit=33 --apply
 *
 * How to get a YouTube API key:
 *   1. Go to https://console.cloud.google.com/
 *   2. Create a project → Enable YouTube Data API v3
 *   3. Create an API key (no OAuth needed for search)
 *   4. Add YOUTUBE_API_KEY=AIza... to backend/.env
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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 10000 }, res => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) } catch (_) { reject(new Error('Invalid JSON')) }
      })
    }).on('error', reject).on('timeout', function () { this.destroy(); reject(new Error('Timeout')) })
  })
}

async function searchYouTube(query, apiKey) {
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=1&videoDuration=long&key=${apiKey}`
  try {
    const data = await fetchJson(url)
    if (data.items && data.items.length > 0) {
      return data.items[0].id.videoId
    }
    return null
  } catch (_) {
    return null
  }
}

async function run() {
  const args = parseArgs(process.argv.slice(2))
  const apiKey = process.env.YOUTUBE_API_KEY
  const limit = Number(args.limit || 100)
  const dryRun = !args.apply
  const rarityFilter = args.rarity ? args.rarity.split(',') : null

  if (!apiKey) {
    console.error('ERROR: YOUTUBE_API_KEY not set in backend/.env')
    console.error('Get one at: https://console.cloud.google.com/ → YouTube Data API v3')
    process.exit(1)
  }

  const { Client } = require('pg')
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()

  let query = `
    SELECT id, title, console
    FROM games
    WHERE type = 'game' AND (youtube_id IS NULL OR youtube_id = '')
  `
  const params = []
  if (rarityFilter) {
    query += ` AND rarity = ANY($1)`
    params.push(rarityFilter)
  }
  query += ` ORDER BY metascore DESC NULLS LAST LIMIT ${Number(limit)}`

  const { rows: candidates } = await client.query(query, params)
  console.log(`YouTube enrichment${dryRun ? ' (DRY-RUN)' : ''}: ${candidates.length} candidates\n`)

  let found = 0, missed = 0

  for (let i = 0; i < candidates.length; i++) {
    const game = candidates[i]
    const searchQuery = `${game.title} ${game.console} gameplay longplay`
    console.log(`  [${i+1}/${candidates.length}] ${game.title} (${game.console})`)

    const videoId = await searchYouTube(searchQuery, apiKey)

    if (videoId) {
      found++
      console.log(`    -> ${videoId}`)
      if (!dryRun) {
        await client.query('UPDATE games SET youtube_id = $2 WHERE id = $1', [game.id, videoId])
      }
    } else {
      missed++
      console.log(`    -> no result`)
    }

    await sleep(200) // YouTube API allows ~10 req/sec
  }

  console.log(`\nResults: ${found} found, ${missed} missed`)
  if (dryRun) console.log('DRY-RUN — use --apply to write')
  await client.end()
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
