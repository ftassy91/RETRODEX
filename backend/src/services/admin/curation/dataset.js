'use strict'

const { QueryTypes } = require('sequelize')

const { sequelize } = require('../../../database')
const Game = require('../../../models/Game')
const { listConsoleItems } = require('../console-service')
const { listHydratedGames, getSelectableGameAttributes } = require('../game-read-service')
const { tableExists } = require('../../publication-service')
const {
  PASS1_KEY,
  PROFILE_VERSION,
  CONTENT_VERSION,
  TARGET_MIN_PER_CONSOLE,
  TARGET_MAX_PER_CONSOLE,
  PROFILE_KEYS,
} = require('./constants')
const {
  emptyMediaCounters,
  getMediaCounters,
  buildHeuristicContentProfile,
  buildValidationSummary,
  computeSelectionScore,
  deriveLifecycleStatus,
  buildImmutableHash,
} = require('./heuristics')

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
      ? sequelize.query(`SELECT * FROM game_curation_events`, { type: QueryTypes.SELECT })
      : Promise.resolve([]),
    hasSlots
      ? sequelize.query(
        `SELECT * FROM console_publication_slots WHERE pass_key = :passKey`,
        { replacements: { passKey }, type: QueryTypes.SELECT }
      )
      : Promise.resolve([]),
    hasProfiles
      ? sequelize.query(`SELECT * FROM game_content_profiles`, { type: QueryTypes.SELECT })
      : Promise.resolve([]),
  ])

  return {
    stateMap: new Map((states || []).map((row) => [String(row.game_id), row])),
    eventKeySet: new Set((events || []).map((row) => String(row.event_key || '')).filter(Boolean)),
    slotMap: new Map((slots || []).map((row) => [String(row.game_id), row])),
    profileMap: new Map((profiles || []).map((row) => [String(row.game_id), row])),
  }
}

