#!/usr/bin/env node
'use strict';

const {
  parseArgs,
  createRemoteClient,
  openReadonlySqlite,
  normalizeText,
  parseJsonLike,
  coerceNumber,
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

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

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
  `).all().map((row) => ({
    id: String(row.id),
    name: String(row.name),
    normalized_name: String(row.normalized_name),
    primary_role: normalizeText(row.primary_role),
    source_record_id: row.source_record_id ? (remoteSourceIdByLocalId.get(Number(row.source_record_id)) || null) : null,
  }));
}

function readLocalGamePeople(sqlite, remoteSourceIdByLocalId) {
  return sqlite.prepare(`
    SELECT game_id, person_id, role, billing_order, source_record_id, confidence, is_inferred
    FROM game_people
    ORDER BY game_id ASC, COALESCE(billing_order, 9999) ASC, person_id ASC
  `).all().map((row) => ({
    game_id: String(row.game_id),
    person_id: String(row.person_id),
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
  `).all();

  const people = [];
  const bindings = [];
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
      const normalizedName = contributor.normalizedName || slugify(contributor.name);
      if (!normalizedName) {
        continue;
      }

      let personId = contributor.personId || normalizedNameToId.get(normalizedName) || `person:${normalizedName}`;
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

      const key = buildGamePeopleKey(binding);
      if (!gamePeopleKeySet.has(key)) {
        gamePeopleKeySet.add(key);
        bindings.push(binding);
      }

      billingOrder += 1;
    }
  }

  return { people, bindings };
}

