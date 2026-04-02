'use strict'

const { CONTENT_VERSION, TARGET_MAX_PER_CONSOLE } = require('./constants')

function sortBySelectionScore(entries = []) {
  return [...entries].sort((left, right) => {
    return right.selectionScore - left.selectionScore
      || String(left.game.title || '').localeCompare(String(right.game.title || ''), 'fr', { sensitivity: 'base' })
  })
}

function buildConsoleMatrixAndRanks(targetConsoleIds, gamesByConsole, targetMinPerConsole, targetMaxPerConsole) {
  const consoleMatrix = []
  const targetRankByGameId = new Map()

  for (const consoleId of targetConsoleIds) {
    const consoleGames = sortBySelectionScore(
      (gamesByConsole.get(String(consoleId)) || []).filter((entry) => entry.validation.canLock || entry.validation.thresholdMet)
    )

    const targetCount = Math.min(targetMaxPerConsole, consoleGames.length)
    const targetIds = new Set(consoleGames.slice(0, targetCount).map((entry) => String(entry.game.id)))
    consoleGames.slice(0, targetCount).forEach((entry, index) => {
      targetRankByGameId.set(String(entry.game.id), index + 1)
    })

    consoleMatrix.push({
      consoleId: String(consoleId),
      totalGames: (gamesByConsole.get(String(consoleId)) || []).length,
      viableCandidates: consoleGames.length,
      targetCount,
      underfilled: consoleGames.length < targetMinPerConsole,
    })
  }

  return { consoleMatrix, targetRankByGameId }
}

function buildPersistableRows({ evaluatedById, consoleMatrix, existing, passKey, targetRankByGameId }) {
  const now = new Date().toISOString()
  const publicationSlots = []
  const states = []
  const profiles = []
  const events = []

  for (const row of consoleMatrix) {
    const consoleEntries = sortBySelectionScore(
      Array.from(evaluatedById.values()).filter((entry) => entry.consoleId === row.consoleId)
    )

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
    generatedAt: now,
    profiles,
    states,
    events,
    publicationSlots,
  }
}

module.exports = {
  sortBySelectionScore,
  buildConsoleMatrixAndRanks,
  buildPersistableRows,
}
