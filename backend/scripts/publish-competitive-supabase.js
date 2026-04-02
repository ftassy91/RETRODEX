#!/usr/bin/env node
'use strict';

const {
  parseArgs,
  parseIdFilter,
  hasTargetGameId,
  createRemoteClient,
  openReadonlySqlite,
  normalizeText,
  normalizeTimestamp,
  parseJsonLike,
  stringifyJson,
  tableExists,
  buildSourceRecordKey,
  fetchRemoteSourceRecords,
  mapBy,
} = require('./_supabase-publish-common');

const APPLY = process.argv.includes('--apply');

function normalizeProfileRow(row) {
  return {
    game_id: String(row.game_id),
    speedrun_relevant: Number(row.speedrun_relevant || 0),
    score_attack_relevant: Number(row.score_attack_relevant || 0),
    leaderboard_relevant: Number(row.leaderboard_relevant || 0),
    achievement_competitive: Number(row.achievement_competitive || 0),
    primary_source: normalizeText(row.primary_source),
    source_summary: stringifyJson(parseJsonLike(row.source_summary, null)),
    source_record_id: row.source_record_id == null ? null : Number(row.source_record_id),
    freshness_checked_at: normalizeTimestamp(row.freshness_checked_at),
  };
}

function normalizeCategoryRow(row) {
  return {
    id: String(row.id),
    game_id: String(row.game_id),
    category_key: normalizeText(row.category_key),
    label: String(row.label),
    record_kind: normalizeText(row.record_kind),
    value_direction: normalizeText(row.value_direction),
    external_url: normalizeText(row.external_url),
    source_name: String(row.source_name),
    source_type: String(row.source_type),
    source_url: normalizeText(row.source_url),
    observed_at: normalizeTimestamp(row.observed_at),
    is_primary: Number(row.is_primary || 0),
    display_order: Number(row.display_order || 0),
    source_record_id: row.source_record_id == null ? null : Number(row.source_record_id),
  };
}

function normalizeEntryRow(row) {
  return {
    id: String(row.id),
    category_id: String(row.category_id),
    game_id: String(row.game_id),
    rank_position: row.rank_position == null ? null : Number(row.rank_position),
    player_handle: normalizeText(row.player_handle),
    score_raw: normalizeText(row.score_raw),
    score_display: String(row.score_display),
    achieved_at: normalizeTimestamp(row.achieved_at),
    external_url: normalizeText(row.external_url),
    source_name: String(row.source_name),
    source_type: String(row.source_type),
    source_url: normalizeText(row.source_url),
    observed_at: normalizeTimestamp(row.observed_at),
    source_record_id: row.source_record_id == null ? null : Number(row.source_record_id),
  };
}

function normalizeAchievementRow(row) {
  return {
    game_id: String(row.game_id),
    source_name: String(row.source_name),
    source_type: String(row.source_type),
    source_url: normalizeText(row.source_url),
    points_total: row.points_total == null ? null : Number(row.points_total),
    achievement_count: row.achievement_count == null ? null : Number(row.achievement_count),
    leaderboard_count: row.leaderboard_count == null ? null : Number(row.leaderboard_count),
    mastery_summary: normalizeText(row.mastery_summary),
    high_score_summary: normalizeText(row.high_score_summary),
    observed_at: normalizeTimestamp(row.observed_at),
    source_record_id: row.source_record_id == null ? null : Number(row.source_record_id),
  };
}

function normalizeProjectionRow(row) {
  return {
    id: String(row.id),
    speedrun_wr: stringifyJson(parseJsonLike(row.speedrun_wr, null)),
  };
}

function buildLocalToRemoteSourceIdMap(sqlite, filterIds, remoteSourceMap) {
  const rows = sqlite.prepare(`
    SELECT *
    FROM source_records
    WHERE entity_type = 'game'
    ORDER BY id ASC
  `).all();

  const map = new Map();
  for (const row of rows) {
    if (filterIds && !hasTargetGameId(filterIds, row.entity_id)) {
      continue;
    }
    const remoteRow = remoteSourceMap.get(buildSourceRecordKey(row));
    if (remoteRow?.id != null) {
      map.set(Number(row.id), Number(remoteRow.id));
    }
  }
  return map;
}

