#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const Database = require('better-sqlite3')
const { writeGeneratedManifest } = require('./_manifest-output-common')

const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')
const API_ROOT = 'https://retroachievements.org/API'

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

function buildBatchKey(prefix) {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
  return `${prefix}_${stamp}`
}

function requireEnv(name) {
  const value = String(process.env[name] || '').trim()
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`)
  }
  return value
}

function readMapping(filePath) {
  const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath)
  if (!fs.existsSync(resolved)) {
    throw new Error(`RA mapping file not found: ${resolved}`)
  }
  const payload = JSON.parse(fs.readFileSync(resolved, 'utf8'))
  if (!Array.isArray(payload) || !payload.length) {
    throw new Error('RA mapping file must contain a non-empty array')
  }
  return payload
}

function readLocalGames(gameIds) {
  const db = new Database(SQLITE_PATH, { readonly: true })
  try {
    const rows = db.prepare(`
      SELECT id, title, console, genre
      FROM games
      WHERE id IN (${gameIds.map(() => '?').join(', ')})
        AND type = 'game'
    `).all(...gameIds)
    const rowMap = new Map(rows.map((row) => [String(row.id), row]))
    const missing = gameIds.filter((id) => !rowMap.has(String(id)))
    if (missing.length) {
      throw new Error(`Unknown local game ids: ${missing.join(', ')}`)
    }
    return rowMap
  } finally {
    db.close()
  }
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      'accept': 'application/json',
      'user-agent': 'RetroDex Competitive Generator/1.0',
    },
  })

  if (!response.ok) {
    throw new Error(`RetroAchievements API request failed (${response.status}) for ${url}`)
  }

  return response.json()
}

function queryString(params) {
  return new URLSearchParams(params).toString()
}

async function fetchLeaderboards(apiKey, gameId, count) {
  return fetchJson(`${API_ROOT}/API_GetGameLeaderboards.php?${queryString({ i: gameId, c: count, y: apiKey })}`)
}

async function fetchLeaderboardEntries(apiKey, leaderboardId, count) {
  return fetchJson(`${API_ROOT}/API_GetLeaderboardEntries.php?${queryString({ i: leaderboardId, c: count, y: apiKey })}`)
}

async function fetchGameRankAndScore(apiKey, gameId) {
  return fetchJson(`${API_ROOT}/API_GetGameRankAndScore.php?${queryString({ g: gameId, t: 0, y: apiKey })}`)
}

async function buildPayloadEntry(apiKey, localGame, mapping, topCategories, topRecords) {
  const leaderboardsPayload = await fetchLeaderboards(apiKey, mapping.retroAchievementsGameId, topCategories)
  const leaderboards = Array.isArray(leaderboardsPayload?.results) ? leaderboardsPayload.results.slice(0, topCategories) : []
  const observedAt = new Date().toISOString()

  const recordCategories = []
  const recordEntries = []

  for (let index = 0; index < leaderboards.length; index += 1) {
    const leaderboard = leaderboards[index]
    const categoryId = `recordcat:${localGame.id}:ra:${leaderboard.id}`
    recordCategories.push({
      id: categoryId,
      gameId: localGame.id,
      categoryKey: `ra-${leaderboard.id}`,
      label: String(leaderboard.title || `Leaderboard ${leaderboard.id}`).trim(),
      recordKind: String(leaderboard.format || 'score').toLowerCase().includes('time') ? 'time' : 'score',
      valueDirection: leaderboard.rankAsc ? 'asc' : 'desc',
      externalUrl: mapping.sourceUrl || `https://retroachievements.org/game/${mapping.retroAchievementsGameId}`,
      sourceName: 'retroachievements',
      sourceType: 'retroachievements_api',
      sourceUrl: mapping.sourceUrl || `https://retroachievements.org/game/${mapping.retroAchievementsGameId}`,
      observedAt,
      isPrimary: index === 0,
      displayOrder: index,
    })

    const leaderboardEntries = await fetchLeaderboardEntries(apiKey, leaderboard.id, topRecords)
    const rows = Array.isArray(leaderboardEntries?.results) ? leaderboardEntries.results : []
    rows.forEach((entry) => {
      recordEntries.push({
        categoryId,
        gameId: localGame.id,
        rankPosition: Number(entry.rank || 0) || null,
        playerHandle: String(entry.user || '').trim(),
        scoreRaw: entry.score == null ? '' : String(entry.score),
        scoreDisplay: String(entry.formattedScore || entry.score || '').trim(),
        achievedAt: entry.dateSubmitted || null,
        externalUrl: mapping.sourceUrl || `https://retroachievements.org/game/${mapping.retroAchievementsGameId}`,
        sourceName: 'retroachievements',
        sourceType: 'retroachievements_api',
        sourceUrl: mapping.sourceUrl || `https://retroachievements.org/game/${mapping.retroAchievementsGameId}`,
        observedAt,
      })
    })
  }

  const highScores = await fetchGameRankAndScore(apiKey, mapping.retroAchievementsGameId)
  const highScoreTop = Array.isArray(highScores) ? highScores[0] : null
  const primaryProjection = recordEntries[0]
    ? {
      category: recordCategories[0]?.label || 'Leaderboard',
      value: recordEntries[0].scoreDisplay,
      runner: recordEntries[0].playerHandle,
      source: 'retroachievements',
      url: mapping.sourceUrl || `https://retroachievements.org/game/${mapping.retroAchievementsGameId}`,
      metricType: recordCategories[0]?.recordKind || 'score',
      observedAt,
    }
    : null

  return {
    gameId: localGame.id,
    title: localGame.title,
    sourceName: 'retroachievements',
    sourceType: 'retroachievements_api',
    sourceUrl: mapping.sourceUrl || `https://retroachievements.org/game/${mapping.retroAchievementsGameId}`,
    notes: `Generated from RetroAchievements API for ${localGame.title}`,
    competitiveProfile: {
      speedrunRelevant: false,
      scoreAttackRelevant: true,
      leaderboardRelevant: true,
      achievementCompetitive: true,
      primarySource: 'retroachievements',
      freshnessCheckedAt: observedAt,
      sourceSummary: {
        retroAchievementsGameId: mapping.retroAchievementsGameId,
        leaderboardsFetched: recordCategories.length,
      },
    },
    recordCategories,
    recordEntries,
    achievementProfile: {
      gameId: localGame.id,
      sourceName: 'retroachievements',
      sourceType: 'retroachievements_api',
      sourceUrl: mapping.sourceUrl || `https://retroachievements.org/game/${mapping.retroAchievementsGameId}`,
      pointsTotal: highScoreTop?.totalScore ?? null,
      achievementCount: null,
      leaderboardCount: recordCategories.length,
      masterySummary: null,
      highScoreSummary: highScoreTop
        ? `Rank #${highScoreTop.rank || '?'} | ${highScoreTop.user || 'Unknown'} | ${highScoreTop.totalScore ?? 0} pts`
        : null,
      observedAt,
    },
    primaryProjection,
    candidateContext: {
      platform: localGame.console || null,
      genre: localGame.genre || null,
      retroAchievementsGameId: mapping.retroAchievementsGameId,
    },
  }
}

