'use strict'
// DATA: Sequelize via ../../database and ../../models - not part of the canonical public runtime
// ROLE: enrichment and curation heuristics for back-office selection workflows
// CONSUMERS: enrichment-backlog-service and dedicated curation tests
// STATUS: retained non-canonical service; split only inside a dedicated enrichment lot

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const { QueryTypes } = require('sequelize')

const { sequelize } = require('../../database')
const Game = require('../../models/Game')
const { listConsoleItems } = require('./console-service')
const { listHydratedGames, getSelectableGameAttributes } = require('./game-read-service')
const { tableExists } = require('../publication-service')

const AUDIT_OUTPUT_DIR = path.resolve(__dirname, '../../../data/audit')

const PASS1_KEY = 'pass1-premium-encyclopedic'
const PROFILE_VERSION = 'pass1-heuristic-v1'
const CONTENT_VERSION = 'pass1-content-v1'
const LOCK_THRESHOLD = 0.9
const TARGET_MIN_PER_CONSOLE = 10
const TARGET_MAX_PER_CONSOLE = 20

const PROFILE_KEYS = [
  'overview',
  'lore',
  'characters',
  'maps',
  'vehicles',
  'ost',
  'manuals',
  'sprites',
  'screenshots',
  'codes',
  'records',
  'credits',
]

const NARRATIVE_GENRES = ['rpg', 'role-playing', 'jrpg', 'adventure', 'action adventure', 'metroidvania', 'visual novel']
const CHARACTER_GENRES = ['rpg', 'role-playing', 'fighting', 'beat', 'adventure', 'platform', 'tactical']
const VEHICLE_GENRES = ['racing', 'driving', 'flight', 'vehicular', 'vehicle', 'f1', 'combat flight']
const LOW_LORE_GENRES = ['sports', 'puzzle', 'board', 'card', 'trivia', 'party', 'quiz']
const LOW_OST_GENRES = ['sports', 'board', 'card', 'quiz']

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function parseMaybeJson(value, fallback = null) {
  if (value == null || value === '') {
    return fallback
  }
  if (Array.isArray(value) || typeof value === 'object') {
    return value
  }
  if (typeof value !== 'string') {
    return fallback
  }
  try {
    return JSON.parse(value)
  } catch (_error) {
    return fallback
  }
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex')
}

function countStructuredEntries(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).length
  }
  if (value && typeof value === 'object') {
    return Object.keys(value).length
  }
  if (typeof value === 'string') {
    return value.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean).length
  }
  return 0
}

function hasSubstantiveText(value, minimumLength = 80) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text.length >= minimumLength
}

function hasGenreMatch(game, candidates = []) {
  const haystack = normalizeText(game?.genre)
  return candidates.some((candidate) => haystack.includes(normalizeText(candidate)))
}

function buildConsoleKey(record) {
  return String(record?.id || record?.consoleId || record?.slug || record?.name || '')
}

function toBooleanProfile(profile = {}) {
  return PROFILE_KEYS.reduce((acc, key) => {
    acc[key] = Boolean(profile[key])
    return acc
  }, {})
}

function emptyMediaCounters() {
  return {
    total: 0,
    valid: 0,
    broken: 0,
    blocked: 0,
    reviewOnly: 0,
  }
}

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

function getMediaCounters(mediaMap, gameId, mediaType) {
  const bucket = mediaMap.get(String(gameId || '')) || {}
  return bucket[String(mediaType || '').toLowerCase()] || emptyMediaCounters()
}

function buildHeuristicContentProfile(game, context = {}) {
  const media = context.media || {}
  const profile = {
    overview: true,
    lore: !hasGenreMatch(game, LOW_LORE_GENRES) && (
      hasGenreMatch(game, NARRATIVE_GENRES)
      || hasSubstantiveText(game?.lore, 80)
      || hasSubstantiveText(game?.synopsis, 80)
    ),
    characters: hasGenreMatch(game, CHARACTER_GENRES) || countStructuredEntries(parseMaybeJson(game?.characters, [])) > 0,
    maps: Number(media.maps?.valid || media.map?.valid || 0) > 0,
    vehicles: hasGenreMatch(game, VEHICLE_GENRES),
    ost: !hasGenreMatch(game, LOW_OST_GENRES) && (
      countStructuredEntries(parseMaybeJson(game?.ost_composers, [])) > 0
      || countStructuredEntries(parseMaybeJson(game?.ost_notable_tracks, [])) > 0
    ),
    manuals: Number(media.manuals?.valid || 0) > 0 || Number(media.manual?.valid || 0) > 0 || Boolean(game?.manual_url),
    sprites: Number(media.sprites?.valid || 0) > 0 || Number(media.sprite_sheet?.valid || 0) > 0,
    screenshots: false,
    codes: countStructuredEntries(parseMaybeJson(game?.cheat_codes, [])) > 0,
    records: Boolean(parseMaybeJson(game?.speedrun_wr)) || Number(context.recordCount || 0) > 0,
    credits: Boolean(game?.developer) || countStructuredEntries(parseMaybeJson(game?.dev_team, [])) > 0,
  }

  return toBooleanProfile(profile)
}

