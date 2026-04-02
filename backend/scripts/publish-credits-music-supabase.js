#!/usr/bin/env node
'use strict';

const {
  parseArgs,
  parseIdFilter,
  createRemoteClient,
  openReadonlySqlite,
  normalizeText,
  normalizeNumberForDiff,
  rowsDiffer,
  parseJsonLike,
  coerceNumber,
  slugifyAscii,
  buildCanonicalPersonId,
  isValidPersonId,
  tableExists,
  fetchRemoteSourceRecords,
  buildSourceRecordKey,
  buildPersonKey,
  buildGamePeopleKey,
  buildOstKey,
  buildOstTrackKey,
  buildOstReleaseKey,
  mapBy,
  readLatestCanonicalJson,
  uniqueBy,
} = require('./_supabase-publish-common');

const APPLY = process.argv.includes('--apply');
const ARGS = parseArgs(process.argv.slice(2));
const FILTER_IDS = parseIdFilter(ARGS);

function normalizeRole(value, fallback = 'developer') {
  const raw = String(value || fallback).trim().toLowerCase();
  if (!raw) return 'developer';
  if (raw.includes('composer') || raw.includes('music') || raw.includes('sound')) return 'composer';
  if (raw.includes('director')) return 'director';
  if (raw.includes('producer')) return 'producer';
  if (raw.includes('artist') || raw.includes('art')) return 'artist';
  if (raw.includes('writer')) return 'writer';
  return raw.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'developer';
}

function parseContributorArray(value, fallbackRole = 'developer') {
  const parsed = parseJsonLike(value, null);
  const rawItems = Array.isArray(parsed)
    ? parsed
    : typeof value === 'string'
      ? value.split(/[,\n;]/).map((item) => item.trim()).filter(Boolean)
      : [];

  return rawItems.map((item) => {
    if (typeof item === 'string') {
      const name = normalizeText(item);
      return name ? { name, role: normalizeRole(fallbackRole, fallbackRole) } : null;
    }

    const name = normalizeText(item?.name || item?.person || item?.full_name || item?.value);
    if (!name) {
      return null;
    }

    return {
      name,
      role: normalizeRole(item.role || item.job || fallbackRole, fallbackRole),
      confidence: coerceNumber(item.confidence),
      personId: normalizeText(item.personId || item.person_id),
      normalizedName: normalizeText(item.normalizedName || item.normalized_name),
      isInferred: item.isInferred === true || item.is_inferred === true,
    };
  }).filter(Boolean);
}

function readCanonicalPayload(prefix) {
  const payload = readLatestCanonicalJson(prefix);
  return payload ? payload.payload : [];
}

function getTableColumns(sqlite, tableName) {
  try {
    const rows = sqlite.prepare(`PRAGMA table_info(${tableName})`).all();
    return new Set(rows.map((row) => String(row.name)));
  } catch (_error) {
    return new Set();
  }
}

function buildSourceRecordIdMap(sqlite, remoteSourceMap) {
  const rows = sqlite.prepare(`SELECT * FROM source_records`).all();
  const map = new Map();

  for (const row of rows) {
    const remoteRow = remoteSourceMap.get(buildSourceRecordKey(row));
    if (remoteRow?.id != null) {
      map.set(Number(row.id), Number(remoteRow.id));
    }
  }

  return map;
}

function readLocalPeople(sqlite, remoteSourceIdByLocalId) {
  return sqlite.prepare(`
    SELECT id, name, normalized_name, primary_role, source_record_id
    FROM people
    ORDER BY id ASC
  `).all().map((row) => {
    const name = normalizeText(row.name);
    const normalizedName = slugifyAscii(normalizeText(row.normalized_name) || name);
    const canonicalId = isValidPersonId(row.id)
      ? String(row.id)
      : buildCanonicalPersonId(name, { fallbackSeed: row.id });

    return {
      id: canonicalId,
      legacy_id: String(row.id),
      name,
      normalized_name: normalizedName || (canonicalId ? canonicalId.replace(/^person:/, '') : null),
      primary_role: normalizeText(row.primary_role),
      source_record_id: row.source_record_id ? (remoteSourceIdByLocalId.get(Number(row.source_record_id)) || null) : null,
    };
  });
}