async function main() {
  const mappingPath = parseStringFlag(process.argv, 'mapping')
  const batchKey = parseStringFlag(process.argv, 'batch-key', buildBatchKey('generated_competitive_ra'))
  const topCategories = parseNumberFlag(process.argv, 'top-categories', 3)
  const topRecords = parseNumberFlag(process.argv, 'top-records', 5)
  const readyIfComplete = process.argv.includes('--ready-if-complete')

  if (!mappingPath) {
    throw new Error('Missing required --mapping=<json-file> for RetroAchievements manifest generation')
  }

  const apiKey = requireEnv('RETROACHIEVEMENTS_API_KEY')
  const mapping = readMapping(mappingPath)
  const localGames = readLocalGames(mapping.map((entry) => String(entry.gameId)))

  const payload = []
  for (const row of mapping) {
    const localGame = localGames.get(String(row.gameId))
    payload.push(await buildPayloadEntry(apiKey, localGame, row, topCategories, topRecords))
  }

  const completeCount = payload.filter((entry) => entry.recordCategories.length && entry.recordEntries.length).length
  const reviewStatus = readyIfComplete && completeCount === payload.length ? 'ready' : 'review_required'

  const manifest = {
    batchKey,
    batchType: 'competitive',
    reviewStatus,
    notes: `Generated competitive batch from RetroAchievements API (${payload.length} targets)`,
    generatedFrom: {
      source: 'retroachievements',
      generatedAt: new Date().toISOString(),
      filters: {
        mappingPath,
        topCategories,
        topRecords,
        readyIfComplete,
      },
    },
    sources: ['retroachievements'],
    ids: payload.map((entry) => entry.gameId),
    payload,
  }

  const manifestPath = writeGeneratedManifest(batchKey, manifest)
  console.log(JSON.stringify({
    mode: 'generate',
    batchType: 'competitive',
    provider: 'retroachievements',
    manifestPath,
    reviewStatus,
    targetCount: payload.length,
    completeCount,
    ids: manifest.ids,
  }, null, 2))
}

main().catch((error) => {
  console.error('[generate-competitive-ra-batch-manifest]', error && error.stack ? error.stack : error)
  process.exitCode = 1
})