async function buildPass1CurationDataset({
  passKey = PASS1_KEY,
  targetMinPerConsole = TARGET_MIN_PER_CONSOLE,
  targetMaxPerConsole = TARGET_MAX_PER_CONSOLE,
} = {}) {
  const targetConsoleIds = await loadTargetConsoleIds()
  const [games, mediaCounters, existing] = await Promise.all([
    loadGamesByConsole(targetConsoleIds),
    loadMediaCountersMap(),
    loadExistingStateMaps(passKey),
  ])

  const gamesByConsole = new Map()
  for (const game of games) {
    const consoleId = String(game.consoleId || '')
    if (!consoleId) {
      continue
    }
    if (!gamesByConsole.has(consoleId)) {
      gamesByConsole.set(consoleId, [])
    }
    gamesByConsole.get(consoleId).push(game)
  }

  const evaluatedById = new Map()
  const consoleMatrix = []
  const targetRankByGameId = new Map()

  for (const consoleId of targetConsoleIds) {
    const consoleGames = (gamesByConsole.get(String(consoleId)) || []).map((game) => {
      const media = {
        map: getMediaCounters(mediaCounters, game.id, 'map'),
        maps: getMediaCounters(mediaCounters, game.id, 'map'),
        manual: getMediaCounters(mediaCounters, game.id, 'manual'),
        manuals: getMediaCounters(mediaCounters, game.id, 'manual'),
        sprite_sheet: getMediaCounters(mediaCounters, game.id, 'sprite_sheet'),
        sprites: getMediaCounters(mediaCounters, game.id, 'sprite_sheet'),
        screenshot: getMediaCounters(mediaCounters, game.id, 'screenshot'),
        screenshots: getMediaCounters(mediaCounters, game.id, 'screenshot'),
        ending: getMediaCounters(mediaCounters, game.id, 'ending'),
        scan: getMediaCounters(mediaCounters, game.id, 'scan'),
      }
      const profile = buildHeuristicContentProfile(game, { media })
      const profileEnvelope = {
        version: PROFILE_VERSION,
        mode: 'heuristic',
        contentProfile: profile,
        profileBasis: {
          genre: game.genre || null,
          mediaSignals: {
            map: media.map.valid,
            manual: media.manual.valid,
            sprite_sheet: media.sprite_sheet.valid,
            screenshot: media.screenshot.valid,
            ending: media.ending.valid,
          },
        },
        relevantExpected: PROFILE_KEYS.filter((key) => profile[key]).length,
      }
      const validation = buildValidationSummary(game, { media }, profile)
      const selectionScore = computeSelectionScore(game, validation)
      const immutableHash = buildImmutableHash(game, profileEnvelope, validation)

      const evaluated = {
        game,
        consoleId: String(consoleId),
        media,
        profileEnvelope,
        validation,
        selectionScore,
        immutableHash,
        previousState: existing.stateMap.get(String(game.id)) || null,
      }
      evaluatedById.set(String(game.id), evaluated)
      return evaluated
    })

    const reachable = consoleGames
      .filter((entry) => entry.validation.canLock || entry.validation.thresholdMet)
      .sort((left, right) => right.selectionScore - left.selectionScore || String(left.game.title || '').localeCompare(String(right.game.title || ''), 'fr', { sensitivity: 'base' }))

    const targetCount = Math.min(targetMaxPerConsole, reachable.length)
    const targetIds = new Set(reachable.slice(0, targetCount).map((entry) => String(entry.game.id)))
    reachable.slice(0, targetCount).forEach((entry, index) => {
      targetRankByGameId.set(String(entry.game.id), index + 1)
    })

    consoleMatrix.push({
      consoleId: String(consoleId),
      totalGames: consoleGames.length,
      viableCandidates: reachable.length,
      targetCount,
      underfilled: reachable.length < targetMinPerConsole,
    })

    for (const entry of consoleGames) {
      entry.isTarget = targetIds.has(String(entry.game.id))
      entry.status = deriveLifecycleStatus({
        isTarget: entry.isTarget,
        validation: entry.validation,
        previousState: entry.previousState,
        immutableHash: entry.immutableHash,
      })
    }
  }

  const publicationSlots = []
  const states = []
  const profiles = []
  const events = []
  const now = new Date().toISOString()

  for (const row of consoleMatrix) {
    const consoleEntries = Array.from(evaluatedById.values())
      .filter((entry) => entry.consoleId === row.consoleId)
      .sort((left, right) => right.selectionScore - left.selectionScore || String(left.game.title || '').localeCompare(String(right.game.title || ''), 'fr', { sensitivity: 'base' }))

    const publishedCandidates = consoleEntries
      .filter((entry) => entry.status === 'locked' && entry.isTarget)
      .slice(0, TARGET_MAX_PER_CONSOLE)

    publishedCandidates.forEach((entry, index) => {
      publicationSlots.push({
        console_id: entry.consoleId,
        game_id: String(entry.game.id),
        pass_key: passKey,
        slot_rank: index + 1,
        is_active: 1,
        published_at: now,
      })
    })
  }

  const publishedSet = new Set(publicationSlots.map((row) => String(row.game_id)))

  for (const entry of evaluatedById.values()) {
    const published = publishedSet.has(String(entry.game.id))
    const status = published ? 'published' : entry.status
    const previousStatus = String(entry.previousState?.status || '')

    profiles.push({
      game_id: String(entry.game.id),
      console_id: entry.consoleId,
      profile_version: entry.profileEnvelope.version,
      profile_mode: entry.profileEnvelope.mode,
      content_profile_json: JSON.stringify(entry.profileEnvelope.contentProfile),
      profile_basis_json: JSON.stringify(entry.profileEnvelope.profileBasis),
      relevant_expected: Number(entry.profileEnvelope.relevantExpected || 0),
      updated_at: now,
    })

    states.push({
      game_id: String(entry.game.id),
      console_id: entry.consoleId,
      pass_key: passKey,
      status,
      selection_score: entry.selectionScore,
      target_rank: entry.isTarget ? (targetRankByGameId.get(String(entry.game.id)) || null) : null,
      is_target: entry.isTarget ? 1 : 0,
      completion_score: entry.validation.completionScore,
      relevant_expected: entry.validation.relevantExpected,
      relevant_filled: entry.validation.relevantFilled,
      missing_relevant_sections_json: JSON.stringify(entry.validation.missingRelevantSections),
      critical_errors_json: JSON.stringify(entry.validation.criticalErrors),
      validation_summary_json: JSON.stringify({
        domains: entry.validation.domains,
        reviewItems: entry.validation.reviewItems,
      }),
      last_validated_at: now,
      locked_at: ['locked', 'published'].includes(status) ? now : null,
      published_at: published ? now : null,
      content_version: CONTENT_VERSION,
      immutable_hash: entry.immutableHash,
      updated_at: now,
    })

    if (previousStatus !== status) {
      const eventKey = `${passKey}::${entry.game.id}::${previousStatus || 'none'}::${status}::${entry.immutableHash}`
      if (!existing.eventKeySet.has(eventKey)) {
        events.push({
          event_key: eventKey,
          game_id: String(entry.game.id),
          from_status: previousStatus || null,
          to_status: status,
          reason: previousStatus === 'locked' && entry.previousState?.immutable_hash !== entry.immutableHash
            ? 'locked_content_changed'
            : 'pass1_state_recomputed',
          run_key: passKey,
          created_at: now,
          diff_summary_json: JSON.stringify({
            completionScore: entry.validation.completionScore,
            missingRelevantSections: entry.validation.missingRelevantSections,
            criticalErrors: entry.validation.criticalErrors,
          }),
        })
      }
    }
  }

  return {
    passKey,
    generatedAt: now,
    targetConsoleIds,
    consoleMatrix,
    profiles,
    states,
    events,
    publicationSlots,
  }
}

module.exports = {
  loadMediaCountersMap,
  loadTargetConsoleIds,
  loadGamesByConsole,
  loadExistingStateMaps,
  buildPass1CurationDataset,
}