function readLocalGamePeople(sqlite, remoteSourceIdByLocalId, legacyPersonIdMap) {
  return sqlite.prepare(`
    SELECT game_id, person_id, role, billing_order, source_record_id, confidence, is_inferred
    FROM game_people
    ORDER BY game_id ASC, COALESCE(billing_order, 9999) ASC, person_id ASC
  `).all().map((row) => ({
    game_id: String(row.game_id),
    person_id: legacyPersonIdMap.get(String(row.person_id)) || String(row.person_id),
    legacy_person_id: String(row.person_id),
    role: normalizeRole(row.role),
    billing_order: row.billing_order == null ? null : Number(row.billing_order),
    source_record_id: row.source_record_id ? (remoteSourceIdByLocalId.get(Number(row.source_record_id)) || null) : null,
    confidence: Number(row.confidence ?? 0.5),
    is_inferred: Boolean(row.is_inferred),
  }));
}

function buildFallbackPeopleAndBindings(sqlite, peopleById, normalizedNameToId, gamePeopleKeySet) {
  const rows = sqlite.prepare(`
    SELECT id, developer, dev_team, ost_composers
    FROM games
    WHERE type = 'game'
  `).all().filter((row) => !FILTER_IDS || FILTER_IDS.has(String(row.id)));

  const people = [];
  const bindings = [];
  const invalidPeople = [];
  const invalidBindings = [];
  const gameHasBindings = new Set();

  for (const key of gamePeopleKeySet) {
    gameHasBindings.add(String(key).split('::')[0]);
  }

  for (const game of rows) {
    const gameId = String(game.id);
    if (gameHasBindings.has(gameId)) {
      continue;
    }

    const contributors = [
      ...parseContributorArray(game.dev_team, 'developer'),
      ...parseContributorArray(game.ost_composers, 'composer'),
    ];

      const developerName = normalizeText(game.developer);
    if (developerName) {
      contributors.push({ name: developerName, role: 'developer' });
    }

    let billingOrder = 1;
    for (const contributor of contributors) {
      const normalizedName = slugifyAscii(contributor.normalizedName || contributor.name);
      const canonicalId = buildCanonicalPersonId(contributor.name, { fallbackSeed: `${gameId}:${billingOrder}:${contributor.role}` });
      if (!canonicalId) {
        invalidPeople.push({
          game_id: gameId,
          contributor: contributor.name,
          role: contributor.role,
          reason: 'missing_canonical_person_id',
        });
        continue;
      }

      let personId = contributor.personId;
      if (!isValidPersonId(personId)) {
        personId = normalizedNameToId.get(normalizedName) || canonicalId;
      }
      if (!normalizedNameToId.has(normalizedName)) {
        normalizedNameToId.set(normalizedName, personId);
      } else {
        personId = normalizedNameToId.get(normalizedName);
      }

      if (!peopleById.has(personId)) {
        const personRow = {
          id: personId,
          name: contributor.name,
          normalized_name: normalizedName,
          primary_role: contributor.role,
          source_record_id: null,
        };
        peopleById.set(personId, personRow);
        people.push(personRow);
      }

      const binding = {
        game_id: gameId,
        person_id: personId,
        role: contributor.role,
        billing_order: billingOrder,
        source_record_id: null,
        confidence: contributor.confidence ?? 0.6,
        is_inferred: Boolean(contributor.isInferred),
      };

      if (!isValidPersonId(binding.person_id)) {
        invalidBindings.push({
          game_id: gameId,
          person_id: binding.person_id,
          role: binding.role,
          reason: 'invalid_person_id',
        });
        billingOrder += 1;
        continue;
      }

      const key = buildGamePeopleKey(binding);
      if (!gamePeopleKeySet.has(key)) {
        gamePeopleKeySet.add(key);
        bindings.push(binding);
      }

      billingOrder += 1;
    }
  }

  return { people, bindings, invalidPeople, invalidBindings };
}