function buildValidationSummary(game, context = {}, profile = {}) {
  const media = context.media || {}
  const normalizedProfile = toBooleanProfile(profile)

  const domainChecks = {
    overview: hasSubstantiveText(game?.summary, 70) || hasSubstantiveText(game?.synopsis, 70),
    lore: hasSubstantiveText(game?.lore, 80) || hasSubstantiveText(game?.synopsis, 100),
    characters: countStructuredEntries(parseMaybeJson(game?.characters, [])) > 0,
    maps: Number(media.map?.valid || media.maps?.valid || 0) > 0,
    vehicles: hasGenreMatch(game, VEHICLE_GENRES),
    ost: (
      countStructuredEntries(parseMaybeJson(game?.ost_composers, [])) > 0
      || countStructuredEntries(parseMaybeJson(game?.ost_notable_tracks, [])) > 0
    ),
    manuals: Boolean(game?.manual_url) || Number(media.manual?.valid || media.manuals?.valid || 0) > 0,
    sprites: Number(media.sprite_sheet?.valid || media.sprites?.valid || 0) > 0,
    screenshots: Number(media.screenshot?.valid || media.screenshots?.valid || 0) > 0,
    codes: countStructuredEntries(parseMaybeJson(game?.cheat_codes, [])) > 0,
    records: Boolean(parseMaybeJson(game?.speedrun_wr)),
    credits: Boolean(game?.developer)
      || countStructuredEntries(parseMaybeJson(game?.dev_team, [])) > 0
      || countStructuredEntries(parseMaybeJson(game?.ost_composers, [])) > 0,
  }

  const reviewItems = []
  const criticalErrors = []

  if (normalizedProfile.maps && Number(media.map?.broken || media.maps?.broken || 0) > 0 && !domainChecks.maps) {
    criticalErrors.push('maps_broken_urls')
  }
  if (normalizedProfile.manuals && Number(media.manual?.broken || media.manuals?.broken || 0) > 0 && !domainChecks.manuals) {
    criticalErrors.push('manuals_broken_urls')
  }
  if (normalizedProfile.sprites && Number(media.sprite_sheet?.broken || media.sprites?.broken || 0) > 0 && !domainChecks.sprites) {
    criticalErrors.push('sprites_broken_urls')
  }
  if (Number(media.scan?.reviewOnly || 0) > 0) {
    reviewItems.push('scan_review_required')
  }
  if (Number(media.screenshot?.reviewOnly || 0) > 0) {
    reviewItems.push('screenshot_review_required')
  }

  const relevantKeys = PROFILE_KEYS.filter((key) => normalizedProfile[key])
  const relevantExpected = relevantKeys.length
  const relevantFilled = relevantKeys.filter((key) => domainChecks[key]).length
  const missingRelevantSections = relevantKeys.filter((key) => !domainChecks[key])
  const completionScore = relevantExpected > 0 ? Number((relevantFilled / relevantExpected).toFixed(4)) : 0
  const thresholdMet = completionScore >= LOCK_THRESHOLD && !missingRelevantSections.length
  const canLock = thresholdMet && !criticalErrors.length

  return {
    domains: domainChecks,
    relevantKeys,
    relevantExpected,
    relevantFilled,
    completionScore,
    missingRelevantSections,
    reviewItems,
    criticalErrors,
    thresholdMet,
    canLock,
  }
}

