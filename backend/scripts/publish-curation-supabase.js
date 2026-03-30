#!/usr/bin/env node
'use strict'

const {
  createRemoteClient,
  openReadonlySqlite,
  normalizeText,
  normalizeTimestamp,
  stringifyJson,
  parseJsonLike,
  tableExists,
} = require('./_supabase-publish-common')

const APPLY = process.argv.includes('--apply')
const PASS_KEY = 'pass1-premium-encyclopedic'

function normalizeProfileRow(row) {
  return {
    game_id: String(row.game_id),
    console_id: normalizeText(row.console_id),
    profile_version: String(row.profile_version),
    profile_mode: String(row.profile_mode),
    content_profile_json: stringifyJson(parseJsonLike(row.content_profile_json, {})),
    profile_basis_json: stringifyJson(parseJsonLike(row.profile_basis_json, {})),
    relevant_expected: Number(row.relevant_expected || 0),
    updated_at: normalizeTimestamp(row.updated_at),
  }
}

function normalizeStateRow(row) {
  return {
    game_id: String(row.game_id),
    console_id: normalizeText(row.console_id),
    pass_key: String(row.pass_key),
    status: String(row.status),
    selection_score: row.selection_score == null ? null : Number(row.selection_score),
    target_rank: row.target_rank == null ? null : Number(row.target_rank),
    is_target: Number(row.is_target || 0),
    completion_score: Number(row.completion_score || 0),
    relevant_expected: Number(row.relevant_expected || 0),
    relevant_filled: Number(row.relevant_filled || 0),
    missing_relevant_sections_json: stringifyJson(parseJsonLike(row.missing_relevant_sections_json, [])),
    critical_errors_json: stringifyJson(parseJsonLike(row.critical_errors_json, [])),
    validation_summary_json: stringifyJson(parseJsonLike(row.validation_summary_json, {})),
    last_validated_at: normalizeTimestamp(row.last_validated_at),
    locked_at: normalizeTimestamp(row.locked_at),
    published_at: normalizeTimestamp(row.published_at),
    content_version: normalizeText(row.content_version),
    immutable_hash: normalizeText(row.immutable_hash),
    updated_at: normalizeTimestamp(row.updated_at),
  }
}

function normalizeEventRow(row) {
  return {
    event_key: String(row.event_key),
    game_id: String(row.game_id),
    from_status: normalizeText(row.from_status),
    to_status: String(row.to_status),
    reason: String(row.reason),
    run_key: normalizeText(row.run_key),
    created_at: normalizeTimestamp(row.created_at),
    diff_summary_json: stringifyJson(parseJsonLike(row.diff_summary_json, {})),
  }
}

function normalizeSlotRow(row) {
  return {
    console_id: String(row.console_id),
    game_id: String(row.game_id),
    pass_key: String(row.pass_key),
    slot_rank: Number(row.slot_rank || 0),
    is_active: Number(row.is_active || 0),
    published_at: normalizeTimestamp(row.published_at),
  }
}

function byKey(rows, key) {
  return new Map((rows || []).map((row) => [String(row[key]), row]))
}

function rowChanged(remoteRow, localRow, fields) {
  return fields.some((field) => {
    const remote = remoteRow?.[field] ?? null
    const local = localRow?.[field] ?? null
    return String(remote) !== String(local)
  })
}

async function ensureRemoteSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.game_content_profiles (
      game_id text PRIMARY KEY REFERENCES public.games(id),
      console_id text,
      profile_version text NOT NULL,
      profile_mode text NOT NULL DEFAULT 'heuristic',
      content_profile_json jsonb NOT NULL,
      profile_basis_json jsonb,
      relevant_expected integer NOT NULL DEFAULT 0,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `)

  await client.query(`
    CREATE TABLE IF NOT EXISTS public.game_curation_states (
      game_id text PRIMARY KEY REFERENCES public.games(id),
      console_id text,
      pass_key text NOT NULL,
      status text NOT NULL,
      selection_score numeric,
      target_rank integer,
      is_target boolean NOT NULL DEFAULT false,
      completion_score numeric NOT NULL DEFAULT 0,
      relevant_expected integer NOT NULL DEFAULT 0,
      relevant_filled integer NOT NULL DEFAULT 0,
      missing_relevant_sections_json jsonb,
      critical_errors_json jsonb,
      validation_summary_json jsonb,
      last_validated_at timestamptz,
      locked_at timestamptz,
      published_at timestamptz,
      content_version text,
      immutable_hash text,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `)

  await client.query(`
    CREATE TABLE IF NOT EXISTS public.game_curation_events (
      id bigserial PRIMARY KEY,
      event_key text NOT NULL UNIQUE,
      game_id text NOT NULL REFERENCES public.games(id),
      from_status text,
      to_status text NOT NULL,
      reason text NOT NULL,
      run_key text,
      created_at timestamptz NOT NULL DEFAULT now(),
      diff_summary_json jsonb
    )
  `)

  await client.query(`
    CREATE TABLE IF NOT EXISTS public.console_publication_slots (
      id bigserial PRIMARY KEY,
      console_id text NOT NULL REFERENCES public.consoles(id),
      game_id text NOT NULL REFERENCES public.games(id),
      pass_key text NOT NULL,
      slot_rank integer NOT NULL,
      is_active boolean NOT NULL DEFAULT true,
      published_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(pass_key, game_id)
    )
  `)

  await client.query(`CREATE INDEX IF NOT EXISTS idx_game_curation_states_pass ON public.game_curation_states(pass_key, status)`)
  await client.query(`CREATE INDEX IF NOT EXISTS idx_console_publication_slots_console ON public.console_publication_slots(console_id, pass_key)`)
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_console_publication_slots_active_rank ON public.console_publication_slots(pass_key, console_id, slot_rank) WHERE is_active = true`)
}

