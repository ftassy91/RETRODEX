'use strict';

const path = require('path');
const dotenv = require('dotenv');
const Database = require('better-sqlite3');
const { Client } = require('pg');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const APPLY = process.argv.includes('--apply');
const IDS_ARG = process.argv.find((value) => value.startsWith('--ids='));
const FILTER_IDS = IDS_ARG
  ? new Set(IDS_ARG.slice('--ids='.length).split(',').map((value) => value.trim()).filter(Boolean))
  : null;

const JSON_FIELDS = new Set([
  'characters',
  'dev_team',
  'dev_anecdotes',
  'ost_composers',
  'ost_notable_tracks',
  'cheat_codes',
  'versions',
  'speedrun_wr',
]);

const COLUMN_DEFINITIONS = [
  ['slug', 'text'],
  ['lore', 'text'],
  ['gameplay_description', 'text'],
  ['characters', 'jsonb'],
  ['ost_composers', 'jsonb'],
  ['ost_notable_tracks', 'jsonb'],
  ['manual_url', 'text'],
  ['youtube_id', 'text'],
  ['youtube_verified', 'boolean'],
  ['archive_id', 'text'],
  ['archive_verified', 'boolean'],
  ['versions', 'jsonb'],
  ['avg_duration_main', 'numeric'],
  ['avg_duration_complete', 'numeric'],
  ['speedrun_wr', 'jsonb'],
];

function parseProjectReference() {
  const raw =
    process.env.SUPABASE_URL
    || process.env.SUPABASE_Project_URL
    || process.env.SUPERDATA_Project_URL
    || '';
  const match = String(raw).match(/doipqgkhfzqvmzrdfvuq|([a-z0-9]{20})/i);
  return match ? String(match[0]) : '';
}

function buildRemotePgConfig() {
  const projectReference = parseProjectReference();
  const rawUrl = process.env.SUPABASE_Project_URL || process.env.DATABASE_URL || '';
  let password = '';

  const passwordMatch = rawUrl.match(/postgres(?:\.[^:]+)?:\[?([^\]@]+)\]?@/i);
  if (passwordMatch) {
    password = passwordMatch[1];
  }

  if (!projectReference || !password) {
    throw new Error('Missing Supabase pooler configuration. Expected project ref and password in backend/.env.');
  }

  return {
    host: 'aws-1-eu-west-1.pooler.supabase.com',
    port: 6543,
    user: `postgres.${projectReference}`,
    password,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
  };
}

function normalizeText(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();
  return text ? text : null;
}

function isStructuredEmpty(value) {
  if (value === null || value === undefined) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  if (typeof value === 'object') {
    return Object.keys(value).length === 0;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return !trimmed || trimmed === '[]' || trimmed === '{}' || trimmed === 'null';
  }

  return false;
}

function parseJsonLike(value, fallback = null) {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (Array.isArray(value) || typeof value === 'object') {
    return value;
  }

  const text = String(value).trim();
  if (!text) {
    return fallback;
  }

  try {
    return JSON.parse(text);
  } catch (_error) {
    return fallback;
  }
}

function normalizeArrayField(value) {
  const parsed = parseJsonLike(value, null);
  if (Array.isArray(parsed)) {
    return parsed.filter(Boolean);
  }
  if (parsed && typeof parsed === 'object') {
    return [parsed];
  }

  const text = normalizeText(value);
  return text ? [text] : [];
}

function normalizeObjectField(value) {
  const parsed = parseJsonLike(value, null);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return parsed;
  }
  return null;
}

function formatRole(role) {
  const normalized = String(role || '').trim().toLowerCase();
  if (!normalized) return 'Equipe';
  if (normalized === 'composer') return 'Compositeur';
  if (normalized === 'developer') return 'Developpeur';
  if (normalized === 'director') return 'Directeur';
  if (normalized === 'producer') return 'Producteur';
  if (normalized === 'artist') return 'Art';
  if (normalized === 'writer') return 'Writer';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function serializeJson(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (Array.isArray(value) && value.length === 0) {
    return null;
  }

  if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) {
    return null;
  }

  return JSON.stringify(value);
}

function normalizeNullableNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeNullableBoolean(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }

  const normalized = String(value).trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (['1', 'true', 'yes'].includes(normalized)) return true;
  if (['0', 'false', 'no'].includes(normalized)) return false;
  return null;
}

function getLocalRows(sqlite) {
  const rows = sqlite.prepare(`
    SELECT
      g.id,
      g.title,
      NULLIF(g.slug, '') AS slug,
      COALESCE(NULLIF(mr.url, ''), NULLIF(g.cover_url, ''), NULLIF(g.coverImage, '')) AS cover_url,
      COALESCE(NULLIF(ge.summary, ''), NULLIF(g.summary, '')) AS summary,
      COALESCE(NULLIF(ge.synopsis, ''), NULLIF(g.synopsis, '')) AS synopsis,
      NULLIF(ge.lore, '') AS lore,
      NULLIF(ge.gameplay_description, '') AS gameplay_description,
      NULLIF(ge.characters, '') AS characters,
      NULLIF(ge.dev_notes, '') AS dev_notes,
      COALESCE(NULLIF(ge.cheat_codes, ''), NULLIF(g.cheat_codes, '')) AS cheat_codes,
      NULLIF(g.dev_anecdotes, '') AS legacy_dev_anecdotes,
      NULLIF(g.dev_team, '') AS legacy_dev_team,
      NULLIF(g.ost_composers, '') AS legacy_ost_composers,
      NULLIF(g.ost_notable_tracks, '') AS ost_notable_tracks,
      NULLIF(g.manual_url, '') AS manual_url,
      NULLIF(g.youtube_id, '') AS youtube_id,
      g.youtube_verified AS youtube_verified,
      NULLIF(g.archive_id, '') AS archive_id,
      g.archive_verified AS archive_verified,
      NULLIF(g.versions, '') AS versions,
      g.avg_duration_main,
      g.avg_duration_complete,
      NULLIF(g.speedrun_wr, '') AS speedrun_wr
    FROM games g
    LEFT JOIN game_editorial ge ON ge.game_id = g.id
    LEFT JOIN media_references mr
      ON mr.entity_type = 'game'
     AND mr.entity_id = g.id
     AND mr.media_type = 'cover'
    WHERE g.type = 'game'
  `).all();

  const peopleRows = sqlite.prepare(`
    SELECT
      gp.game_id,
      gp.role,
      gp.billing_order,
      gp.confidence,
      p.name
    FROM game_people gp
    INNER JOIN people p ON p.id = gp.person_id
    ORDER BY gp.game_id ASC, COALESCE(gp.billing_order, 9999) ASC, p.name ASC
  `).all();

  const peopleMap = new Map();
  for (const row of peopleRows) {
    const gameId = String(row.game_id || '').trim();
    if (!gameId) continue;
    if (!peopleMap.has(gameId)) {
      peopleMap.set(gameId, { devTeam: [], composers: [] });
    }

    const entry = {
      name: String(row.name || '').trim(),
      role: formatRole(row.role),
    };

    if (!entry.name) continue;

    if (String(row.role || '').trim().toLowerCase() === 'composer') {
      peopleMap.get(gameId).composers.push(entry);
    } else {
      peopleMap.get(gameId).devTeam.push(entry);
    }
  }

  return rows
    .filter((row) => !FILTER_IDS || FILTER_IDS.has(String(row.id)))
    .map((row) => {
      const people = peopleMap.get(String(row.id)) || { devTeam: [], composers: [] };
      const devNotes = normalizeText(row.dev_notes);
      const legacyAnecdotes = normalizeArrayField(row.legacy_dev_anecdotes);
      const devAnecdotes = devNotes
        ? [{ title: 'Note', text: devNotes }]
        : legacyAnecdotes;

      return {
        id: row.id,
        title: row.title,
        slug: normalizeText(row.slug),
        cover_url: normalizeText(row.cover_url),
        summary: normalizeText(row.summary),
        synopsis: normalizeText(row.synopsis),
        lore: normalizeText(row.lore),
        gameplay_description: normalizeText(row.gameplay_description),
        characters: normalizeArrayField(row.characters),
        dev_team: people.devTeam.length ? people.devTeam : normalizeArrayField(row.legacy_dev_team),
        dev_anecdotes: devAnecdotes,
        ost_composers: people.composers.length ? people.composers : normalizeArrayField(row.legacy_ost_composers),
        ost_notable_tracks: normalizeArrayField(row.ost_notable_tracks),
        cheat_codes: normalizeArrayField(row.cheat_codes),
        manual_url: normalizeText(row.manual_url),
        youtube_id: normalizeText(row.youtube_id),
        youtube_verified: normalizeNullableBoolean(row.youtube_verified),
        archive_id: normalizeText(row.archive_id),
        archive_verified: normalizeNullableBoolean(row.archive_verified),
        versions: normalizeArrayField(row.versions),
        avg_duration_main: normalizeNullableNumber(row.avg_duration_main),
        avg_duration_complete: normalizeNullableNumber(row.avg_duration_complete),
        speedrun_wr: normalizeObjectField(row.speedrun_wr),
      };
    });
}