function fetchLocalRows(sqlite, filterIds = null, remoteSourceIdByLocalId = new Map()) {
  const profiles = sqlite.prepare(`
    SELECT *
    FROM game_competitive_profiles
    ORDER BY game_id ASC
  `).all()
    .map(normalizeProfileRow)
    .map((row) => ({
      ...row,
      source_record_id: row.source_record_id == null ? null : (remoteSourceIdByLocalId.get(Number(row.source_record_id)) || null),
    }))
    .filter((row) => !filterIds || hasTargetGameId(filterIds, row.game_id));

  const categories = sqlite.prepare(`
    SELECT *
    FROM game_record_categories
    ORDER BY game_id ASC, display_order ASC, id ASC
  `).all()
    .map(normalizeCategoryRow)
    .map((row) => ({
      ...row,
      source_record_id: row.source_record_id == null ? null : (remoteSourceIdByLocalId.get(Number(row.source_record_id)) || null),
    }))
    .filter((row) => !filterIds || hasTargetGameId(filterIds, row.game_id));

  const entries = sqlite.prepare(`
    SELECT *
    FROM game_record_entries
    ORDER BY game_id ASC, category_id ASC, COALESCE(rank_position, 9999) ASC, id ASC
  `).all()
    .map(normalizeEntryRow)
    .map((row) => ({
      ...row,
      source_record_id: row.source_record_id == null ? null : (remoteSourceIdByLocalId.get(Number(row.source_record_id)) || null),
    }))
    .filter((row) => !filterIds || hasTargetGameId(filterIds, row.game_id));

  const achievements = sqlite.prepare(`
    SELECT *
    FROM game_achievement_profiles
    ORDER BY game_id ASC
  `).all()
    .map(normalizeAchievementRow)
    .map((row) => ({
      ...row,
      source_record_id: row.source_record_id == null ? null : (remoteSourceIdByLocalId.get(Number(row.source_record_id)) || null),
    }))
    .filter((row) => !filterIds || hasTargetGameId(filterIds, row.game_id));

  const projections = sqlite.prepare(`
    SELECT id, speedrun_wr
    FROM games
    WHERE type = 'game'
      AND TRIM(COALESCE(speedrun_wr, '')) <> ''
  `).all()
    .map(normalizeProjectionRow)
    .filter((row) => !filterIds || hasTargetGameId(filterIds, row.id));

  return { profiles, categories, entries, achievements, projections };
}

function profileNeedsUpdate(remoteRow, localRow) {
  return (
    Number(remoteRow.speedrun_relevant || 0) !== Number(localRow.speedrun_relevant || 0)
    || Number(remoteRow.score_attack_relevant || 0) !== Number(localRow.score_attack_relevant || 0)
    || Number(remoteRow.leaderboard_relevant || 0) !== Number(localRow.leaderboard_relevant || 0)
    || Number(remoteRow.achievement_competitive || 0) !== Number(localRow.achievement_competitive || 0)
    || normalizeText(remoteRow.primary_source) !== normalizeText(localRow.primary_source)
    || stringifyJson(parseJsonLike(remoteRow.source_summary, null)) !== localRow.source_summary
    || Number(remoteRow.source_record_id || 0) !== Number(localRow.source_record_id || 0)
    || normalizeTimestamp(remoteRow.freshness_checked_at) !== normalizeTimestamp(localRow.freshness_checked_at)
  );
}

function categoryNeedsUpdate(remoteRow, localRow) {
  return (
    normalizeText(remoteRow.category_key) !== normalizeText(localRow.category_key)
    || normalizeText(remoteRow.label) !== normalizeText(localRow.label)
    || normalizeText(remoteRow.record_kind) !== normalizeText(localRow.record_kind)
    || normalizeText(remoteRow.value_direction) !== normalizeText(localRow.value_direction)
    || normalizeText(remoteRow.external_url) !== normalizeText(localRow.external_url)
    || normalizeText(remoteRow.source_name) !== normalizeText(localRow.source_name)
    || normalizeText(remoteRow.source_type) !== normalizeText(localRow.source_type)
    || normalizeText(remoteRow.source_url) !== normalizeText(localRow.source_url)
    || normalizeTimestamp(remoteRow.observed_at) !== normalizeTimestamp(localRow.observed_at)
    || Number(remoteRow.is_primary || 0) !== Number(localRow.is_primary || 0)
    || Number(remoteRow.display_order || 0) !== Number(localRow.display_order || 0)
    || Number(remoteRow.source_record_id || 0) !== Number(localRow.source_record_id || 0)
  );
}

