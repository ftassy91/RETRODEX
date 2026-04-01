'use strict'

const REQUIRED_GAME_COLUMNS = [
  'tagline',
  'cover_url',
  'synopsis',
  'dev_anecdotes',
  'dev_team',
  'cheat_codes',
]

async function describeTableSafe(queryInterface, tableName) {
  try {
    return await queryInterface.describeTable(tableName)
  } catch (_error) {
    return null
  }
}

async function getRuntimeSchemaReport({ sequelize }) {
  const queryInterface = sequelize.getQueryInterface()
  const issues = []

  const gamesColumns = await describeTableSafe(queryInterface, 'games')
  if (!gamesColumns) {
    issues.push({
      type: 'missing_table',
      target: 'games',
      detail: 'Required runtime table `games` is missing.',
    })
  }

  const consolesColumns = await describeTableSafe(queryInterface, 'consoles')
  if (!consolesColumns) {
    issues.push({
      type: 'missing_table',
      target: 'consoles',
      detail: 'Required runtime table `consoles` is missing.',
    })
  }

  const collectionColumns = await describeTableSafe(queryInterface, 'collection_items')
  if (!collectionColumns) {
    issues.push({
      type: 'missing_table',
      target: 'collection_items',
      detail: 'Required runtime table `collection_items` is missing.',
    })
  }

  if (gamesColumns) {
    for (const columnName of REQUIRED_GAME_COLUMNS) {
      if (!gamesColumns[columnName]) {
        issues.push({
          type: 'missing_column',
          target: `games.${columnName}`,
          detail: `Required runtime column \`games.${columnName}\` is missing.`,
        })
      }
    }
  }

  const hasPriceHistory = Boolean(await describeTableSafe(queryInterface, 'price_history'))
  const hasPriceObservations = Boolean(await describeTableSafe(queryInterface, 'price_observations'))
  if (!hasPriceHistory && !hasPriceObservations) {
    issues.push({
      type: 'missing_table',
      target: 'price_history|price_observations',
      detail: 'Runtime price services require `price_history` or `price_observations`.',
    })
  }

  return {
    ok: issues.length === 0,
    issues,
  }
}

async function assertRuntimeSchemaReady({ sequelize }) {
  const report = await getRuntimeSchemaReport({ sequelize })
  if (!report.ok) {
    const rendered = report.issues.map((issue) => `- ${issue.detail}`).join('\n')
    throw new Error(`Runtime schema is not ready.\n${rendered}`)
  }
  return report
}

module.exports = {
  REQUIRED_GAME_COLUMNS,
  assertRuntimeSchemaReady,
  getRuntimeSchemaReport,
}
