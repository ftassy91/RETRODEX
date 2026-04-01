'use strict'

const { PROFILE_VERSION, PROFILE_KEYS } = require('./constants')
const {
  getMediaCounters,
  buildHeuristicContentProfile,
  buildValidationSummary,
  computeSelectionScore,
  deriveLifecycleStatus,
  buildImmutableHash,
} = require('./heuristics')

function buildMediaContext(mediaCounters, gameId) {
  return {
    map: getMediaCounters(mediaCounters, gameId, 'map'),
    maps: getMediaCounters(mediaCounters, gameId, 'map'),
    manual: getMediaCounters(mediaCounters, gameId, 'manual'),
    manuals: getMediaCounters(mediaCounters, gameId, 'manual'),
    sprite_sheet: getMediaCounters(mediaCounters, gameId, 'sprite_sheet'),
    sprites: getMediaCounters(mediaCounters, gameId, 'sprite_sheet'),
    screenshot: getMediaCounters(mediaCounters, gameId, 'screenshot'),
    screenshots: getMediaCounters(mediaCounters, gameId, 'screenshot'),
    ending: getMediaCounters(mediaCounters, gameId, 'ending'),
    scan: getMediaCounters(mediaCounters, gameId, 'scan'),
  }
}

function buildProfileEnvelope(game, media) {
  const contentProfile = buildHeuristicContentProfile(game, { media })
  return {
    version: PROFILE_VERSION,
    mode: 'heuristic',
    contentProfile,
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
    relevantExpected: PROFILE_KEYS.filter((key) => contentProfile[key]).length,
  }
}

function buildEvaluatedEntry({ consoleId, game, mediaCounters, existing }) {
  const media = buildMediaContext(mediaCounters, game.id)
  const profileEnvelope = buildProfileEnvelope(game, media)
  const validation = buildValidationSummary(game, { media }, profileEnvelope.contentProfile)
  const selectionScore = computeSelectionScore(game, validation)
  const immutableHash = buildImmutableHash(game, profileEnvelope, validation)

  return {
    game,
    consoleId: String(consoleId),
    media,
    profileEnvelope,
    validation,
    selectionScore,
    immutableHash,
    previousState: existing.stateMap.get(String(game.id)) || null,
  }
}

function applyTargetStatus(entry, isTarget) {
  return {
    ...entry,
    isTarget,
    status: deriveLifecycleStatus({
      isTarget,
      validation: entry.validation,
      previousState: entry.previousState,
      immutableHash: entry.immutableHash,
    }),
  }
}

module.exports = {
  buildMediaContext,
  buildProfileEnvelope,
  buildEvaluatedEntry,
  applyTargetStatus,
}
