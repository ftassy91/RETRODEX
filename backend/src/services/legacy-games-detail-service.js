'use strict'
// DATA: Sequelize via ../database and legacy local queries - not part of the canonical public runtime
// ROLE: extracted local fallback for the retired flat games detail tree
// CONSUMERS: no active runtime consumer found; paired only with legacy-games-detail-queries.js
// STATUS: orphaned legacy retained pending a dedicated removal review

const { QueryTypes } = require('sequelize')
const {
  parseStoredJson,
  buildProductionPayload,
  buildMediaPayload,
} = require('../helpers/game-knowledge')
const { sequelize } = require('../database')
const {
  fetchLocalCompanyRows,
  fetchLocalMediaRows,
  fetchLocalEditorialRow,
  fetchLocalPeopleRows,
  fetchLocalOstRows,
  fetchLocalOstTracks,
  fetchLocalOstReleases,
} = require('./legacy-games-detail-queries')

async function fetchLocalContentProfileRow(gameId) {
  try {
    const rows = await sequelize.query(
      `SELECT content_profile_json,
              profile_version,
              profile_mode,
              profile_basis_json,
              relevant_expected,
              updated_at
       FROM game_content_profiles
       WHERE game_id = :gameId
       LIMIT 1`,
      {
        replacements: { gameId },
        type: QueryTypes.SELECT,
      }
    )

    return rows[0] || null
  } catch (_error) {
    return null
  }
}

async function fetchLocalKnowledgeDomains(game) {
  const [companyRows, mediaRows, editorial, peopleRows, ostRows, ostTracks, ostReleases] = await Promise.all([
    fetchLocalCompanyRows(game),
    fetchLocalMediaRows(game.id),
    fetchLocalEditorialRow(game.id),
    fetchLocalPeopleRows(game.id),
    fetchLocalOstRows(game.id),
    fetchLocalOstTracks(game.id),
    fetchLocalOstReleases(game.id),
  ])

  const canonicalDevTeam = peopleRows
    .filter((entry) => !String(entry.role || '').toLowerCase().includes('composer'))
    .map((entry) => ({
      personId: entry.personId,
      name: entry.name,
      normalizedName: entry.normalizedName,
      role: entry.role,
      confidence: Number(entry.confidence || 0),
      isInferred: Boolean(entry.isInferred),
    }))

  const canonicalComposers = peopleRows
    .filter((entry) => String(entry.role || '').toLowerCase().includes('composer'))
    .map((entry) => ({
      personId: entry.personId,
      name: entry.name,
      normalizedName: entry.normalizedName,
      role: entry.role,
      confidence: Number(entry.confidence || 0),
      isInferred: Boolean(entry.isInferred),
    }))

  return {
    editorial,
    production: buildProductionPayload({
      game,
      companyRows,
      devTeam: canonicalDevTeam.length ? canonicalDevTeam : (parseStoredJson(game.dev_team, []) || []),
    }),
    media: buildMediaPayload({
      game,
      mediaRows,
    }),
    music: {
      composers: canonicalComposers.length ? canonicalComposers : (parseStoredJson(game.ost_composers, []) || []),
      tracks: ostTracks.length
        ? ostTracks.map((entry) => ({
          ostId: entry.ostId,
          title: entry.trackTitle,
          trackNumber: entry.trackNumber,
          composerPersonId: entry.composerPersonId,
          confidence: Number(entry.confidence || 0),
        }))
        : (parseStoredJson(game.ost_notable_tracks, []) || []),
      releases: ostReleases,
      ostRows,
    },
  }
}

module.exports = {
  fetchLocalContentProfileRow,
  fetchLocalKnowledgeDomains,
}