function computeSelectionScore(game, validation = {}) {
  const quality = game?.quality || {}
  const baseQuality = Number(quality.overallScore || 0)
  const completeness = Number(validation.completionScore || 0) * 100
  const metascore = Number(game?.metascore || 0)
  const sourceConfidence = Math.round(Number(game?.source_confidence || 0) * 100)
  const mediaBonus = (
    (validation.domains?.maps ? 8 : 0)
    + (validation.domains?.manuals ? 5 : 0)
    + (validation.domains?.sprites ? 5 : 0)
    + (validation.domains?.ost ? 5 : 0)
    + (validation.domains?.characters ? 4 : 0)
  )
  const rarityBonus = ({
    LEGENDARY: 6,
    EPIC: 4,
    RARE: 2,
  }[String(game?.rarity || '').toUpperCase()] || 0)

  return Math.round(
    (baseQuality * 0.35)
    + (completeness * 0.35)
    + (metascore * 0.15)
    + (sourceConfidence * 0.10)
    + mediaBonus
    + rarityBonus
  )
}

function deriveLifecycleStatus({ isTarget, validation, previousState, immutableHash }) {
  const previousStatus = String(previousState?.status || '')
  const previousHash = String(previousState?.immutable_hash || '')

  if (previousStatus === 'locked' && previousHash && previousHash !== immutableHash) {
    return 'review'
  }
  if (validation.canLock) {
    return 'locked'
  }
  if (validation.thresholdMet) {
    return 'complete'
  }
  if (isTarget && (validation.criticalErrors.length || validation.reviewItems.length)) {
    return 'review'
  }
  if (isTarget && validation.relevantFilled > 0) {
    return 'in_progress'
  }
  return 'draft'
}

