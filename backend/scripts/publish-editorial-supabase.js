#!/usr/bin/env node
'use strict';

const {
  parseArgs,
  createRemoteClient,
  openReadonlySqlite,
  normalizeText,
  parseJsonLike,
  stringifyJson,
  tableExists,
  fetchRemoteSourceRecords,
  buildSourceRecordKey,
  mapBy,
} = require('./_supabase-publish-common');

const APPLY = process.argv.includes('--apply');

const EDITORIAL_FIELDS = [
  'summary',
  'synopsis',
  'lore',
  'gameplay_description',
  'characters',
  'dev_anecdotes',
  'cheat_codes',
  'versions',
  'avg_duration_main',
  'avg_duration_complete',
  'speedrun_wr',
];

function getColumnSet(sqlite, tableName) {
  try {
    const rows = sqlite.prepare(`PRAGMA table_info(${tableName})`).all();
    return new Set(rows.map((row) => String(row.name)));
  } catch (_error) {
    return new Set();
  }
}

function readLocalEditorialRows(sqlite) {
  const editorialColumns = getColumnSet(sqlite, 'game_editorial');
  const hasEditorialTable = editorialColumns.size > 0;
  const editorialByGameId = new Map();

  if (hasEditorialTable) {
    const selectColumns = [
      'game_id',
      'summary',
      'synopsis',
      'lore',
      'gameplay_description',
      'characters',
      editorialColumns.has('dev_anecdotes') ? 'dev_anecdotes' : 'NULL AS dev_anecdotes',
      editorialColumns.has('dev_notes') ? 'dev_notes' : 'NULL AS dev_notes',
      'cheat_codes',
      editorialColumns.has('versions') ? 'versions' : 'NULL AS versions',
      editorialColumns.has('avg_duration_main') ? 'avg_duration_main' : 'NULL AS avg_duration_main',
      editorialColumns.has('avg_duration_complete') ? 'avg_duration_complete' : 'NULL AS avg_duration_complete',
      editorialColumns.has('speedrun_wr') ? 'speedrun_wr' : 'NULL AS speedrun_wr',
      editorialColumns.has('source_record_id') ? 'source_record_id' : 'NULL AS source_record_id',
    ];

    const rows = sqlite.prepare(`
      SELECT ${selectColumns.join(',\n             ')}
      FROM game_editorial
    `).all();

    for (const row of rows) {
      editorialByGameId.set(String(row.game_id), row);
    }
  }

  const gameRows = sqlite.prepare(`
    SELECT
      id,
      summary,
      synopsis,
      lore,
      gameplay_description,
      characters,
      dev_anecdotes,
      cheat_codes,
      versions,
      avg_duration_main,
      avg_duration_complete,
      speedrun_wr
    FROM games
    WHERE type = 'game'
  `).all();

  const provenanceRows = sqlite.prepare(`
    SELECT entity_id, field_name, source_record_id
    FROM field_provenance
    WHERE entity_type = 'game'
      AND field_name IN (${EDITORIAL_FIELDS.map(() => '?').join(', ')})
  `).all(...EDITORIAL_FIELDS);

  const provenanceMap = new Map();
  for (const row of provenanceRows) {
    provenanceMap.set(`${row.entity_id}::${row.field_name}`, Number(row.source_record_id || 0) || null);
  }

  const rows = [];

  for (const game of gameRows) {
    const editorial = editorialByGameId.get(String(game.id)) || {};
    const row = {
      game_id: String(game.id),
      summary: normalizeText(editorial.summary) || normalizeText(game.summary),
      synopsis: normalizeText(editorial.synopsis) || normalizeText(game.synopsis),
      lore: normalizeText(editorial.lore) || normalizeText(game.lore),
      gameplay_description: normalizeText(editorial.gameplay_description) || normalizeText(game.gameplay_description),
      characters: stringifyJson(parseJsonLike(editorial.characters, null) || parseJsonLike(game.characters, null)),
      dev_anecdotes: normalizeText(editorial.dev_anecdotes) || normalizeText(editorial.dev_notes) || normalizeText(game.dev_anecdotes),
      cheat_codes: stringifyJson(parseJsonLike(editorial.cheat_codes, null) || parseJsonLike(game.cheat_codes, null)),
      versions: stringifyJson(parseJsonLike(editorial.versions, null) || parseJsonLike(game.versions, null)),
      avg_duration_main: editorial.avg_duration_main == null ? (game.avg_duration_main == null ? null : Number(game.avg_duration_main)) : Number(editorial.avg_duration_main),
      avg_duration_complete: editorial.avg_duration_complete == null ? (game.avg_duration_complete == null ? null : Number(game.avg_duration_complete)) : Number(editorial.avg_duration_complete),
      speedrun_wr: stringifyJson(parseJsonLike(editorial.speedrun_wr, null) || parseJsonLike(game.speedrun_wr, null)),
      source_record_id: null,
    };

    const primarySourceId = [
      provenanceMap.get(`${game.id}::summary`),
      provenanceMap.get(`${game.id}::synopsis`),
      provenanceMap.get(`${game.id}::lore`),
      provenanceMap.get(`${game.id}::gameplay_description`),
      provenanceMap.get(`${game.id}::characters`),
      provenanceMap.get(`${game.id}::dev_anecdotes`),
      provenanceMap.get(`${game.id}::cheat_codes`),
      provenanceMap.get(`${game.id}::versions`),
      provenanceMap.get(`${game.id}::avg_duration_main`),
      provenanceMap.get(`${game.id}::avg_duration_complete`),
      provenanceMap.get(`${game.id}::speedrun_wr`),
      editorial.source_record_id ? Number(editorial.source_record_id) : null,
    ].find(Boolean) || null;

    row.source_record_id = primarySourceId;

    const hasData = Boolean(
      row.summary
      || row.synopsis
      || row.lore
      || row.gameplay_description
      || row.characters
      || row.dev_anecdotes
      || row.cheat_codes
      || row.versions
      || row.avg_duration_main != null
      || row.avg_duration_complete != null
      || row.speedrun_wr
    );

    if (hasData) {
      rows.push(row);
    }
  }

  return rows;
}