function buildMusicRows(sqlite, peopleById, normalizedNameToId, gamePeopleKeySet) {
  const musicPayload = readCanonicalPayload('music_');
  const creditsPayload = readCanonicalPayload('credits_');
  const ostRows = [];
  const trackRows = [];
  const releaseRows = [];
  const extraPeople = [];
  const extraBindings = [];
  const invalidPeople = [];
  const invalidBindings = [];

  const creditByGameId = new Map((creditsPayload || []).map((entry) => [String(entry.itemId), entry]));

  for (const entry of musicPayload || []) {
    const gameId = String(entry.itemId || '');
    if (!gameId) {
      continue;
    }
    if (FILTER_IDS && !FILTER_IDS.has(gameId)) {
      continue;
    }

    const music = entry.music || {};
    const composers = Array.isArray(music.composers) ? music.composers : [];
    const tracks = Array.isArray(music.tracks) ? music.tracks : [];
    const releases = Array.isArray(music.ost?.releases) ? music.ost.releases : [];
    const ostId = `ost:${gameId}:default`;

    if (composers.length || tracks.length || releases.length || music.ost?.hasMusicMetadata) {
      ostRows.push({
        id: ostId,
        game_id: gameId,
        title: normalizeText(music.ost?.title),
        source_record_id: null,
        confidence: composers.length ? Math.max(...composers.map((composer) => Number(composer.confidence || composer.source?.score || 0.6))) : 0.6,
        needs_release_enrichment: Boolean(music.ost?.needsReleaseEnrichment),
      });
    }

    let trackNumber = 1;
    for (const track of tracks) {
      const trackTitle = normalizeText(typeof track === 'string' ? track : track?.title || track?.name);
      if (!trackTitle) {
        continue;
      }

      trackRows.push({
        ost_id: ostId,
        track_title: trackTitle,
        track_number: typeof track === 'object' && track?.trackNumber != null ? Number(track.trackNumber) : trackNumber,
        composer_person_id: normalizeText(typeof track === 'object' ? track?.composerPersonId : null),
        source_record_id: null,
        confidence: typeof track === 'object' && track?.confidence != null ? Number(track.confidence) : 0.6,
      });
      trackNumber += 1;
    }

    for (const release of releases) {
      releaseRows.push({
        ost_id: ostId,
        region_code: normalizeText(release.regionCode || release.region_code),
        release_date: normalizeText(release.releaseDate || release.release_date),
        catalog_number: normalizeText(release.catalogNumber || release.catalog_number),
        label: normalizeText(release.label),
        source_record_id: null,
        confidence: Number(release.confidence || 0.6),
      });
    }

    const contributorRows = composers.length
      ? composers
      : parseContributorArray(creditByGameId.get(gameId)?.credits?.devTeam || [], 'composer');

    let billingOrder = 1;
    for (const contributor of contributorRows) {
      const normalizedName = slugifyAscii(normalizeText(contributor.normalizedName) || contributor.name);
      const canonicalId = buildCanonicalPersonId(contributor.name, { fallbackSeed: `${gameId}:${billingOrder}:composer` });
      if (!canonicalId) {
        invalidPeople.push({
          game_id: gameId,
          contributor: contributor.name,
          role: contributor.role || 'composer',
          reason: 'missing_canonical_person_id',
        });
        continue;
      }

      let personId = contributor.personId;
      if (!isValidPersonId(personId)) {
        personId = normalizedNameToId.get(normalizedName) || canonicalId;
      }
      if (!normalizedNameToId.has(normalizedName)) {
        normalizedNameToId.set(normalizedName, personId);
      } else {
        personId = normalizedNameToId.get(normalizedName);
      }

      if (!peopleById.has(personId)) {
        const personRow = {
          id: personId,
          name: contributor.name,
          normalized_name: normalizedName,
          primary_role: normalizeRole(contributor.role || 'composer'),
          source_record_id: null,
        };
        peopleById.set(personId, personRow);
        extraPeople.push(personRow);
      }

      const binding = {
        game_id: gameId,
        person_id: personId,
        role: normalizeRole(contributor.role || 'composer'),
        billing_order: billingOrder,
        source_record_id: null,
        confidence: Number(contributor.confidence || contributor.source?.score || 0.6),
        is_inferred: Boolean(contributor.isInferred || contributor.source?.isInferred),
      };

      if (!isValidPersonId(binding.person_id)) {
        invalidBindings.push({
          game_id: gameId,
          person_id: binding.person_id,
          role: binding.role,
          reason: 'invalid_person_id',
        });
        billingOrder += 1;
        continue;
      }

      const key = buildGamePeopleKey(binding);
      if (!gamePeopleKeySet.has(key)) {
        gamePeopleKeySet.add(key);
        extraBindings.push(binding);
      }

      billingOrder += 1;
    }
  }

  return {
    ostRows: uniqueBy(ostRows, buildOstKey),
    trackRows: uniqueBy(trackRows, buildOstTrackKey),
    releaseRows: uniqueBy(releaseRows, buildOstReleaseKey),
    extraPeople,
    extraBindings,
    invalidPeople,
    invalidBindings,
  };
}