function entryNeedsUpdate(remoteRow, localRow) {
  return (
    Number(remoteRow.rank_position || 0) !== Number(localRow.rank_position || 0)
    || normalizeText(remoteRow.player_handle) !== normalizeText(localRow.player_handle)
    || normalizeText(remoteRow.score_raw) !== normalizeText(localRow.score_raw)
    || normalizeText(remoteRow.score_display) !== normalizeText(localRow.score_display)
    || normalizeTimestamp(remoteRow.achieved_at) !== normalizeTimestamp(localRow.achieved_at)
    || normalizeText(remoteRow.external_url) !== normalizeText(localRow.external_url)
    || normalizeText(remoteRow.source_name) !== normalizeText(localRow.source_name)
    || normalizeText(remoteRow.source_type) !== normalizeText(localRow.source_type)
    || normalizeText(remoteRow.source_url) !== normalizeText(localRow.source_url)
    || normalizeTimestamp(remoteRow.observed_at) !== normalizeTimestamp(localRow.observed_at)
    || Number(remoteRow.source_record_id || 0) !== Number(localRow.source_record_id || 0)
  );
}

function achievementNeedsUpdate(remoteRow, localRow) {
  return (
    normalizeText(remoteRow.source_name) !== normalizeText(localRow.source_name)
    || normalizeText(remoteRow.source_type) !== normalizeText(localRow.source_type)
    || normalizeText(remoteRow.source_url) !== normalizeText(localRow.source_url)
    || Number(remoteRow.points_total || 0) !== Number(localRow.points_total || 0)
    || Number(remoteRow.achievement_count || 0) !== Number(localRow.achievement_count || 0)
    || Number(remoteRow.leaderboard_count || 0) !== Number(localRow.leaderboard_count || 0)
    || normalizeText(remoteRow.mastery_summary) !== normalizeText(localRow.mastery_summary)
    || normalizeText(remoteRow.high_score_summary) !== normalizeText(localRow.high_score_summary)
    || normalizeTimestamp(remoteRow.observed_at) !== normalizeTimestamp(localRow.observed_at)
    || Number(remoteRow.source_record_id || 0) !== Number(localRow.source_record_id || 0)
  );
}

function projectionNeedsUpdate(remoteRow, localRow) {
  return stringifyJson(parseJsonLike(remoteRow.speedrun_wr, null)) !== localRow.speedrun_wr;
}