async function ensureRemoteSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.game_editorial (
      game_id text PRIMARY KEY REFERENCES public.games(id),
      summary text,
      synopsis text,
      lore text,
      gameplay_description text,
      characters jsonb,
      dev_anecdotes text,
      cheat_codes jsonb,
      versions jsonb,
      avg_duration_main numeric,
      avg_duration_complete numeric,
      speedrun_wr jsonb,
      source_record_id bigint REFERENCES public.source_records(id),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await client.query(`CREATE INDEX IF NOT EXISTS idx_game_editorial_source_record_id ON public.game_editorial(source_record_id)`);
  await client.query(`GRANT SELECT ON public.game_editorial TO anon, authenticated, service_role`).catch(() => {});
}

async function fetchRemoteEditorialRows(client) {
  if (!await tableExists(client, 'game_editorial')) {
    return [];
  }

  return (await client.query(`
    SELECT game_id, summary, synopsis, lore, gameplay_description, characters,
           dev_anecdotes, cheat_codes, versions, avg_duration_main,
           avg_duration_complete, speedrun_wr, source_record_id
    FROM public.game_editorial
  `)).rows;
}

function editorialNeedsUpdate(remoteRow, localRow) {
  return (
    normalizeText(remoteRow.summary) !== normalizeText(localRow.summary)
    || normalizeText(remoteRow.synopsis) !== normalizeText(localRow.synopsis)
    || normalizeText(remoteRow.lore) !== normalizeText(localRow.lore)
    || normalizeText(remoteRow.gameplay_description) !== normalizeText(localRow.gameplay_description)
    || stringifyJson(parseJsonLike(remoteRow.characters, null)) !== localRow.characters
    || normalizeText(remoteRow.dev_anecdotes) !== normalizeText(localRow.dev_anecdotes)
    || stringifyJson(parseJsonLike(remoteRow.cheat_codes, null)) !== localRow.cheat_codes
    || stringifyJson(parseJsonLike(remoteRow.versions, null)) !== localRow.versions
    || Number(remoteRow.avg_duration_main || 0) !== Number(localRow.avg_duration_main || 0)
    || Number(remoteRow.avg_duration_complete || 0) !== Number(localRow.avg_duration_complete || 0)
    || stringifyJson(parseJsonLike(remoteRow.speedrun_wr, null)) !== localRow.speedrun_wr
    || Number(remoteRow.source_record_id || 0) !== Number(localRow.source_record_id || 0)
  );
}