async function ensureRemoteSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.people (
      id text PRIMARY KEY,
      name text NOT NULL,
      normalized_name text NOT NULL,
      primary_role text,
      source_record_id bigint REFERENCES public.source_records(id),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_people_normalized_name ON public.people(normalized_name)`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS public.game_people (
      id bigserial PRIMARY KEY,
      game_id text NOT NULL REFERENCES public.games(id),
      person_id text NOT NULL REFERENCES public.people(id),
      role text NOT NULL,
      billing_order integer,
      source_record_id bigint REFERENCES public.source_records(id),
      confidence numeric NOT NULL DEFAULT 0.5,
      is_inferred boolean NOT NULL DEFAULT false,
      UNIQUE(game_id, person_id, role)
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS public.ost (
      id text PRIMARY KEY,
      game_id text NOT NULL REFERENCES public.games(id),
      title text,
      source_record_id bigint REFERENCES public.source_records(id),
      confidence numeric NOT NULL DEFAULT 0.5,
      needs_release_enrichment boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS public.ost_tracks (
      id bigserial PRIMARY KEY,
      ost_id text NOT NULL REFERENCES public.ost(id),
      track_title text NOT NULL,
      track_number integer,
      composer_person_id text REFERENCES public.people(id),
      source_record_id bigint REFERENCES public.source_records(id),
      confidence numeric NOT NULL DEFAULT 0.5
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS public.ost_releases (
      id bigserial PRIMARY KEY,
      ost_id text NOT NULL REFERENCES public.ost(id),
      region_code text,
      release_date date,
      catalog_number text,
      label text,
      source_record_id bigint REFERENCES public.source_records(id),
      confidence numeric NOT NULL DEFAULT 0.5
    )
  `);

  await client.query(`CREATE INDEX IF NOT EXISTS idx_game_people_game_id ON public.game_people(game_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_ost_game_id ON public.ost(game_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_ost_tracks_ost_id ON public.ost_tracks(ost_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_ost_releases_ost_id ON public.ost_releases(ost_id)`);
  await client.query(`GRANT SELECT ON public.people TO anon, authenticated, service_role`).catch(() => {});
  await client.query(`GRANT SELECT ON public.game_people TO anon, authenticated, service_role`).catch(() => {});
  await client.query(`GRANT SELECT ON public.ost TO anon, authenticated, service_role`).catch(() => {});
  await client.query(`GRANT SELECT ON public.ost_tracks TO anon, authenticated, service_role`).catch(() => {});
  await client.query(`GRANT SELECT ON public.ost_releases TO anon, authenticated, service_role`).catch(() => {});
}

async function fetchRemoteRows(client, tableName, columns) {
  if (!await tableExists(client, tableName)) {
    return [];
  }
  return (await client.query(`SELECT ${columns.join(', ')} FROM public.${tableName}`)).rows;
}

async function fetchRemoteGameIdSet(client) {
  const { rows } = await client.query(`
    SELECT id
    FROM public.games
    WHERE type = 'game'
  `);

  return new Set(rows.map((row) => String(row.id)));
}

function peopleNeedsUpdate(remoteRow, localRow) {
  return rowsDiffer([
    'name',
    'normalized_name',
    'primary_role',
    'source_record_id',
  ], remoteRow, localRow, {
    name: normalizeText,
    normalized_name: normalizeText,
    primary_role: normalizeText,
    source_record_id: normalizeNumberForDiff,
  });
}

function gamePeopleNeedsUpdate(remoteRow, localRow) {
  return rowsDiffer([
    'billing_order',
    'source_record_id',
    'confidence',
    'is_inferred',
  ], remoteRow, localRow, {
    billing_order: normalizeNumberForDiff,
    source_record_id: normalizeNumberForDiff,
    confidence: normalizeNumberForDiff,
    is_inferred: (value) => Boolean(value),
  });
}

function ostNeedsUpdate(remoteRow, localRow) {
  return rowsDiffer([
    'title',
    'source_record_id',
    'confidence',
    'needs_release_enrichment',
  ], remoteRow, localRow, {
    title: normalizeText,
    source_record_id: normalizeNumberForDiff,
    confidence: normalizeNumberForDiff,
    needs_release_enrichment: (value) => Boolean(value),
  });
}

function ostTrackNeedsUpdate(remoteRow, localRow) {
  return rowsDiffer([
    'composer_person_id',
    'source_record_id',
    'confidence',
  ], remoteRow, localRow, {
    composer_person_id: normalizeText,
    source_record_id: normalizeNumberForDiff,
    confidence: normalizeNumberForDiff,
  });
}

function ostReleaseNeedsUpdate(remoteRow, localRow) {
  return rowsDiffer([
    'source_record_id',
    'confidence',
  ], remoteRow, localRow, {
    source_record_id: normalizeNumberForDiff,
    confidence: normalizeNumberForDiff,
  });
}

