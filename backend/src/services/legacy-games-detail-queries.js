'use strict'
// DATA: Sequelize via ../database - not part of the canonical public runtime
// ROLE: local query helper for legacy-games-detail-service
// CONSUMERS: legacy-games-detail-service only
// STATUS: orphaned legacy retained pending a dedicated removal review

const { QueryTypes } = require('sequelize')
require('../models/associations')

const { sequelize } = require('../database')

async function fetchLocalCompanyRows(game) {
  try {
    const rows = await sequelize.query(
      `SELECT gc.company_id AS id,
              c.name AS name,
              gc.role AS role,
              gc.confidence AS confidence,
              c.country AS country
       FROM game_companies gc
       INNER JOIN companies c ON c.id = gc.company_id
       WHERE gc.game_id = :gameId
       ORDER BY COALESCE(gc.confidence, 0) DESC, c.name ASC`,
      {
        replacements: { gameId: game.id },
        type: QueryTypes.SELECT,
      }
    )

    if (rows.length) {
      return rows
    }
  } catch (_error) {}

  const fallbackIds = [
    { id: game.developerId, role: 'developer' },
    { id: game.publisherId, role: 'publisher' },
  ].filter((entry) => entry.id)

  if (!fallbackIds.length) {
    return []
  }

  try {
    const ids = fallbackIds.map((entry) => entry.id)
    const rows = await sequelize.query(
      `SELECT id, name, country
       FROM companies
       WHERE id IN (:ids)`,
      {
        replacements: { ids },
        type: QueryTypes.SELECT,
      }
    )
    const byId = new Map(rows.map((entry) => [String(entry.id), entry]))

    return fallbackIds
      .map((entry) => {
        const company = byId.get(String(entry.id))
        if (!company) {
          return null
        }

        return {
          id: company.id,
          name: company.name,
          country: company.country || null,
          role: entry.role,
          confidence: 0.7,
          source: 'association_fallback',
        }
      })
      .filter(Boolean)
  } catch (_error) {
    return []
  }
}

async function fetchLocalMediaRows(gameId) {
  try {
    return await sequelize.query(
      `SELECT media_type AS mediaType,
              url,
              provider,
              compliance_status AS complianceStatus,
              storage_mode AS storageMode,
              title,
              preview_url AS previewUrl,
              asset_subtype AS assetSubtype,
              license_status AS licenseStatus,
              ui_allowed AS uiAllowed,
              healthcheck_status AS healthcheckStatus,
              notes,
              source_context AS sourceContext
       FROM media_references
       WHERE entity_type = 'game'
         AND entity_id = :gameId
       ORDER BY CASE WHEN media_type = 'cover' THEN 0 WHEN media_type = 'manual' THEN 1 ELSE 2 END ASC,
                url ASC`,
      {
        replacements: { gameId },
        type: QueryTypes.SELECT,
      }
    )
  } catch (_error) {
    try {
      return await sequelize.query(
        `SELECT media_type AS mediaType,
                url,
                provider,
                compliance_status AS complianceStatus,
                storage_mode AS storageMode
         FROM media_references
         WHERE entity_type = 'game'
           AND entity_id = :gameId
         ORDER BY CASE WHEN media_type = 'cover' THEN 0 WHEN media_type = 'manual' THEN 1 ELSE 2 END ASC,
                  url ASC`,
        {
          replacements: { gameId },
          type: QueryTypes.SELECT,
        }
      )
    } catch (_fallbackError) {
      return []
    }
  }
}

async function fetchLocalEditorialRow(gameId) {
  try {
    const rows = await sequelize.query(
      `SELECT summary,
              synopsis,
              lore,
              gameplay_description AS gameplayDescription,
              characters,
              dev_anecdotes AS devAnecdotes,
              cheat_codes AS cheatCodes,
              versions,
              avg_duration_main AS avgDurationMain,
              avg_duration_complete AS avgDurationComplete,
              speedrun_wr AS speedrunWr
       FROM game_editorial
       WHERE game_id = :gameId
       LIMIT 1`,
      {
        replacements: { gameId },
        type: QueryTypes.SELECT,
      }
    )

    return rows[0] || null
  } catch (_error) {
    try {
      const rows = await sequelize.query(
        `SELECT summary,
                synopsis,
                lore,
                gameplay_description AS gameplayDescription,
                characters,
                cheat_codes AS cheatCodes
         FROM game_editorial
         WHERE game_id = :gameId
         LIMIT 1`,
        {
          replacements: { gameId },
          type: QueryTypes.SELECT,
        }
      )
      return rows[0] || null
    } catch (_fallbackError) {
      return null
    }
  }
}