async function fetchRemoteRows(client) {
  const profiles = await tableExists(client, 'game_content_profiles')
    ? (await client.query(`SELECT game_id, console_id, profile_version, profile_mode, content_profile_json, profile_basis_json, relevant_expected, updated_at FROM public.game_content_profiles`)).rows.map(normalizeProfileRow)
    : []
  const states = await tableExists(client, 'game_curation_states')
    ? (await client.query(`SELECT game_id, console_id, pass_key, status, selection_score, target_rank, is_target, completion_score, relevant_expected, relevant_filled, missing_relevant_sections_json, critical_errors_json, validation_summary_json, last_validated_at, locked_at, published_at, content_version, immutable_hash, updated_at FROM public.game_curation_states WHERE pass_key = $1`, [PASS_KEY])).rows.map(normalizeStateRow)
    : []
  const events = await tableExists(client, 'game_curation_events')
    ? (await client.query(`SELECT event_key, game_id, from_status, to_status, reason, run_key, created_at, diff_summary_json FROM public.game_curation_events WHERE run_key = $1`, [PASS_KEY])).rows.map(normalizeEventRow)
    : []
  const slots = await tableExists(client, 'console_publication_slots')
    ? (await client.query(`SELECT console_id, game_id, pass_key, slot_rank, is_active, published_at FROM public.console_publication_slots WHERE pass_key = $1`, [PASS_KEY])).rows.map(normalizeSlotRow)
    : []

  return { profiles, states, events, slots }
}

function fetchLocalRows(sqlite) {
  return {
    profiles: sqlite.prepare(`SELECT * FROM game_content_profiles ORDER BY game_id ASC`).all().map(normalizeProfileRow),
    states: sqlite.prepare(`SELECT * FROM game_curation_states WHERE pass_key = ? ORDER BY console_id ASC, selection_score DESC, game_id ASC`).all(PASS_KEY).map(normalizeStateRow),
    events: sqlite.prepare(`SELECT * FROM game_curation_events WHERE run_key = ? ORDER BY created_at ASC, id ASC`).all(PASS_KEY).map(normalizeEventRow),
    slots: sqlite.prepare(`SELECT * FROM console_publication_slots WHERE pass_key = ? ORDER BY console_id ASC, slot_rank ASC`).all(PASS_KEY).map(normalizeSlotRow),
  }
}

async function upsertProfile(client, row) {
  await client.query(`
    INSERT INTO public.game_content_profiles (
      game_id, console_id, profile_version, profile_mode, content_profile_json, profile_basis_json, relevant_expected, updated_at
    ) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8)
    ON CONFLICT (game_id) DO UPDATE SET
      console_id = excluded.console_id,
      profile_version = excluded.profile_version,
      profile_mode = excluded.profile_mode,
      content_profile_json = excluded.content_profile_json,
      profile_basis_json = excluded.profile_basis_json,
      relevant_expected = excluded.relevant_expected,
      updated_at = excluded.updated_at
  `, [row.game_id, row.console_id, row.profile_version, row.profile_mode, row.content_profile_json, row.profile_basis_json, row.relevant_expected, row.updated_at])
}

async function upsertState(client, row) {
  await client.query(`
    INSERT INTO public.game_curation_states (
      game_id, console_id, pass_key, status, selection_score, target_rank, is_target, completion_score,
      relevant_expected, relevant_filled, missing_relevant_sections_json, critical_errors_json,
      validation_summary_json, last_validated_at, locked_at, published_at, content_version, immutable_hash, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb,$14,$15,$16,$17,$18,$19)
    ON CONFLICT (game_id) DO UPDATE SET
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
      updated_at = excluded.updated_at
  `, [row.game_id, row.console_id, row.pass_key, row.status, row.selection_score, row.target_rank, Boolean(row.is_target), row.completion_score, row.relevant_expected, row.relevant_filled, row.missing_relevant_sections_json, row.critical_errors_json, row.validation_summary_json, row.last_validated_at, row.locked_at, row.published_at, row.content_version, row.immutable_hash, row.updated_at])
}

