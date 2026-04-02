'use strict'

const { QueryTypes } = require('sequelize')

const { sequelize } = require('../../../database')
const { PASS1_KEY } = require('./constants')

async function persistPass1Curation(dataset, { passKey = PASS1_KEY } = {}) {
  const transaction = await sequelize.transaction()
  try {
    for (const row of dataset.profiles) {
      await sequelize.query(
        `INSERT INTO game_content_profiles (
          game_id, console_id, profile_version, profile_mode, content_profile_json,
          profile_basis_json, relevant_expected, updated_at
        ) VALUES (
          :game_id, :console_id, :profile_version, :profile_mode, :content_profile_json,
          :profile_basis_json, :relevant_expected, :updated_at
        )
        ON CONFLICT(game_id) DO UPDATE SET
          console_id = excluded.console_id,
          profile_version = excluded.profile_version,
          profile_mode = excluded.profile_mode,
          content_profile_json = excluded.content_profile_json,
          profile_basis_json = excluded.profile_basis_json,
          relevant_expected = excluded.relevant_expected,
          updated_at = excluded.updated_at`,
        { replacements: row, transaction, type: QueryTypes.INSERT }
      )
    }

    // Clear prior per-console target ranks before reassigning them. Without
    // this reset, SQLite can hit the unique(pass_key, console_id, target_rank)
    // constraint while rows are being updated in-place game by game.
    await sequelize.query(
      `UPDATE game_curation_states
       SET target_rank = NULL,
           is_target = 0,
           updated_at = :updated_at
       WHERE pass_key = :passKey`,
      {
        replacements: {
          passKey,
          updated_at: dataset.generatedAt,
        },
        transaction,
        type: QueryTypes.UPDATE,
      }
    )

    for (const row of dataset.states) {
      await sequelize.query(
        `INSERT INTO game_curation_states (
          game_id, console_id, pass_key, status, selection_score, target_rank, is_target,
          completion_score, relevant_expected, relevant_filled, missing_relevant_sections_json,
          critical_errors_json, validation_summary_json, last_validated_at, locked_at,
          published_at, content_version, immutable_hash, updated_at
        ) VALUES (
          :game_id, :console_id, :pass_key, :status, :selection_score, :target_rank, :is_target,
          :completion_score, :relevant_expected, :relevant_filled, :missing_relevant_sections_json,
          :critical_errors_json, :validation_summary_json, :last_validated_at, :locked_at,
          :published_at, :content_version, :immutable_hash, :updated_at
        )
        ON CONFLICT(game_id) DO UPDATE SET
          console_id = excluded.console_id,
          pass_key = excluded.pass_key,
          status = excluded.status,
          selection_score = excluded.selection_score,
          target_rank = excluded.target_rank,
          is_target = excluded.is_target,
          completion_score = excluded.completion_score,
          relevant_expected = excluded.relevant_expected,
          relevant_filled = excluded.relevant_filled,
          missing_relevant_sections_json = excluded.missing_relevant_sections_json,
          critical_errors_json = excluded.critical_errors_json,
          validation_summary_json = excluded.validation_summary_json,
          last_validated_at = excluded.last_validated_at,
          locked_at = excluded.locked_at,
          published_at = excluded.published_at,
          content_version = excluded.content_version,
          immutable_hash = excluded.immutable_hash,
          updated_at = excluded.updated_at`,
        { replacements: row, transaction, type: QueryTypes.INSERT }
      )
    }

    await sequelize.query(
      `UPDATE console_publication_slots
       SET is_active = 0,
           updated_at = :updated_at
       WHERE pass_key = :passKey`,
      {
        replacements: {
          passKey,
          updated_at: dataset.generatedAt,
        },
        transaction,
        type: QueryTypes.UPDATE,
      }
    )

    for (const row of dataset.publicationSlots) {
      await sequelize.query(
        `INSERT INTO console_publication_slots (
          console_id, game_id, pass_key, slot_rank, is_active, published_at, created_at, updated_at
        ) VALUES (
          :console_id, :game_id, :pass_key, :slot_rank, :is_active, :published_at, :published_at, :published_at
        )
        ON CONFLICT(pass_key, game_id) DO UPDATE SET
          console_id = excluded.console_id,
          slot_rank = excluded.slot_rank,
          is_active = excluded.is_active,
          published_at = excluded.published_at,
          updated_at = excluded.updated_at`,
        { replacements: row, transaction, type: QueryTypes.INSERT }
      )
    }

    for (const row of dataset.events) {
      await sequelize.query(
        `INSERT INTO game_curation_events (
          event_key, game_id, from_status, to_status, reason, run_key, created_at, diff_summary_json
        ) VALUES (
          :event_key, :game_id, :from_status, :to_status, :reason, :run_key, :created_at, :diff_summary_json
        )
        ON CONFLICT(event_key) DO NOTHING`,
        { replacements: row, transaction, type: QueryTypes.INSERT }
      )
    }

    await transaction.commit()
    return {
      profiles: dataset.profiles.length,
      states: dataset.states.length,
      slots: dataset.publicationSlots.length,
      events: dataset.events.length,
    }
  } catch (error) {
    await transaction.rollback()
    throw error
  }
}

module.exports = {
  persistPass1Curation,
}
