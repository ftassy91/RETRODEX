#!/usr/bin/env node
'use strict'

const path = require('path')
const Database = require('better-sqlite3')
const { writeGeneratedManifest } = require('./_manifest-output-common')

const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')
const SPEEDRUN_API_ROOT = 'https://www.speedrun.com/api/v1'

function parseStringFlag(argv, name, fallback = null) {
  const token = argv.find((value) => String(value).startsWith(`--${name}=`))
  if (!token) return fallback
  return String(token).split('=').slice(1).join('=').trim() || fallback
}

function parseNumberFlag(argv, name, fallback) {
  const token = argv.find((value) => String(value).startsWith(`--${name}=`))
  if (!token) return fallback
  const numeric = Number(String(token).split('=').slice(1).join('='))
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback
}

function parseIds(argv) {
  const token = argv.find((value) => String(value).startsWith('--ids='))
  if (!token) return []
  return Array.from(new Set(String(token).slice('--ids='.length).split(',').map((value) => value.trim()).filter(Boolean)))
}

function buildBatchKey(prefix) {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
  return `${prefix}_${stamp}`
}

function normalizeTitle(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatDuration(seconds) {
  const total = Number(seconds)
  if (!Number.isFinite(total) || total < 0) return ''
  const wholeSeconds = Math.round(total)
  const hours = Math.floor(wholeSeconds / 3600)
  const minutes = Math.floor((wholeSeconds % 3600) / 60)
  const secs = wholeSeconds % 60
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      'accept': 'application/json',
      'user-agent': 'RetroDex Competitive Generator/1.0',
    },
  })

  if (!response.ok) {
    throw new Error(`Speedrun API request failed (${response.status}) for ${url}`)
  }

  return response.json()
}

function readLocalGames(gameIds) {
  const db = new Database(SQLITE_PATH, { readonly: true })
  try {
    const rows = db.prepare(`
      SELECT id, title, console, genre, speedrun_wr
      FROM games
      WHERE id IN (${gameIds.map(() => '?').join(', ')})
        AND type = 'game'
      ORDER BY title ASC
    `).all(...gameIds)

    const rowMap = new Map(rows.map((row) => [String(row.id), row]))
    const missing = gameIds.filter((id) => !rowMap.has(String(id)))
    if (missing.length) {
      throw new Error(`Unknown local game ids: ${missing.join(', ')}`)
    }

    return gameIds.map((id) => rowMap.get(String(id)))
  } finally {
    db.close()
  }
}

function scoreCandidate(localGame, remoteGame) {
  const localTitle = normalizeTitle(localGame.title)
  const remoteTitle = normalizeTitle(remoteGame?.names?.international || '')
  if (!localTitle || !remoteTitle) return 0
  if (localTitle === remoteTitle) return 0.97
  if (localTitle.includes(remoteTitle) || remoteTitle.includes(localTitle)) return 0.82
  return 0
}

async function findBestSpeedrunGame(localGame) {
  const query = encodeURIComponent(localGame.title)
  const payload = await fetchJson(`${SPEEDRUN_API_ROOT}/games?name=${query}&max=10`)
  const candidates = Array.isArray(payload?.data) ? payload.data : []

  const scored = candidates
    .map((candidate) => ({
      candidate,
      score: scoreCandidate(localGame, candidate),
    }))
    .filter((entry) => entry.score >= 0.8)
    .sort((left, right) => right.score - left.score)

  return scored[0] || null
}

async function fetchCategorySnapshot(gameId, category, topRecords) {
  const leaderboard = await fetchJson(`${SPEEDRUN_API_ROOT}/leaderboards/${gameId}/category/${category.id}?embed=players`)
  const rawRuns = Array.isArray(leaderboard?.data?.runs) ? leaderboard.data.runs.slice(0, topRecords) : []
  const observedAt = new Date().toISOString()

  const entries = rawRuns.map((entry, index) => {
    const run = entry.run || {}
    const players = Array.isArray(run.players?.data) ? run.players.data : []
    const primaryPlayer = players[0] || run.players?.[0] || null
    const playerHandle = primaryPlayer?.names?.international
      || primaryPlayer?.name
      || primaryPlayer?.id
      || 'Unknown runner'
    const seconds = Number(run.times?.primary_t)
    const scoreDisplay = formatDuration(seconds) || String(run.times?.primary || '').trim()

    if (!scoreDisplay) return null
    return {
      rankPosition: Number(entry.place || index + 1),
      playerHandle,
      scoreRaw: Number.isFinite(seconds) ? String(seconds) : '',
      scoreDisplay,
      achievedAt: run.date || run.submitted || null,
      externalUrl: run.weblink || category.weblink || null,
      sourceName: 'speedrun.com',
      sourceType: 'speedrun_api',
      sourceUrl: category.weblink || null,
      observedAt,
    }
  }).filter(Boolean)

  return {
    id: `recordcat:pending:${category.id}`,
    categoryKey: category.id,
    label: category.name,
    recordKind: 'time',
    valueDirection: 'asc',
    externalUrl: category.weblink || null,
    sourceName: 'speedrun.com',
    sourceType: 'speedrun_api',
    sourceUrl: category.weblink || null,
    observedAt,
    isPrimary: false,
    displayOrder: 0,
    entries,
  }
}

