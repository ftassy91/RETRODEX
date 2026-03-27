'use strict'

module.exports = {
  id: '20260327_001_performance_indexes',
  description: 'Add performance indexes for games table filtering and lookups',
  up: async ({ sequelize }) => {
    await sequelize.query(
      'CREATE INDEX IF NOT EXISTS idx_games_console ON games(console)'
    )
    await sequelize.query(
      'CREATE INDEX IF NOT EXISTS idx_games_rarity ON games(rarity)'
    )
    await sequelize.query(
      'CREATE INDEX IF NOT EXISTS idx_games_slug ON games(slug)'
    )
  },
}
