'use strict'

module.exports = {
  id: '20260402_010_phase1_normalized_indexes',
  description: 'Phase 1 indexes for game_credits, price_summary, game_ost, game_ost_tracks, competitive_records',
  up: async ({ sequelize }) => {
    // game_credits
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_game_credits_game_id ON game_credits(game_id)')
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_game_credits_entity ON game_credits(credited_entity_type, credited_entity_id)')

    // price_summary
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_price_summary_computed_at ON price_summary(computed_at)')

    // game_ost
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_game_ost_game_id ON game_ost(game_id)')

    // game_ost_tracks
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_game_ost_tracks_ost_id ON game_ost_tracks(ost_id)')

    // competitive_records
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_competitive_records_game_category_rank ON competitive_records(game_id, category_label, rank_position)')
  },

  down: async ({ sequelize }) => {
    await sequelize.query('DROP INDEX IF EXISTS idx_competitive_records_game_category_rank')
    await sequelize.query('DROP INDEX IF EXISTS idx_game_ost_tracks_ost_id')
    await sequelize.query('DROP INDEX IF EXISTS idx_game_ost_game_id')
    await sequelize.query('DROP INDEX IF EXISTS idx_price_summary_computed_at')
    await sequelize.query('DROP INDEX IF EXISTS idx_game_credits_entity')
    await sequelize.query('DROP INDEX IF EXISTS idx_game_credits_game_id')
  },
}