function fieldNeedsUpdate(remoteValue, localValue, field) {
  if (localValue === null || localValue === undefined) {
    return false;
  }

  if (JSON_FIELDS.has(field)) {
    return isStructuredEmpty(remoteValue) && !isStructuredEmpty(localValue);
  }

  if (field === 'avg_duration_main' || field === 'avg_duration_complete') {
    return remoteValue === null && Number.isFinite(Number(localValue));
  }

  if (field === 'youtube_verified' || field === 'archive_verified') {
    return remoteValue === null && localValue !== null;
  }

  return !normalizeText(remoteValue) && Boolean(normalizeText(localValue));
}

async function ensureColumns(client) {
  for (const [column, definition] of COLUMN_DEFINITIONS) {
    await client.query(`ALTER TABLE public.games ADD COLUMN IF NOT EXISTS ${column} ${definition}`);
  }
}

async function getRemoteRows(client) {
  const query = `
    SELECT
      id,
      slug,
      cover_url,
      summary,
      synopsis,
      dev_anecdotes,
      dev_team,
      cheat_codes,
      lore,
      gameplay_description,
      characters,
      ost_composers,
      ost_notable_tracks,
      manual_url,
      youtube_id,
      youtube_verified,
      archive_id,
      archive_verified,
      versions,
      avg_duration_main,
      avg_duration_complete,
      speedrun_wr
    FROM public.games
    WHERE type = 'game'
  `;

  const result = await client.query(query);
  return new Map(result.rows.map((row) => [String(row.id), row]));
}

function normalizeComparableText(value) {
  return String(value || '').trim();
}

function splitConflictingSlugUpdates(pending, remoteRows) {
  const ownersBySlug = new Map();

  for (const row of remoteRows.values()) {
    const slug = normalizeComparableText(row.slug);
    const id = normalizeComparableText(row.id);
    if (!slug || !id) continue;
    if (!ownersBySlug.has(slug)) {
      ownersBySlug.set(slug, new Set());
    }
    ownersBySlug.get(slug).add(id);
  }

  const safe = [];
  const skipped = [];

  for (const row of pending) {
    const slug = normalizeComparableText(row.payload.slug);
    if (!slug) {
      safe.push(row);
      continue;
    }

    const owners = ownersBySlug.get(slug);
    if (owners && !owners.has(String(row.id))) {
      skipped.push({
        id: row.id,
        title: row.title,
        slug,
        existingIds: [...owners],
      });
      continue;
    }

    safe.push(row);
  }

  return { safe, skipped };
}

function buildFallbackSlugUpdates(remoteRows, pendingIds) {
  const ownersBySlug = new Map();

  for (const row of remoteRows.values()) {
    const slug = normalizeComparableText(row.slug);
    const id = normalizeComparableText(row.id);
    if (!slug || !id) continue;
    if (!ownersBySlug.has(slug)) {
      ownersBySlug.set(slug, new Set());
    }
    ownersBySlug.get(slug).add(id);
  }

  const fallback = [];
  for (const row of remoteRows.values()) {
    const id = normalizeComparableText(row.id);
    const slug = normalizeComparableText(row.slug);
    if (!id || slug || pendingIds.has(id)) {
      continue;
    }

    const owners = ownersBySlug.get(id);
    if (owners && !owners.has(id)) {
      continue;
    }

    fallback.push({
      id,
      title: row.title || id,
      payload: { slug: id },
      derived: true,
    });
  }

  return fallback;
}

