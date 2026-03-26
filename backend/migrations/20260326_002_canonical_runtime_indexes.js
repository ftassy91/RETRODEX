'use strict'

module.exports = {
  id: '20260326_002_canonical_runtime_indexes',
  description: 'Add runtime indexes for canonical provenance and observation backfills',
  up: async ({ sequelize }) => {
    await sequelize.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_price_observations_source_listing ON price_observations(source_name, listing_reference)'
    )
    await sequelize.query(
      'CREATE INDEX IF NOT EXISTS idx_game_people_game_role ON game_people(game_id, role)'
    )
    await sequelize.query(
      'CREATE INDEX IF NOT EXISTS idx_source_records_entity_field ON source_records(entity_type, entity_id, field_name)'
    )
  },
}