function buildMusicRows(sqlite, peopleById, normalizedNameToId, gamePeopleKeySet) {
  const musicPayload = readCanonicalPayload('music_');
  const creditsPayload = readCanonicalPayload('credits_');
  const ostRows = [];
  const trackRows = [];
  const releaseRows = [];
  const extraPeople = [];
  const extraBindings = [];

  const creditByGameId = new Map((creditsPayload || []).map((entry) => [String(entry.itemId), entry]));

  for (const entry of musicPayload || []) {
    const gameId = String(entry.itemId || '');
    if (!gameId) {
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
      const normalizedName = normalizeText(contributor.normalizedName) || slugify(contributor.name);
      if (!normalizedName) {
        continue;
      }

      let personId = contributor.personId || normalizedNameToId.get(normalizedName) || `person:${normalizedName}`;
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

function peopleNeedsUpdate(remoteRow, localRow) {
  return (
    normalizeText(remoteRow.name) !== normalizeText(localRow.name)
    || normalizeText(remoteRow.normalized_name) !== normalizeText(localRow.normalized_name)
    || normalizeText(remoteRow.primary_role) !== normalizeText(localRow.primary_role)
    || Number(remoteRow.source_record_id || 0) !== Number(localRow.source_record_id || 0)
  );
}

function gamePeopleNeedsUpdate(remoteRow, localRow) {
  return (
    Number(remoteRow.billing_order || 0) !== Number(localRow.billing_order || 0)
    || Number(remoteRow.source_record_id || 0) !== Number(localRow.source_record_id || 0)
    || Number(remoteRow.confidence || 0) !== Number(localRow.confidence || 0)
    || Boolean(remoteRow.is_inferred) !== Boolean(localRow.is_inferred)
  );
}

function ostNeedsUpdate(remoteRow, localRow) {
  return (
    normalizeText(remoteRow.title) !== normalizeText(localRow.title)
    || Number(remoteRow.source_record_id || 0) !== Number(localRow.source_record_id || 0)
    || Number(remoteRow.confidence || 0) !== Number(localRow.confidence || 0)
    || Boolean(remoteRow.needs_release_enrichment) !== Boolean(localRow.needs_release_enrichment)
  );
}

function ostTrackNeedsUpdate(remoteRow, localRow) {
  return (
    normalizeText(remoteRow.composer_person_id) !== normalizeText(localRow.composer_person_id)
    || Number(remoteRow.source_record_id || 0) !== Number(localRow.source_record_id || 0)
    || Number(remoteRow.confidence || 0) !== Number(localRow.confidence || 0)
  );
}

function ostReleaseNeedsUpdate(remoteRow, localRow) {
  return (
    Number(remoteRow.source_record_id || 0) !== Number(localRow.source_record_id || 0)
    || Number(remoteRow.confidence || 0) !== Number(localRow.confidence || 0)
  );
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
  const _args = parseArgs(process.argv.slice(2));
  const sqlite = openReadonlySqlite();
  const client = createRemoteClient();
  await client.connect();

  try {
    if (APPLY) {
      await ensureRemoteSchema(client);
    }

    const remoteSourceRows = await fetchRemoteSourceRecords(client).catch(() => []);
    const remoteSourceMap = mapBy(remoteSourceRows, buildSourceRecordKey);
    const remoteSourceIdByLocalId = buildSourceRecordIdMap(sqlite, remoteSourceMap);

    const peopleById = new Map();
    const normalizedNameToId = new Map();

    const localPeople = readLocalPeople(sqlite, remoteSourceIdByLocalId);
    const localGamePeople = readLocalGamePeople(sqlite, remoteSourceIdByLocalId);

    for (const person of localPeople) {
      peopleById.set(person.id, person);
      normalizedNameToId.set(person.normalized_name, person.id);
    }

    const gamePeopleKeySet = new Set(localGamePeople.map(buildGamePeopleKey));

    const musicRows = buildMusicRows(sqlite, peopleById, normalizedNameToId, gamePeopleKeySet);
    const fallback = buildFallbackPeopleAndBindings(sqlite, peopleById, normalizedNameToId, gamePeopleKeySet);

    const allPeople = uniqueBy([
      ...localPeople,
      ...musicRows.extraPeople,
      ...fallback.people,
    ], buildPersonKey);

    const allGamePeople = uniqueBy([
      ...localGamePeople,
      ...musicRows.extraBindings,
      ...fallback.bindings,
    ], buildGamePeopleKey);

    const allOst = uniqueBy(musicRows.ostRows, buildOstKey);
    const allOstTracks = uniqueBy(musicRows.trackRows, buildOstTrackKey);
    const allOstReleases = uniqueBy(musicRows.releaseRows, buildOstReleaseKey);

    const peopleTableExists = await tableExists(client, 'people');
    const gamePeopleTableExists = await tableExists(client, 'game_people');
    const ostTableExists = await tableExists(client, 'ost');
    const ostTracksTableExists = await tableExists(client, 'ost_tracks');
    const ostReleasesTableExists = await tableExists(client, 'ost_releases');

    const remotePeopleMap = mapBy(
      peopleTableExists
        ? await fetchRemoteRows(client, 'people', ['id', 'name', 'normalized_name', 'primary_role', 'source_record_id'])
        : [],
      buildPersonKey
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

    const pendingPeople = allPeople.filter((row) => {
      const remoteRow = remotePeopleMap.get(buildPersonKey(row));
      return !remoteRow || peopleNeedsUpdate(remoteRow, row);
    });
    const pendingGamePeople = allGamePeople.filter((row) => {
      const remoteRow = remoteGamePeopleMap.get(buildGamePeopleKey(row));
      return !remoteRow || gamePeopleNeedsUpdate(remoteRow, row);
    });
    const pendingOst = allOst.filter((row) => {
      const remoteRow = remoteOstMap.get(buildOstKey(row));
      return !remoteRow || ostNeedsUpdate(remoteRow, row);
    });
    const pendingTracks = allOstTracks.filter((row) => {
      const remoteRow = remoteTrackMap.get(buildOstTrackKey(row));
      return !remoteRow || ostTrackNeedsUpdate(remoteRow, row);
    });
    const pendingReleases = allOstReleases.filter((row) => {
      const remoteRow = remoteReleaseMap.get(buildOstReleaseKey(row));
      return !remoteRow || ostReleaseNeedsUpdate(remoteRow, row);
    });

    if (APPLY) {
      for (const row of pendingPeople) {
        await upsertPerson(client, row);
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
      people: {
        tableExists: peopleTableExists,
        localRows: allPeople.length,
        remoteRows: remotePeopleMap.size,
        pendingRows: pendingPeople.length,
      },
      game_people: {
        tableExists: gamePeopleTableExists,
        localRows: allGamePeople.length,
        remoteRows: remoteGamePeopleMap.size,
        pendingRows: pendingGamePeople.length,
      },
      ost: {
        tableExists: ostTableExists,
        localRows: allOst.length,
        remoteRows: remoteOstMap.size,
        pendingRows: pendingOst.length,
      },
      ost_tracks: {
        tableExists: ostTracksTableExists,
        localRows: allOstTracks.length,
        remoteRows: remoteTrackMap.size,
        pendingRows: pendingTracks.length,
      },
      ost_releases: {
        tableExists: ostReleasesTableExists,
        localRows: allOstReleases.length,
        remoteRows: remoteReleaseMap.size,
        pendingRows: pendingReleases.length,
      },
      samplePending: {
        people: pendingPeople.slice(0, 5).map((row) => ({ id: row.id, name: row.name, primary_role: row.primary_role })),
        game_people: pendingGamePeople.slice(0, 5).map((row) => ({ game_id: row.game_id, person_id: row.person_id, role: row.role })),
        ost: pendingOst.slice(0, 5).map((row) => ({ id: row.id, game_id: row.game_id, needs_release_enrichment: row.needs_release_enrichment })),
        ost_tracks: pendingTracks.slice(0, 5).map((row) => ({ ost_id: row.ost_id, track_title: row.track_title })),
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