function buildUpdatePayload(localRow, remoteRow) {
  const payload = {};
  const fields = [
    'slug',
    'cover_url',
    'summary',
    'synopsis',
    'dev_anecdotes',
    'dev_team',
    'cheat_codes',
    'lore',
    'gameplay_description',
    'characters',
    'ost_composers',
    'ost_notable_tracks',
    'manual_url',
    'youtube_id',
    'youtube_verified',
    'archive_id',
    'archive_verified',
    'versions',
    'avg_duration_main',
    'avg_duration_complete',
    'speedrun_wr',
  ];

  for (const field of fields) {
    if (fieldNeedsUpdate(remoteRow?.[field], localRow[field], field)) {
      payload[field] = localRow[field];
    }
  }

  return payload;
}

async function applyUpdate(client, id, payload) {
  const assignments = [];
  const values = [];
  let index = 1;

  for (const [field, value] of Object.entries(payload)) {
    if (JSON_FIELDS.has(field)) {
      assignments.push(`${field} = $${index}::jsonb`);
      values.push(serializeJson(value));
    } else {
      assignments.push(`${field} = $${index}`);
      values.push(value);
    }
    index += 1;
  }

  assignments.push(`updated_at = NOW()`);
  values.push(id);

  await client.query(
    `UPDATE public.games SET ${assignments.join(', ')} WHERE id = $${index}`,
    values
  );
}

async function main() {
  const sqlite = new Database(path.join(__dirname, '..', 'storage', 'retrodex.sqlite'), { readonly: true });
  const pgClient = new Client(buildRemotePgConfig());

  try {
    await pgClient.connect();
    await ensureColumns(pgClient);

    const localRows = getLocalRows(sqlite);
    const remoteRows = await getRemoteRows(pgClient);
    const pending = [];
    const fieldCounts = new Map();

    for (const localRow of localRows) {
      const remoteRow = remoteRows.get(String(localRow.id));
      if (!remoteRow) {
        continue;
      }

      const payload = buildUpdatePayload(localRow, remoteRow);
      const fields = Object.keys(payload);
      if (!fields.length) {
        continue;
      }

      fields.forEach((field) => fieldCounts.set(field, (fieldCounts.get(field) || 0) + 1));
      pending.push({ id: localRow.id, title: localRow.title, payload });
    }

    const { safe: safePending, skipped: skippedConflicts } = splitConflictingSlugUpdates(pending, remoteRows);
    const pendingIds = new Set(safePending.map((row) => String(row.id)));
    const fallbackSlugUpdates = buildFallbackSlugUpdates(remoteRows, pendingIds);
    const finalPending = [...safePending, ...fallbackSlugUpdates];

    console.log(JSON.stringify({
      apply: APPLY,
      totalLocalRows: localRows.length,
      matchedRemoteRows: remoteRows.size,
      pendingUpdates: finalPending.length,
      skippedConflicts: skippedConflicts.length,
      fallbackSlugUpdates: fallbackSlugUpdates.length,
      fieldCounts: Object.fromEntries([...fieldCounts.entries()].sort(([left], [right]) => left.localeCompare(right))),
      sample: finalPending.slice(0, 5).map((row) => ({
        id: row.id,
        title: row.title,
        fields: Object.keys(row.payload),
        derived: Boolean(row.derived),
      })),
      conflictSample: skippedConflicts.slice(0, 5),
    }, null, 2));

    if (!APPLY || !finalPending.length) {
      return;
    }

    for (const row of finalPending) {
      await applyUpdate(pgClient, row.id, row.payload);
    }

    console.log(JSON.stringify({
      applied: finalPending.length,
      ids: finalPending.slice(0, 20).map((row) => row.id),
      skippedConflicts: skippedConflicts.length,
      fallbackSlugUpdates: fallbackSlugUpdates.length,
    }, null, 2));
  } finally {
    sqlite.close();
    await pgClient.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