async function insertEvent(client, row) {
  await client.query(`
    INSERT INTO public.game_curation_events (
      event_key, game_id, from_status, to_status, reason, run_key, created_at, diff_summary_json
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
    ON CONFLICT (event_key) DO NOTHING
  `, [row.event_key, row.game_id, row.from_status, row.to_status, row.reason, row.run_key, row.created_at, row.diff_summary_json])
}

async function upsertSlot(client, row) {
  await client.query(`
    INSERT INTO public.console_publication_slots (
      console_id, game_id, pass_key, slot_rank, is_active, published_at, created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$6,$6)
    ON CONFLICT (pass_key, game_id) DO UPDATE SET
      console_id = excluded.console_id,
      slot_rank = excluded.slot_rank,
      is_active = excluded.is_active,
      published_at = excluded.published_at,
      updated_at = excluded.updated_at
  `, [row.console_id, row.game_id, row.pass_key, row.slot_rank, Boolean(row.is_active), row.published_at])
}

async function main() {
  const sqlite = openReadonlySqlite()
  const client = createRemoteClient()
  await client.connect()

  try {
    const local = fetchLocalRows(sqlite)
    if (APPLY) {
      await ensureRemoteSchema(client)
    }
    const remote = await fetchRemoteRows(client)

    const remoteProfiles = byKey(remote.profiles, 'game_id')
    const remoteStates = byKey(remote.states, 'game_id')
    const remoteEvents = byKey(remote.events, 'event_key')
    const remoteSlots = byKey(remote.slots, 'game_id')

    const pendingProfiles = local.profiles.filter((row) => !remoteProfiles.has(row.game_id) || rowChanged(remoteProfiles.get(row.game_id), row, [
      'console_id', 'profile_version', 'profile_mode', 'content_profile_json', 'profile_basis_json', 'relevant_expected',
    ]))
    const pendingStates = local.states.filter((row) => !remoteStates.has(row.game_id) || rowChanged(remoteStates.get(row.game_id), row, [
      'console_id', 'pass_key', 'status', 'selection_score', 'target_rank', 'is_target', 'completion_score',
      'relevant_expected', 'relevant_filled', 'missing_relevant_sections_json', 'critical_errors_json',
      'validation_summary_json', 'last_validated_at', 'locked_at', 'published_at', 'content_version', 'immutable_hash',
    ]))
    const pendingEvents = local.events.filter((row) => !remoteEvents.has(row.event_key))
    const pendingSlots = local.slots.filter((row) => !remoteSlots.has(row.game_id) || rowChanged(remoteSlots.get(row.game_id), row, [
      'console_id', 'pass_key', 'slot_rank', 'is_active', 'published_at',
    ]))
    const staleManagedRows = remote.slots.filter((row) => row.is_active === 1 && !local.slots.some((localRow) => localRow.game_id === row.game_id)).length

    if (APPLY) {
      for (const row of pendingProfiles) await upsertProfile(client, row)
      for (const row of pendingStates) await upsertState(client, row)
      await client.query(`UPDATE public.console_publication_slots SET is_active = false, updated_at = now() WHERE pass_key = $1`, [PASS_KEY])
      for (const row of pendingSlots.length ? local.slots : local.slots) await upsertSlot(client, row)
      for (const row of pendingEvents) await insertEvent(client, row)
    }

    console.log(JSON.stringify({
      mode: APPLY ? 'apply' : 'dry-run',
      passKey: PASS_KEY,
      profiles: {
        localRows: local.profiles.length,
        remoteRows: remote.profiles.length,
        pendingRows: pendingProfiles.length,
      },
      states: {
        localRows: local.states.length,
        remoteRows: remote.states.length,
        pendingRows: pendingStates.length,
      },
      events: {
        localRows: local.events.length,
        remoteRows: remote.events.length,
        pendingRows: pendingEvents.length,
      },
      slots: {
        localRows: local.slots.length,
        remoteRows: remote.slots.length,
        pendingRows: pendingSlots.length,
        staleManagedRows,
      },
    }, null, 2))
  } finally {
    sqlite.close()
    await client.end().catch(() => {})
  }
}

main().catch((error) => {
  console.error('[publish-curation-supabase] Failed:', error && error.stack ? error.stack : error)
  process.exit(1)
})