async function upsertEditorialRow(client, row) {
  await client.query(`
    INSERT INTO public.game_editorial (
      game_id,
      summary,
      synopsis,
      lore,
      gameplay_description,
      characters,
      dev_anecdotes,
      cheat_codes,
      versions,
      avg_duration_main,
      avg_duration_complete,
      speedrun_wr,
      source_record_id,
      updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8::jsonb,$9::jsonb,$10,$11,$12::jsonb,$13,now())
    ON CONFLICT (game_id) DO UPDATE SET
      summary = EXCLUDED.summary,
      synopsis = EXCLUDED.synopsis,
      lore = EXCLUDED.lore,
      gameplay_description = EXCLUDED.gameplay_description,
      characters = EXCLUDED.characters,
      dev_anecdotes = EXCLUDED.dev_anecdotes,
      cheat_codes = EXCLUDED.cheat_codes,
      versions = EXCLUDED.versions,
      avg_duration_main = EXCLUDED.avg_duration_main,
      avg_duration_complete = EXCLUDED.avg_duration_complete,
      speedrun_wr = EXCLUDED.speedrun_wr,
      source_record_id = EXCLUDED.source_record_id,
      updated_at = now()
  `, [
    row.game_id,
    row.summary,
    row.synopsis,
    row.lore,
    row.gameplay_description,
    row.characters,
    row.dev_anecdotes,
    row.cheat_codes,
    row.versions,
    row.avg_duration_main,
    row.avg_duration_complete,
    row.speedrun_wr,
    row.source_record_id,
  ]);
}

async function main() {
  const _args = parseArgs(process.argv.slice(2));
  const sqlite = openReadonlySqlite();
  const client = createRemoteClient();
  await client.connect();

  try {
    const localRows = readLocalEditorialRows(sqlite);

    if (APPLY) {
      await ensureRemoteSchema(client);
    }

    const sourceRows = await fetchRemoteSourceRecords(client).catch(() => []);
    const remoteSourceMap = mapBy(sourceRows, buildSourceRecordKey);
    const localSourceRows = sqlite.prepare(`SELECT * FROM source_records`).all();
    const remoteSourceIdByLocalId = new Map();

    for (const sourceRow of localSourceRows) {
      const remoteRow = remoteSourceMap.get(buildSourceRecordKey(sourceRow));
      if (remoteRow?.id != null) {
        remoteSourceIdByLocalId.set(Number(sourceRow.id), Number(remoteRow.id));
      }
    }

    const normalizedLocalRows = localRows.map((row) => ({
      ...row,
      source_record_id: row.source_record_id ? (remoteSourceIdByLocalId.get(Number(row.source_record_id)) || null) : null,
    }));

    const remoteTableExists = await tableExists(client, 'game_editorial');
    const remoteRows = remoteTableExists ? await fetchRemoteEditorialRows(client) : [];
    const remoteMap = new Map(remoteRows.map((row) => [String(row.game_id), row]));
    const pendingRows = normalizedLocalRows.filter((row) => {
      const remoteRow = remoteMap.get(String(row.game_id));
      return !remoteRow || editorialNeedsUpdate(remoteRow, row);
    });

    if (APPLY && pendingRows.length) {
      for (const row of pendingRows) {
        await upsertEditorialRow(client, row);
      }
    }

    console.log(JSON.stringify({
      mode: APPLY ? 'apply' : 'dry-run',
      gameEditorial: {
        tableExists: remoteTableExists,
        localRows: normalizedLocalRows.length,
        remoteRows: remoteRows.length,
        pendingRows: pendingRows.length,
        samplePending: pendingRows.slice(0, 5).map((row) => ({
          game_id: row.game_id,
          fields: Object.entries(row)
            .filter(([key, value]) => key !== 'game_id' && value != null && value !== '')
            .map(([key]) => key),
        })),
      },
    }, null, 2));
  } finally {
    sqlite.close();
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error('[publish-editorial-supabase] Failed:', error && error.stack ? error.stack : error);
  process.exit(1);
});