async function upsertPerson(client, row) {
  await client.query(`
    INSERT INTO public.people (
      id, name, normalized_name, primary_role, source_record_id, updated_at
    ) VALUES ($1,$2,$3,$4,$5,now())
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      normalized_name = EXCLUDED.normalized_name,
      primary_role = EXCLUDED.primary_role,
      source_record_id = EXCLUDED.source_record_id,
      updated_at = now()
  `, [row.id, row.name, row.normalized_name, row.primary_role, row.source_record_id]);
}

async function upsertGamePerson(client, row) {
  await client.query(`
    INSERT INTO public.game_people (
      game_id, person_id, role, billing_order, source_record_id, confidence, is_inferred
    ) VALUES ($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT (game_id, person_id, role) DO UPDATE SET
      billing_order = EXCLUDED.billing_order,
      source_record_id = EXCLUDED.source_record_id,
      confidence = EXCLUDED.confidence,
      is_inferred = EXCLUDED.is_inferred
  `, [
    row.game_id,
    row.person_id,
    row.role,
    row.billing_order,
    row.source_record_id,
    row.confidence,
    Boolean(row.is_inferred),
  ]);
}

async function upsertOst(client, row) {
  await client.query(`
    INSERT INTO public.ost (
      id, game_id, title, source_record_id, confidence, needs_release_enrichment, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,now())
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      source_record_id = EXCLUDED.source_record_id,
      confidence = EXCLUDED.confidence,
      needs_release_enrichment = EXCLUDED.needs_release_enrichment,
      updated_at = now()
  `, [
    row.id,
    row.game_id,
    row.title,
    row.source_record_id,
    row.confidence,
    Boolean(row.needs_release_enrichment),
  ]);
}

async function insertOstTrack(client, row) {
  await client.query(`
    INSERT INTO public.ost_tracks (
      ost_id, track_title, track_number, composer_person_id, source_record_id, confidence
    ) VALUES ($1,$2,$3,$4,$5,$6)
  `, [
    row.ost_id,
    row.track_title,
    row.track_number,
    row.composer_person_id,
    row.source_record_id,
    row.confidence,
  ]);
}

async function updateOstTrack(client, remoteId, row) {
  await client.query(`
    UPDATE public.ost_tracks
    SET composer_person_id = $1,
        source_record_id = $2,
        confidence = $3
    WHERE id = $4
  `, [
    row.composer_person_id,
    row.source_record_id,
    row.confidence,
    remoteId,
  ]);
}

async function insertOstRelease(client, row) {
  await client.query(`
    INSERT INTO public.ost_releases (
      ost_id, region_code, release_date, catalog_number, label, source_record_id, confidence
    ) VALUES ($1,$2,$3,$4,$5,$6,$7)
  `, [
    row.ost_id,
    row.region_code,
    row.release_date,
    row.catalog_number,
    row.label,
    row.source_record_id,
    row.confidence,
  ]);
}

async function updateOstRelease(client, remoteId, row) {
  await client.query(`
    UPDATE public.ost_releases
    SET source_record_id = $1,
        confidence = $2
    WHERE id = $3
  `, [
    row.source_record_id,
    row.confidence,
    remoteId,
  ]);
}

