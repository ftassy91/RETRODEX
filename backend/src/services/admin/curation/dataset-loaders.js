'use strict'

const { QueryTypes } = require('sequelize')

const { sequelize } = require('../../../database')
const Game = require('../../../models/Game')
const { listConsoleItems } = require('../console-service')
const { listHydratedGames, getSelectableGameAttributes } = require('../game-read-service')
const { tableExists } = require('../../publication-service')
const { PASS1_KEY } = require('./constants')

async function loadMediaCountersMap() {
  if (!(await tableExists('media_references'))) {
    return new Map()
  }

  const rows = await sequelize.query(
    `SELECT entity_id AS gameId,
            LOWER(media_type) AS mediaType,
            COUNT(*) AS totalCount,
            SUM(CASE WHEN COALESCE(ui_allowed, 1) = 1
                       AND LOWER(COALESCE(license_status, 'reference_only')) <> 'blocked'
                     THEN 1 ELSE 0 END) AS validCount,
            SUM(CASE WHEN LOWER(COALESCE(healthcheck_status, 'ok')) IN ('broken', 'timeout')
                     THEN 1 ELSE 0 END) AS brokenCount,
            SUM(CASE WHEN LOWER(COALESCE(license_status, 'reference_only')) = 'blocked'
                     THEN 1 ELSE 0 END) AS blockedCount,
            SUM(CASE WHEN LOWER(COALESCE(license_status, 'reference_only')) = 'review_required'
                     THEN 1 ELSE 0 END) AS reviewCount
     FROM media_references
     WHERE entity_type = 'game'
     GROUP BY entity_id, LOWER(media_type)`,
    { type: QueryTypes.SELECT }
  )

  const map = new Map()
  for (const row of rows) {
    const gameId = String(row.gameId || '')
    if (!gameId) {
      continue
    }
    if (!map.has(gameId)) {
      map.set(gameId, {})
    }
    map.get(gameId)[String(row.mediaType || '')] = {
      total: Number(row.totalCount || 0),
      valid: Number(row.validCount || 0),
      broken: Number(row.brokenCount || 0),
      blocked: Number(row.blockedCount || 0),
      reviewOnly: Number(row.reviewCount || 0),
    }
  }

  return map
}

async function loadTargetConsoleIds() {
  const consoles = await listConsoleItems()
  return consoles
    .filter((entry) => Number(entry.gamesCount || 0) > 0)
    .map((entry) => String(entry.id))
}

async function loadGamesByConsole(targetConsoleIds) {
  const selectableAttributes = await getSelectableGameAttributes([
    'id',
    'title',
    'console',
    'consoleId',
    'year',
    'developer',
    'developerId',
    'publisherId',
    'genre',
    'metascore',
    'rarity',
    'summary',
    'synopsis',
    'tagline',
    'cover_url',
    'coverImage',
    'dev_anecdotes',
    'dev_team',
    'cheat_codes',
    'source_confidence',
    'loosePrice',
    'cibPrice',
    'mintPrice',
    'releaseDate',
    'lore',
    'gameplay_description',
    'characters',
    'manual_url',
    'ost_composers',
    'ost_notable_tracks',
    'versions',
    'avg_duration_main',
    'avg_duration_complete',
    'speedrun_wr',
    'slug',
  ])

  const rows = await Game.findAll({
    where: {
      type: 'game',
      consoleId: targetConsoleIds,
    },
    attributes: selectableAttributes,
  })

  const payload = await listHydratedGames({
    limit: 5000,
    offset: 0,
    ids: rows.map((row) => row.get('id')),
    publishedOnly: false,
  })

  return payload.items || []
}

async function loadExistingStateMaps(passKey = PASS1_KEY) {
  const [hasStates, hasEvents, hasSlots, hasProfiles] = await Promise.all([
    tableExists('game_curation_states'),
    tableExists('game_curation_events'),
    tableExists('console_publication_slots'),
    tableExists('game_content_profiles'),
  ])

  const [states, events, slots, profiles] = await Promise.all([
    hasStates
      ? sequelize.query(
        `SELECT * FROM game_curation_states WHERE pass_key = :passKey`,
        { replacements: { passKey }, type: QueryTypes.SELECT }
      )
      : Promise.resolve([]),
    hasEvents
      ? sequelize.query('SELECT * FROM game_curation_events', { type: QueryTypes.SELECT })
      : Promise.resolve([]),
    hasSlots
      ? sequelize.query(
        `SELECT * FROM console_publication_slots WHERE pass_key = :passKey`,
        { replacements: { passKey }, type: QueryTypes.SELECT }
      )
      : Promise.resolve([]),
    hasProfiles
      ? sequelize.query('SELECT * FROM game_content_profiles', { type: QueryTypes.SELECT })
      : Promise.resolve([]),
  ])

  return {
    stateMap: new Map((states || []).map((row) => [String(row.game_id), row])),
    eventKeySet: new Set((events || []).map((row) => String(row.event_key || '')).filter(Boolean)),
    slotMap: new Map((slots || []).map((row) => [String(row.game_id), row])),
    profileMap: new Map((profiles || []).map((row) => [String(row.game_id), row])),
  }
}

module.exports = {
  loadMediaCountersMap,
  loadTargetConsoleIds,
  loadGamesByConsole,
  loadExistingStateMaps,
}