async function ensureRemoteSchema(client) {
  await client.query(`ALTER TABLE public.games ADD COLUMN IF NOT EXISTS speedrun_wr jsonb`).catch(() => {});

  await client.query(`
    CREATE TABLE IF NOT EXISTS public.game_competitive_profiles (
      game_id text PRIMARY KEY REFERENCES public.games(id),
      speedrun_relevant boolean NOT NULL DEFAULT false,
      score_attack_relevant boolean NOT NULL DEFAULT false,
      leaderboard_relevant boolean NOT NULL DEFAULT false,
      achievement_competitive boolean NOT NULL DEFAULT false,
      primary_source text,
      source_summary jsonb,
      source_record_id bigint REFERENCES public.source_records(id),
      freshness_checked_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS public.game_record_categories (
      id text PRIMARY KEY,
      game_id text NOT NULL REFERENCES public.games(id),
      category_key text,
      label text NOT NULL,
      record_kind text,
      value_direction text,
      external_url text,
      source_name text NOT NULL,
      source_type text NOT NULL,
      source_url text,
      observed_at timestamptz,
      is_primary boolean NOT NULL DEFAULT false,
      display_order integer NOT NULL DEFAULT 0,
      source_record_id bigint REFERENCES public.source_records(id),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS public.game_record_entries (
      id text PRIMARY KEY,
      category_id text NOT NULL REFERENCES public.game_record_categories(id),
      game_id text NOT NULL REFERENCES public.games(id),
      rank_position integer,
      player_handle text,
      score_raw text,
      score_display text NOT NULL,
      achieved_at timestamptz,
      external_url text,
      source_name text NOT NULL,
      source_type text NOT NULL,
      source_url text,
      observed_at timestamptz,
      source_record_id bigint REFERENCES public.source_records(id),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS public.game_achievement_profiles (
      game_id text PRIMARY KEY REFERENCES public.games(id),
      source_name text NOT NULL,
      source_type text NOT NULL,
      source_url text,
      points_total integer,
      achievement_count integer,
      leaderboard_count integer,
      mastery_summary text,
      high_score_summary text,
      observed_at timestamptz,
      source_record_id bigint REFERENCES public.source_records(id),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await client.query(`CREATE INDEX IF NOT EXISTS idx_competitive_profiles_game_id ON public.game_competitive_profiles(game_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_record_categories_game_id ON public.game_record_categories(game_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_record_entries_game_id ON public.game_record_entries(game_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_record_entries_category_id ON public.game_record_entries(category_id)`);
  await client.query(`GRANT SELECT ON public.game_competitive_profiles TO anon, authenticated, service_role`).catch(() => {});
  await client.query(`GRANT SELECT ON public.game_record_categories TO anon, authenticated, service_role`).catch(() => {});
  await client.query(`GRANT SELECT ON public.game_record_entries TO anon, authenticated, service_role`).catch(() => {});
  await client.query(`GRANT SELECT ON public.game_achievement_profiles TO anon, authenticated, service_role`).catch(() => {});
}

async function fetchRemoteRows(client, tableName, columns) {
  if (!await tableExists(client, tableName)) {
    return [];
  }
  return (await client.query(`SELECT ${columns.join(', ')} FROM public.${tableName}`)).rows;
}

async function fetchRemoteGamesProjection(client) {
  const { rows } = await client.query(`
    SELECT id, speedrun_wr
    FROM public.games
    WHERE type = 'game'
  `);
  return rows;
}

async function upsertProfile(client, row) {
  await client.query(`
    INSERT INTO public.game_competitive_profiles (
      game_id, speedrun_relevant, score_attack_relevant, leaderboard_relevant,
      achievement_competitive, primary_source, source_summary, source_record_id,
      freshness_checked_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,now())
    ON CONFLICT (game_id) DO UPDATE SET
      speedrun_relevant = EXCLUDED.speedrun_relevant,
      score_attack_relevant = EXCLUDED.score_attack_relevant,
      leaderboard_relevant = EXCLUDED.leaderboard_relevant,
      achievement_competitive = EXCLUDED.achievement_competitive,
      primary_source = EXCLUDED.primary_source,
      source_summary = EXCLUDED.source_summary,
      source_record_id = EXCLUDED.source_record_id,
      freshness_checked_at = EXCLUDED.freshness_checked_at,
      updated_at = now()
  `, [
    row.game_id,
    Boolean(row.speedrun_relevant),
    Boolean(row.score_attack_relevant),
    Boolean(row.leaderboard_relevant),
    Boolean(row.achievement_competitive),
    row.primary_source,
    row.source_summary,
    row.source_record_id,
    row.freshness_checked_at,
  ]);
}

async function upsertCategory(client, row) {
  await client.query(`
    INSERT INTO public.game_record_categories (
      id, game_id, category_key, label, record_kind, value_direction, external_url,
      source_name, source_type, source_url, observed_at, is_primary, display_order,
      source_record_id, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now())
    ON CONFLICT (id) DO UPDATE SET
      category_key = EXCLUDED.category_key,
      label = EXCLUDED.label,
      record_kind = EXCLUDED.record_kind,
      value_direction = EXCLUDED.value_direction,
      external_url = EXCLUDED.external_url,
      source_name = EXCLUDED.source_name,
      source_type = EXCLUDED.source_type,
      source_url = EXCLUDED.source_url,
      observed_at = EXCLUDED.observed_at,
      is_primary = EXCLUDED.is_primary,
      display_order = EXCLUDED.display_order,
      source_record_id = EXCLUDED.source_record_id,
      updated_at = now()
  `, [
    row.id, row.game_id, row.category_key, row.label, row.record_kind, row.value_direction,
    row.external_url, row.source_name, row.source_type, row.source_url, row.observed_at,
    Boolean(row.is_primary), row.display_order, row.source_record_id,
  ]);
}

async function upsertEntry(client, row) {
  await client.query(`
    INSERT INTO public.game_record_entries (
      id, category_id, game_id, rank_position, player_handle, score_raw, score_display,
      achieved_at, external_url, source_name, source_type, source_url, observed_at,
      source_record_id, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now())
    ON CONFLICT (id) DO UPDATE SET
      rank_position = EXCLUDED.rank_position,
      player_handle = EXCLUDED.player_handle,
      score_raw = EXCLUDED.score_raw,
      score_display = EXCLUDED.score_display,
      achieved_at = EXCLUDED.achieved_at,
      external_url = EXCLUDED.external_url,
      source_name = EXCLUDED.source_name,
      source_type = EXCLUDED.source_type,
      source_url = EXCLUDED.source_url,
      observed_at = EXCLUDED.observed_at,
      source_record_id = EXCLUDED.source_record_id,
      updated_at = now()
  `, [
    row.id, row.category_id, row.game_id, row.rank_position, row.player_handle, row.score_raw,
    row.score_display, row.achieved_at, row.external_url, row.source_name, row.source_type,
    row.source_url, row.observed_at, row.source_record_id,
  ]);
}

async function upsertAchievement(client, row) {
  await client.query(`
    INSERT INTO public.game_achievement_profiles (
      game_id, source_name, source_type, source_url, points_total, achievement_count,
      leaderboard_count, mastery_summary, high_score_summary, observed_at, source_record_id, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())
    ON CONFLICT (game_id) DO UPDATE SET
      source_name = EXCLUDED.source_name,
      source_type = EXCLUDED.source_type,
      source_url = EXCLUDED.source_url,
      points_total = EXCLUDED.points_total,
      achievement_count = EXCLUDED.achievement_count,
      leaderboard_count = EXCLUDED.leaderboard_count,
      mastery_summary = EXCLUDED.mastery_summary,
      high_score_summary = EXCLUDED.high_score_summary,
      observed_at = EXCLUDED.observed_at,
      source_record_id = EXCLUDED.source_record_id,
      updated_at = now()
  `, [
    row.game_id, row.source_name, row.source_type, row.source_url, row.points_total,
    row.achievement_count, row.leaderboard_count, row.mastery_summary, row.high_score_summary,
    row.observed_at, row.source_record_id,
  ]);
}

async function upsertProjection(client, row) {
  await client.query(`
    UPDATE public.games
    SET speedrun_wr = $1::jsonb,
        updated_at = NOW()
    WHERE id = $2
  `, [row.speedrun_wr, row.id]);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const filterIds = parseIdFilter(args);
  const sqlite = openReadonlySqlite();
  const client = createRemoteClient();
  await client.connect();

  try {
    const remoteSourceRows = await fetchRemoteSourceRecords(client).catch(() => []);
    const remoteSourceMap = mapBy(remoteSourceRows, buildSourceRecordKey);
    const remoteSourceIdByLocalId = buildLocalToRemoteSourceIdMap(sqlite, filterIds, remoteSourceMap);
    const local = fetchLocalRows(sqlite, filterIds, remoteSourceIdByLocalId);

    if (APPLY) {
      await ensureRemoteSchema(client);
    }

    const profilesTableExists = await tableExists(client, 'game_competitive_profiles');
    const categoriesTableExists = await tableExists(client, 'game_record_categories');
    const entriesTableExists = await tableExists(client, 'game_record_entries');
    const achievementsTableExists = await tableExists(client, 'game_achievement_profiles');

    const remoteProfiles = profilesTableExists
      ? await fetchRemoteRows(client, 'game_competitive_profiles', ['game_id', 'speedrun_relevant', 'score_attack_relevant', 'leaderboard_relevant', 'achievement_competitive', 'primary_source', 'source_summary', 'source_record_id', 'freshness_checked_at'])
      : [];
    const remoteCategories = categoriesTableExists
      ? await fetchRemoteRows(client, 'game_record_categories', ['id', 'game_id', 'category_key', 'label', 'record_kind', 'value_direction', 'external_url', 'source_name', 'source_type', 'source_url', 'observed_at', 'is_primary', 'display_order', 'source_record_id'])
      : [];
    const remoteEntries = entriesTableExists
      ? await fetchRemoteRows(client, 'game_record_entries', ['id', 'category_id', 'game_id', 'rank_position', 'player_handle', 'score_raw', 'score_display', 'achieved_at', 'external_url', 'source_name', 'source_type', 'source_url', 'observed_at', 'source_record_id'])
      : [];
    const remoteAchievements = achievementsTableExists
      ? await fetchRemoteRows(client, 'game_achievement_profiles', ['game_id', 'source_name', 'source_type', 'source_url', 'points_total', 'achievement_count', 'leaderboard_count', 'mastery_summary', 'high_score_summary', 'observed_at', 'source_record_id'])
      : [];
    const remoteProjectionRows = await fetchRemoteGamesProjection(client);

    const remoteProfilesMap = mapBy(remoteProfiles, (row) => String(row.game_id));
    const remoteCategoriesMap = mapBy(remoteCategories, (row) => String(row.id));
    const remoteEntriesMap = mapBy(remoteEntries, (row) => String(row.id));
    const remoteAchievementsMap = mapBy(remoteAchievements, (row) => String(row.game_id));
    const remoteProjectionMap = mapBy(remoteProjectionRows, (row) => String(row.id));

    const pendingProfiles = local.profiles.filter((row) => {
      const remoteRow = remoteProfilesMap.get(String(row.game_id));
      return !remoteRow || profileNeedsUpdate(remoteRow, row);
    });
    const pendingCategories = local.categories.filter((row) => {
      const remoteRow = remoteCategoriesMap.get(String(row.id));
      return !remoteRow || categoryNeedsUpdate(remoteRow, row);
    });
    const pendingEntries = local.entries.filter((row) => {
      const remoteRow = remoteEntriesMap.get(String(row.id));
      return !remoteRow || entryNeedsUpdate(remoteRow, row);
    });
    const pendingAchievements = local.achievements.filter((row) => {
      const remoteRow = remoteAchievementsMap.get(String(row.game_id));
      return !remoteRow || achievementNeedsUpdate(remoteRow, row);
    });
    const pendingProjections = local.projections.filter((row) => {
      const remoteRow = remoteProjectionMap.get(String(row.id));
      return !remoteRow || projectionNeedsUpdate(remoteRow, row);
    });

    if (APPLY) {
      for (const row of pendingProfiles) await upsertProfile(client, row);
      for (const row of pendingCategories) await upsertCategory(client, row);
      for (const row of pendingEntries) await upsertEntry(client, row);
      for (const row of pendingAchievements) await upsertAchievement(client, row);
      for (const row of pendingProjections) await upsertProjection(client, row);
    }

    console.log(JSON.stringify({
      mode: APPLY ? 'apply' : 'dry-run',
      filterIds: filterIds ? [...filterIds] : null,
      competitiveProfiles: {
        localRows: local.profiles.length,
        remoteRows: remoteProfiles.length,
        pendingRows: pendingProfiles.length,
      },
      recordCategories: {
        localRows: local.categories.length,
        remoteRows: remoteCategories.length,
        pendingRows: pendingCategories.length,
      },
      recordEntries: {
        localRows: local.entries.length,
        remoteRows: remoteEntries.length,
        pendingRows: pendingEntries.length,
      },
      achievementProfiles: {
        localRows: local.achievements.length,
        remoteRows: remoteAchievements.length,
        pendingRows: pendingAchievements.length,
      },
      projection: {
        localRows: local.projections.length,
        remoteRows: remoteProjectionRows.length,
        pendingUpdates: pendingProjections.length,
      },
      sample: {
        profiles: pendingProfiles.slice(0, 5).map((row) => ({ game_id: row.game_id, primary_source: row.primary_source })),
        categories: pendingCategories.slice(0, 5).map((row) => ({ id: row.id, game_id: row.game_id, label: row.label })),
        entries: pendingEntries.slice(0, 5).map((row) => ({ id: row.id, game_id: row.game_id, score_display: row.score_display })),
        achievements: pendingAchievements.slice(0, 5).map((row) => ({ game_id: row.game_id, source_name: row.source_name })),
        projection: pendingProjections.slice(0, 5).map((row) => ({ id: row.id })),
      },
    }, null, 2));
  } finally {
    sqlite.close();
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error('[publish-competitive-supabase] Failed:', error && error.stack ? error.stack : error);
  process.exit(1);
});
