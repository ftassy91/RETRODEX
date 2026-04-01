'use strict'

const {
  PASS1_KEY,
  TARGET_MIN_PER_CONSOLE,
  TARGET_MAX_PER_CONSOLE,
} = require('./constants')
const {
  loadMediaCountersMap,
  loadTargetConsoleIds,
  loadGamesByConsole,
  loadExistingStateMaps,
} = require('./dataset-loaders')
const {
  buildEvaluatedEntry,
  applyTargetStatus,
} = require('./dataset-evaluator')
const {
  buildConsoleMatrixAndRanks,
  buildPersistableRows,
} = require('./dataset-assembly')

async function buildPass1CurationDataset({
  passKey = PASS1_KEY,
  targetMinPerConsole = TARGET_MIN_PER_CONSOLE,
  targetMaxPerConsole = TARGET_MAX_PER_CONSOLE,
  selectionBand = null,
} = {}) {
  const selectionIds = Array.isArray(selectionBand?.ids) ? selectionBand.ids : []
  const targetConsoleIds = await loadTargetConsoleIds(selectionIds)
  const [games, mediaCounters, existing] = await Promise.all([
    loadGamesByConsole(targetConsoleIds, selectionIds),
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

    gamesByConsole.get(consoleId).push(
      buildEvaluatedEntry({
        consoleId,
        game,
        mediaCounters,
        existing,
      })
    )
  }

  const evaluatedById = new Map()
  for (const entries of gamesByConsole.values()) {
    for (const entry of entries) {
      evaluatedById.set(String(entry.game.id), entry)
    }
  }

  const { consoleMatrix, targetRankByGameId } = buildConsoleMatrixAndRanks(
    targetConsoleIds,
    gamesByConsole,
    targetMinPerConsole,
    targetMaxPerConsole
  )

  for (const consoleId of targetConsoleIds) {
    const consoleEntries = gamesByConsole.get(String(consoleId)) || []
    const targetIds = new Set(
      consoleEntries
        .filter((entry) => targetRankByGameId.has(String(entry.game.id)))
        .map((entry) => String(entry.game.id))
    )

    for (const entry of consoleEntries) {
      evaluatedById.set(String(entry.game.id), applyTargetStatus(entry, targetIds.has(String(entry.game.id))))
    }
  }

  const rows = buildPersistableRows({
    evaluatedById,
    consoleMatrix,
    existing,
    passKey,
    targetRankByGameId,
  })

  return {
    passKey,
    generatedAt: rows.generatedAt,
    selectionBand: selectionBand
      ? {
        path: selectionBand.path || null,
        label: selectionBand.label || null,
        generatedAt: selectionBand.generatedAt || null,
        selectedIds: selectionIds.length,
      }
      : null,
    targetConsoleIds,
    consoleMatrix,
    profiles: rows.profiles,
    states: rows.states,
    events: rows.events,
    publicationSlots: rows.publicationSlots,
  }
}

module.exports = {
  loadMediaCountersMap,
  loadTargetConsoleIds,
  loadGamesByConsole,
  loadExistingStateMaps,
  buildPass1CurationDataset,
}