async function fetchLocalPeopleRows(gameId) {
  try {
    return await sequelize.query(
      `SELECT gp.role AS role,
              gp.billing_order AS billingOrder,
              gp.confidence AS confidence,
              gp.is_inferred AS isInferred,
              p.id AS personId,
              p.name AS name,
              p.normalized_name AS normalizedName
       FROM game_people gp
       INNER JOIN people p ON p.id = gp.person_id
       WHERE gp.game_id = :gameId
       ORDER BY COALESCE(gp.billing_order, 9999) ASC, p.name ASC`,
      {
        replacements: { gameId },
        type: QueryTypes.SELECT,
      }
    )
  } catch (_error) {
    return []
  }
}

async function fetchLocalOstRows(gameId) {
  try {
    return await sequelize.query(
      `SELECT id,
              title,
              confidence,
              needs_release_enrichment AS needsReleaseEnrichment
       FROM ost
       WHERE game_id = :gameId`,
      {
        replacements: { gameId },
        type: QueryTypes.SELECT,
      }
    )
  } catch (_error) {
    try {
      return await sequelize.query(
        `SELECT id,
                name AS title,
                source_confidence AS confidence,
                0 AS needsReleaseEnrichment
         FROM osts
         WHERE game_id = :gameId`,
        {
          replacements: { gameId },
          type: QueryTypes.SELECT,
        }
      )
    } catch (_fallbackError) {
      return []
    }
  }
}

async function fetchLocalOstTracks(gameId) {
  try {
    return await sequelize.query(
      `SELECT o.id AS ostId,
              ot.track_title AS trackTitle,
              ot.track_number AS trackNumber,
              ot.composer_person_id AS composerPersonId,
              ot.confidence AS confidence
       FROM ost_tracks ot
       INNER JOIN ost o ON o.id = ot.ost_id
       WHERE o.game_id = :gameId
       ORDER BY COALESCE(ot.track_number, 9999) ASC, ot.track_title ASC`,
      {
        replacements: { gameId },
        type: QueryTypes.SELECT,
      }
    )
  } catch (_error) {
    return []
  }
}

async function fetchLocalOstReleases(gameId) {
  try {
    return await sequelize.query(
      `SELECT id,
              COALESCE(label, catalog_number, 'OST') AS name,
              NULL AS format,
              NULL AS trackCount,
              NULL AS releaseYear,
              label,
              region_code AS regionCode,
              NULL AS slug,
              confidence AS sourceConfidence
       FROM ost_releases
       WHERE ost_id IN (SELECT id FROM ost WHERE game_id = :gameId)
       ORDER BY COALESCE(release_date, '9999-12-31') ASC, label ASC`,
      {
        replacements: { gameId },
        type: QueryTypes.SELECT,
      }
    )
  } catch (_error) {
    try {
      return await sequelize.query(
        `SELECT id,
                name,
                format,
                track_count AS trackCount,
                release_year AS releaseYear,
                label,
                region_code AS regionCode,
                slug,
                source_confidence AS sourceConfidence
         FROM osts
       WHERE game_id = :gameId
       ORDER BY COALESCE(release_year, 9999) ASC, name ASC`,
        {
          replacements: { gameId },
          type: QueryTypes.SELECT,
        }
      )
    } catch (_fallbackError) {
      return []
    }
  }
}

module.exports = {
  fetchLocalCompanyRows,
  fetchLocalMediaRows,
  fetchLocalEditorialRow,
  fetchLocalPeopleRows,
  fetchLocalOstRows,
  fetchLocalOstTracks,
  fetchLocalOstReleases,
}
