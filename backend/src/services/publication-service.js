'use strict'

const { QueryTypes } = require('sequelize')

const { sequelize } = require('../database')

function tableNamesMatch(tableName, target) {
  return String(tableName || '').replace(/"/g, '').toLowerCase() === String(target || '').toLowerCase()
}

let tablesPromise = null

async function getTableNames() {
  if (!tablesPromise) {
    tablesPromise = sequelize.getQueryInterface()
      .showAllTables()
      .then((tables) => new Set((tables || []).map((tableName) => String(tableName || '').replace(/"/g, '').toLowerCase())))
      .catch((err) => {
        console.error('[publication] getTableNames failed:', err.message)
        tablesPromise = null // allow retry on next call
        return new Set()
      })
  }

  return tablesPromise
}

async function tableExists(target) {
  const tables = await getTableNames()
  return Array.from(tables).some((tableName) => tableNamesMatch(tableName, target))
}

async function getPublishedGameScope({ passKey = null } = {}) {
  const hasSlots = await tableExists('console_publication_slots')
  if (!hasSlots) {
    return {
      enabled: false,
      passKey: passKey || null,
      ids: [],
      set: new Set(),
      consoleIds: [],
    }
  }

  const hasStates = await tableExists('game_curation_states')
  const rows = hasStates
    ? await sequelize.query(
      `SELECT DISTINCT slots.game_id AS gameId,
              slots.console_id AS consoleId
       FROM console_publication_slots slots
       INNER JOIN game_curation_states states ON states.game_id = slots.game_id
       WHERE slots.is_active = 1
         AND (:passKey IS NULL OR slots.pass_key = :passKey)
         AND states.status IN ('locked', 'published')`,
      {
        replacements: { passKey: passKey || null },
        type: QueryTypes.SELECT,
      }
    )
    : await sequelize.query(
      `SELECT DISTINCT game_id AS gameId,
              console_id AS consoleId
       FROM console_publication_slots
       WHERE is_active = 1
         AND (:passKey IS NULL OR pass_key = :passKey)`,
      {
        replacements: { passKey: passKey || null },
        type: QueryTypes.SELECT,
      }
    )

  const ids = Array.from(new Set((rows || []).map((row) => String(row.gameId || '')).filter(Boolean)))
  const consoleIds = Array.from(new Set((rows || []).map((row) => String(row.consoleId || '')).filter(Boolean)))

  return {
    enabled: true,
    passKey: passKey || null,
    ids,
    set: new Set(ids),
    consoleIds,
  }
}

module.exports = {
  getPublishedGameScope,
  tableExists,
}