async function buildPayloadEntry(localGame, topCategories, topRecords) {
  const match = await findBestSpeedrunGame(localGame)
  if (!match) {
    return {
      gameId: localGame.id,
      title: localGame.title,
      sourceName: 'speedrun.com',
      sourceType: 'speedrun_api',
      sourceUrl: '',
      notes: `No confident speedrun.com match found for ${localGame.title}`,
      competitiveProfile: null,
      recordCategories: [],
      recordEntries: [],
      primaryProjection: null,
      candidateContext: {
        platform: localGame.console || null,
        genre: localGame.genre || null,
        speedrunMatchConfidence: 0,
      },
    }
  }

  const game = match.candidate
  const categoriesPayload = await fetchJson(`${SPEEDRUN_API_ROOT}/games/${game.id}/categories`)
  const rawCategories = (Array.isArray(categoriesPayload?.data) ? categoriesPayload.data : [])
    .filter((category) => String(category.type || '').toLowerCase() === 'per-game')
    .filter((category) => !category.miscellaneous)
    .slice(0, topCategories)

  const snapshots = []
  for (let index = 0; index < rawCategories.length; index += 1) {
    const snapshot = await fetchCategorySnapshot(game.id, rawCategories[index], topRecords)
    snapshot.id = `recordcat:${localGame.id}:${snapshot.categoryKey}`
    snapshot.gameId = localGame.id
    snapshot.isPrimary = index === 0
    snapshot.displayOrder = index
    snapshots.push(snapshot)
  }

  const recordCategories = snapshots.map(({ entries, ...category }) => category)
  const recordEntries = snapshots.flatMap((category) => category.entries.map((entry) => ({
    ...entry,
    categoryId: category.id,
    gameId: localGame.id,
  })))

  const primaryRecord = recordEntries[0] || null

  return {
    gameId: localGame.id,
    title: localGame.title,
    sourceName: 'speedrun.com',
    sourceType: 'speedrun_api',
    sourceUrl: game.weblink || null,
    notes: `Generated from speedrun.com API for ${localGame.title}`,
    competitiveProfile: {
      speedrunRelevant: true,
      scoreAttackRelevant: false,
      leaderboardRelevant: true,
      achievementCompetitive: false,
      primarySource: 'speedrun.com',
      freshnessCheckedAt: new Date().toISOString(),
      sourceSummary: {
        speedrunGameId: game.id,
        matchedName: game.names?.international || localGame.title,
        matchConfidence: match.score,
        categoriesFetched: recordCategories.length,
      },
    },
    recordCategories,
    recordEntries,
    primaryProjection: primaryRecord ? {
      category: recordCategories[0]?.label || 'Any%',
      value: primaryRecord.scoreDisplay,
      runner: primaryRecord.playerHandle,
      source: 'speedrun.com',
      url: primaryRecord.externalUrl || game.weblink || null,
      metricType: 'time',
      observedAt: primaryRecord.observedAt,
    } : null,
    candidateContext: {
      platform: localGame.console || null,
      genre: localGame.genre || null,
      existingSpeedrunProjection: Boolean(localGame.speedrun_wr),
      speedrunGameId: game.id,
      speedrunMatchConfidence: match.score,
    },
  }
}

async function main() {
  const explicitIds = parseIds(process.argv)
  const batchKey = parseStringFlag(process.argv, 'batch-key', buildBatchKey('generated_competitive_speedrun'))
  const topCategories = parseNumberFlag(process.argv, 'top-categories', 3)
  const topRecords = parseNumberFlag(process.argv, 'top-records', 5)
  const readyIfComplete = process.argv.includes('--ready-if-complete')

  if (!explicitIds.length) {
    throw new Error('Missing required --ids=<game-id,...> for speedrun manifest generation')
  }

  const games = readLocalGames(explicitIds)
  const payload = []
  for (const game of games) {
    payload.push(await buildPayloadEntry(game, topCategories, topRecords))
  }

  const completeCount = payload.filter((entry) => entry.recordCategories.length && entry.recordEntries.length && entry.primaryProjection).length
  const reviewStatus = readyIfComplete && completeCount === payload.length ? 'ready' : 'review_required'
  const manifest = {
    batchKey,
    batchType: 'competitive',
    reviewStatus,
    notes: `Generated competitive batch from speedrun.com API (${payload.length} targets)`,
    generatedFrom: {
      source: 'speedrun.com',
      generatedAt: new Date().toISOString(),
      filters: {
        explicitIds,
        topCategories,
        topRecords,
        readyIfComplete,
      },
    },
    sources: ['speedrun.com'],
    ids: payload.map((entry) => entry.gameId),
    payload,
  }

  const manifestPath = writeGeneratedManifest(batchKey, manifest)
  console.log(JSON.stringify({
    mode: 'generate',
    batchType: 'competitive',
    provider: 'speedrun.com',
    manifestPath,
    reviewStatus,
    targetCount: payload.length,
    completeCount,
    ids: manifest.ids,
  }, null, 2))
}

main().catch((error) => {
  console.error('[generate-competitive-speedrun-batch-manifest]', error && error.stack ? error.stack : error)
  process.exitCode = 1
})