function buildImmutableHash(game, profileEnvelope, validation) {
  return sha256(stableStringify({
    gameId: game.id,
    contentVersion: CONTENT_VERSION,
    profile: profileEnvelope,
    validation: {
      relevantExpected: validation.relevantExpected,
      relevantFilled: validation.relevantFilled,
      completionScore: validation.completionScore,
      missingRelevantSections: validation.missingRelevantSections,
      criticalErrors: validation.criticalErrors,
    },
  }))
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

async function persistPass1Curation(dataset, { passKey = PASS1_KEY } = {}) {
  const transaction = await sequelize.transaction()
  try {
    for (const row of dataset.profiles) {
      await sequelize.query(
        `INSERT INTO game_content_profiles (
          game_id, console_id, profile_version, profile_mode, content_profile_json,
          profile_basis_json, relevant_expected, updated_at
        ) VALUES (
          :game_id, :console_id, :profile_version, :profile_mode, :content_profile_json,
          :profile_basis_json, :relevant_expected, :updated_at
        )
        ON CONFLICT(game_id) DO UPDATE SET
          console_id = excluded.console_id,
          profile_version = excluded.profile_version,
          profile_mode = excluded.profile_mode,
          content_profile_json = excluded.content_profile_json,
          profile_basis_json = excluded.profile_basis_json,
          relevant_expected = excluded.relevant_expected,
          updated_at = excluded.updated_at`,
        { replacements: row, transaction, type: QueryTypes.INSERT }
      )
    }

    for (const row of dataset.states) {
      await sequelize.query(
        `INSERT INTO game_curation_states (
          game_id, console_id, pass_key, status, selection_score, target_rank, is_target,
          completion_score, relevant_expected, relevant_filled, missing_relevant_sections_json,
          critical_errors_json, validation_summary_json, last_validated_at, locked_at,
          published_at, content_version, immutable_hash, updated_at
        ) VALUES (
          :game_id, :console_id, :pass_key, :status, :selection_score, :target_rank, :is_target,
          :completion_score, :relevant_expected, :relevant_filled, :missing_relevant_sections_json,
          :critical_errors_json, :validation_summary_json, :last_validated_at, :locked_at,
          :published_at, :content_version, :immutable_hash, :updated_at
        )
        ON CONFLICT(game_id) DO UPDATE SET
          console_id = excluded.console_id,
          pass_key = excluded.pass_key,
          status = excluded.status,
          selection_score = excluded.selection_score,
          target_rank = excluded.target_rank,
          is_target = excluded.is_target,
          completion_score = excluded.completion_score,
          relevant_expected = excluded.relevant_expected,
          relevant_filled = excluded.relevant_filled,
          missing_relevant_sections_json = excluded.missing_relevant_sections_json,
          critical_errors_json = excluded.critical_errors_json,
          validation_summary_json = excluded.validation_summary_json,
          last_validated_at = excluded.last_validated_at,
          locked_at = excluded.locked_at,
          published_at = excluded.published_at,
          content_version = excluded.content_version,
          immutable_hash = excluded.immutable_hash,
          updated_at = excluded.updated_at`,
        { replacements: row, transaction, type: QueryTypes.INSERT }
      )
    }

    await sequelize.query(
      `UPDATE console_publication_slots
       SET is_active = 0,
           updated_at = :updated_at
       WHERE pass_key = :passKey`,
      {
        replacements: {
          passKey,
          updated_at: dataset.generatedAt,
        },
        transaction,
        type: QueryTypes.UPDATE,
      }
    )

    for (const row of dataset.publicationSlots) {
      await sequelize.query(
        `INSERT INTO console_publication_slots (
          console_id, game_id, pass_key, slot_rank, is_active, published_at, created_at, updated_at
        ) VALUES (
          :console_id, :game_id, :pass_key, :slot_rank, :is_active, :published_at, :published_at, :published_at
        )
        ON CONFLICT(pass_key, game_id) DO UPDATE SET
          console_id = excluded.console_id,
          slot_rank = excluded.slot_rank,
          is_active = excluded.is_active,
          published_at = excluded.published_at,
          updated_at = excluded.updated_at`,
        { replacements: row, transaction, type: QueryTypes.INSERT }
      )
    }

    for (const row of dataset.events) {
      await sequelize.query(
        `INSERT INTO game_curation_events (
          event_key, game_id, from_status, to_status, reason, run_key, created_at, diff_summary_json
        ) VALUES (
          :event_key, :game_id, :from_status, :to_status, :reason, :run_key, :created_at, :diff_summary_json
        )
        ON CONFLICT(event_key) DO NOTHING`,
        { replacements: row, transaction, type: QueryTypes.INSERT }
      )
    }

    await transaction.commit()
    return {
      profiles: dataset.profiles.length,
      states: dataset.states.length,
      slots: dataset.publicationSlots.length,
      events: dataset.events.length,
    }
  } catch (error) {
    await transaction.rollback()
    throw error
  }
}

function ensureAuditDir() {
  if (!fs.existsSync(AUDIT_OUTPUT_DIR)) {
    fs.mkdirSync(AUDIT_OUTPUT_DIR, { recursive: true })
  }
}

async function writePass1Reports(dataset) {
  ensureAuditDir()
  const timestamp = String(dataset.generatedAt || new Date().toISOString()).replace(/[:.]/g, '-')
  const summary = {
    passKey: dataset.passKey,
    generatedAt: dataset.generatedAt,
    linkedConsoles: dataset.targetConsoleIds.length,
    profiles: dataset.profiles.length,
    states: dataset.states.length,
    events: dataset.events.length,
    slots: dataset.publicationSlots.length,
    statusCounts: dataset.states.reduce((acc, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1
      return acc
    }, {}),
    underfilledConsoles: dataset.consoleMatrix.filter((row) => row.underfilled).map((row) => row.consoleId),
  }

  const consoleMatrixPath = path.join(AUDIT_OUTPUT_DIR, `${timestamp}_pass1_console_matrix.json`)
  const targetsPath = path.join(AUDIT_OUTPUT_DIR, `${timestamp}_pass1_targets.json`)
  const summaryPath = path.join(AUDIT_OUTPUT_DIR, `${timestamp}_curation_summary.json`)

  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2))
  fs.writeFileSync(consoleMatrixPath, JSON.stringify(dataset.consoleMatrix, null, 2))
  fs.writeFileSync(targetsPath, JSON.stringify({
    states: dataset.states.filter((row) => row.is_target === 1),
    slots: dataset.publicationSlots,
  }, null, 2))

  return {
    summaryPath,
    consoleMatrixPath,
    targetsPath,
  }
}

module.exports = {
  PASS1_KEY,
  PROFILE_VERSION,
  CONTENT_VERSION,
  LOCK_THRESHOLD,
  TARGET_MIN_PER_CONSOLE,
  TARGET_MAX_PER_CONSOLE,
  PROFILE_KEYS,
  buildHeuristicContentProfile,
  buildValidationSummary,
  computeSelectionScore,
  buildPass1CurationDataset,
  persistPass1Curation,
  writePass1Reports,
}