async function main() {
  const sqlite = openReadonlySqlite();
  const client = createRemoteClient();
  await client.connect();

  try {
    if (APPLY) {
      await ensureRemoteSchema(client);
    }

    const remoteGameIds = await fetchRemoteGameIdSet(client);

    const remoteSourceRows = await fetchRemoteSourceRecords(client).catch(() => []);
    const remoteSourceMap = mapBy(remoteSourceRows, buildSourceRecordKey);
    const remoteSourceIdByLocalId = buildSourceRecordIdMap(sqlite, remoteSourceMap);

    const peopleById = new Map();
    const normalizedNameToId = new Map();
    const invalidPeople = [];
    const invalidBindings = [];

    const localPeopleRaw = readLocalPeople(sqlite, remoteSourceIdByLocalId);
    const legacyPersonIdMap = new Map();
    const localPeople = [];

    for (const person of localPeopleRaw) {
      if (person.legacy_id) {
        legacyPersonIdMap.set(person.legacy_id, person.id);
      }

      if (!person.name || !isValidPersonId(person.id)) {
        invalidPeople.push({
          legacy_id: person.legacy_id,
          person_id: person.id,
          name: person.name,
          reason: !person.name ? 'missing_name' : 'invalid_person_id',
        });
        continue;
      }

      localPeople.push(person);
    }

    const localGamePeople = readLocalGamePeople(sqlite, remoteSourceIdByLocalId, legacyPersonIdMap)
      .filter((row) => !FILTER_IDS || FILTER_IDS.has(String(row.game_id)))
      .filter((row) => {
        if (isValidPersonId(row.person_id)) {
          return true;
        }

        invalidBindings.push({
          game_id: row.game_id,
          person_id: row.person_id,
          legacy_person_id: row.legacy_person_id,
          role: row.role,
          reason: 'invalid_person_id',
        });
        return false;
      });

    for (const person of localPeople) {
      peopleById.set(person.id, person);
      if (person.normalized_name) {
        normalizedNameToId.set(person.normalized_name, person.id);
      }
    }

    const gamePeopleKeySet = new Set(localGamePeople.map(buildGamePeopleKey));

    const musicRows = buildMusicRows(sqlite, peopleById, normalizedNameToId, gamePeopleKeySet);
    const fallback = buildFallbackPeopleAndBindings(sqlite, peopleById, normalizedNameToId, gamePeopleKeySet);
    invalidPeople.push(...musicRows.invalidPeople, ...fallback.invalidPeople);
    invalidBindings.push(...musicRows.invalidBindings, ...fallback.invalidBindings);

    const allPeople = uniqueBy([
      ...localPeople,
      ...musicRows.extraPeople,
      ...fallback.people,
    ], buildPersonKey);

    const allGamePeople = uniqueBy([
      ...localGamePeople,
      ...musicRows.extraBindings,
      ...fallback.bindings,
    ], buildGamePeopleKey)
      .filter((row) => remoteGameIds.has(String(row.game_id)))
      .filter((row) => {
        if (isValidPersonId(row.person_id)) {
          return true;
        }
        invalidBindings.push({
          game_id: row.game_id,
          person_id: row.person_id,
          role: row.role,
          reason: 'invalid_person_id_post_merge',
        });
        return false;
      })
      .filter((row) => !FILTER_IDS || FILTER_IDS.has(String(row.game_id)));

    const allOst = uniqueBy(musicRows.ostRows, buildOstKey)
      .filter((row) => remoteGameIds.has(String(row.game_id)))
      .filter((row) => !FILTER_IDS || FILTER_IDS.has(String(row.game_id)));
    const allowedOstIds = new Set(allOst.map((row) => String(row.id)));
    const allOstTracks = uniqueBy(musicRows.trackRows, buildOstTrackKey)
      .filter((row) => allowedOstIds.has(String(row.ost_id)));
    const allOstReleases = uniqueBy(musicRows.releaseRows, buildOstReleaseKey)
      .filter((row) => allowedOstIds.has(String(row.ost_id)));
    const referencedPersonIds = new Set([
      ...allGamePeople.map((row) => String(row.person_id)),
      ...allOstTracks.map((row) => normalizeText(row.composer_person_id)).filter(Boolean),
    ]);
    const retainedPeople = allPeople.filter((row) => referencedPersonIds.has(String(row.id)));
    const validRetainedPersonIds = new Set(retainedPeople.map((row) => String(row.id)));
    const filteredGamePeople = allGamePeople.filter((row) => {
      if (validRetainedPersonIds.has(String(row.person_id))) {
        return true;
      }
      invalidBindings.push({
        game_id: row.game_id,
        person_id: row.person_id,
        role: row.role,
        reason: 'missing_retained_person',
      });
      return false;
    });

    const peopleTableExists = await tableExists(client, 'people');
    const gamePeopleTableExists = await tableExists(client, 'game_people');
    const ostTableExists = await tableExists(client, 'ost');
    const ostTracksTableExists = await tableExists(client, 'ost_tracks');
    const ostReleasesTableExists = await tableExists(client, 'ost_releases');

    const remotePeopleRows = peopleTableExists
      ? await fetchRemoteRows(client, 'people', ['id', 'name', 'normalized_name', 'primary_role', 'source_record_id'])
      : [];
    const remotePeopleMap = mapBy(remotePeopleRows, buildPersonKey);
    const remotePeopleByNormalizedName = new Map(
      remotePeopleRows
        .map((row) => [normalizeText(row.normalized_name), row])
        .filter(([normalizedName]) => Boolean(normalizedName))
    );
    const remoteGamePeopleMap = mapBy(
      gamePeopleTableExists
        ? await fetchRemoteRows(client, 'game_people', ['id', 'game_id', 'person_id', 'role', 'billing_order', 'source_record_id', 'confidence', 'is_inferred'])
        : [],
      buildGamePeopleKey
    );
    const remoteOstMap = mapBy(
      ostTableExists
        ? await fetchRemoteRows(client, 'ost', ['id', 'game_id', 'title', 'source_record_id', 'confidence', 'needs_release_enrichment'])
        : [],
      buildOstKey
    );
    const remoteTrackRows = ostTracksTableExists
      ? await fetchRemoteRows(client, 'ost_tracks', ['id', 'ost_id', 'track_title', 'track_number', 'composer_person_id', 'source_record_id', 'confidence'])
      : [];
    const remoteTrackMap = mapBy(remoteTrackRows, buildOstTrackKey);
    const remoteReleaseRows = ostReleasesTableExists
      ? await fetchRemoteRows(client, 'ost_releases', ['id', 'ost_id', 'region_code', 'release_date', 'catalog_number', 'label', 'source_record_id', 'confidence'])
      : [];
    const remoteReleaseMap = mapBy(remoteReleaseRows, buildOstReleaseKey);

    const personIdRemap = new Map();
    for (const row of retainedPeople) {
      const remoteMatch = remotePeopleByNormalizedName.get(normalizeText(row.normalized_name));
      if (remoteMatch && isValidPersonId(remoteMatch.id) && remoteMatch.id !== row.id) {
        personIdRemap.set(row.id, String(remoteMatch.id));
      }
    }

    const reconciledPeople = uniqueBy(retainedPeople.map((row) => ({
      ...row,
      id: personIdRemap.get(row.id) || row.id,
    })), buildPersonKey);
    const reconciledGamePeople = uniqueBy(filteredGamePeople.map((row) => ({
      ...row,
      person_id: personIdRemap.get(row.person_id) || row.person_id,
    })), buildGamePeopleKey);
    const reconciledOstTracks = uniqueBy(allOstTracks.map((row) => ({
      ...row,
      composer_person_id: personIdRemap.get(row.composer_person_id) || row.composer_person_id,
    })), buildOstTrackKey);

    const pendingPeople = reconciledPeople.filter((row) => {
      const remoteRow = remotePeopleMap.get(buildPersonKey(row));
      return !remoteRow || peopleNeedsUpdate(remoteRow, row);
    });
    const pendingGamePeople = reconciledGamePeople.filter((row) => {
      const remoteRow = remoteGamePeopleMap.get(buildGamePeopleKey(row));
      return !remoteRow || gamePeopleNeedsUpdate(remoteRow, row);
    });
    const pendingOst = allOst.filter((row) => {
      const remoteRow = remoteOstMap.get(buildOstKey(row));
      return !remoteRow || ostNeedsUpdate(remoteRow, row);
    });
    const pendingTracks = reconciledOstTracks.filter((row) => {
      const remoteRow = remoteTrackMap.get(buildOstTrackKey(row));
      return !remoteRow || ostTrackNeedsUpdate(remoteRow, row);
    });
    const pendingReleases = allOstReleases.filter((row) => {
      const remoteRow = remoteReleaseMap.get(buildOstReleaseKey(row));
      return !remoteRow || ostReleaseNeedsUpdate(remoteRow, row);
    });

    if (APPLY) {
      for (const row of pendingPeople) {
        try {
          await upsertPerson(client, row);
        } catch (error) {
          console.error(JSON.stringify({
            table: 'people',
            key: buildPersonKey(row),
            row,
            error: error.message,
          }, null, 2));
          throw error;
        }
      }
      for (const row of pendingGamePeople) {
        await upsertGamePerson(client, row);
      }
      for (const row of pendingOst) {
        await upsertOst(client, row);
      }
      for (const row of pendingTracks) {
        const remoteRow = remoteTrackMap.get(buildOstTrackKey(row));
        if (remoteRow?.id) {
          await updateOstTrack(client, remoteRow.id, row);
        } else {
          await insertOstTrack(client, row);
        }
      }
      for (const row of pendingReleases) {
        const remoteRow = remoteReleaseMap.get(buildOstReleaseKey(row));
        if (remoteRow?.id) {
          await updateOstRelease(client, remoteRow.id, row);
        } else {
          await insertOstRelease(client, row);
        }
      }
    }

    console.log(JSON.stringify({
      mode: APPLY ? 'apply' : 'dry-run',
      filterIds: FILTER_IDS ? [...FILTER_IDS] : null,
      people: {
        tableExists: peopleTableExists,
        localRows: reconciledPeople.length,
        remoteRows: remotePeopleMap.size,
        insertRows: pendingPeople.filter((row) => !remotePeopleMap.get(buildPersonKey(row))).length,
        updateRows: pendingPeople.filter((row) => remotePeopleMap.get(buildPersonKey(row))).length,
        unchangedRows: Math.max(reconciledPeople.length - pendingPeople.length, 0),
        invalidRows: invalidPeople.length,
        filteredRows: Math.max(allPeople.length - reconciledPeople.length, 0),
        pendingRows: pendingPeople.length,
      },
      game_people: {
        tableExists: gamePeopleTableExists,
        localRows: reconciledGamePeople.length,
        remoteRows: remoteGamePeopleMap.size,
        insertRows: pendingGamePeople.filter((row) => !remoteGamePeopleMap.get(buildGamePeopleKey(row))).length,
        updateRows: pendingGamePeople.filter((row) => remoteGamePeopleMap.get(buildGamePeopleKey(row))).length,
        unchangedRows: Math.max(reconciledGamePeople.length - pendingGamePeople.length, 0),
        invalidRows: invalidBindings.length,
        filteredRows: allGamePeople.length - reconciledGamePeople.length,
        pendingRows: pendingGamePeople.length,
      },
      ost: {
        tableExists: ostTableExists,
        localRows: allOst.length,
        remoteRows: remoteOstMap.size,
        insertRows: pendingOst.filter((row) => !remoteOstMap.get(buildOstKey(row))).length,
        updateRows: pendingOst.filter((row) => remoteOstMap.get(buildOstKey(row))).length,
        unchangedRows: Math.max(allOst.length - pendingOst.length, 0),
        invalidRows: 0,
        filteredRows: musicRows.ostRows.length - allOst.length,
        pendingRows: pendingOst.length,
      },
      ost_tracks: {
        tableExists: ostTracksTableExists,
        localRows: reconciledOstTracks.length,
        remoteRows: remoteTrackMap.size,
        insertRows: pendingTracks.filter((row) => !remoteTrackMap.get(buildOstTrackKey(row))).length,
        updateRows: pendingTracks.filter((row) => remoteTrackMap.get(buildOstTrackKey(row))).length,
        unchangedRows: Math.max(reconciledOstTracks.length - pendingTracks.length, 0),
        invalidRows: 0,
        filteredRows: musicRows.trackRows.length - reconciledOstTracks.length,
        pendingRows: pendingTracks.length,
      },
      ost_releases: {
        tableExists: ostReleasesTableExists,
        localRows: allOstReleases.length,
        remoteRows: remoteReleaseMap.size,
        insertRows: pendingReleases.filter((row) => !remoteReleaseMap.get(buildOstReleaseKey(row))).length,
        updateRows: pendingReleases.filter((row) => remoteReleaseMap.get(buildOstReleaseKey(row))).length,
        unchangedRows: Math.max(allOstReleases.length - pendingReleases.length, 0),
        invalidRows: 0,
        filteredRows: musicRows.releaseRows.length - allOstReleases.length,
        pendingRows: pendingReleases.length,
      },
      samplePending: {
        people: pendingPeople.slice(0, 5).map((row) => ({ id: row.id, name: row.name, primary_role: row.primary_role })),
        game_people: pendingGamePeople.slice(0, 5).map((row) => ({ game_id: row.game_id, person_id: row.person_id, role: row.role })),
        ost: pendingOst.slice(0, 5).map((row) => ({ id: row.id, game_id: row.game_id, needs_release_enrichment: row.needs_release_enrichment })),
        ost_tracks: pendingTracks.slice(0, 5).map((row) => ({ ost_id: row.ost_id, track_title: row.track_title })),
      },
      sampleInvalid: {
        people: invalidPeople.slice(0, 5),
        game_people: invalidBindings.slice(0, 5),
        ost: [],
        ost_tracks: [],
      },
      skipped: {
        game_people_filtered_out: localGamePeople.length + musicRows.extraBindings.length + fallback.bindings.length - filteredGamePeople.length,
        ost_filtered_out: musicRows.ostRows.length - allOst.length,
        ost_tracks_filtered_out: musicRows.trackRows.length - allOstTracks.length,
        ost_releases_filtered_out: musicRows.releaseRows.length - allOstReleases.length,
      },
    }, null, 2));
  } finally {
    sqlite.close();
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error('[publish-credits-music-supabase] Failed:', error && error.stack ? error.stack : error);
  process.exit(1);
});
