#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const {
  CANONICAL_DIR,
  LOGS_DIR,
  PROJECT_ROOT,
  ensureWorkspace,
  formatOutputPath,
  readJson,
  resolveLatestCanonicalFile,
  utcDateStamp,
  utcTimestampStamp,
  writeJson,
} = require('./_shared');

function loadBackendEnv() {
  const envPath = path.join(PROJECT_ROOT, 'backend', '.env');
  if (!fs.existsSync(envPath)) {
    return {};
  }

  const env = {};
  const lines = fs.readFileSync(envPath, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }
    const index = trimmed.indexOf('=');
    if (index < 0) {
      return;
    }
    env[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim().replace(/^"(.*)"$/, '$1');
  });
  return env;
}

function parseProjectReference(env) {
  const raw = env.SUPABASE_URL || env.SUPABASE_Project_URL || env.SUPERDATA_Project_URL || '';
  const match = String(raw).match(/([a-z0-9]{20})/i);
  return match ? String(match[0]) : '';
}

function buildRemotePgConfig() {
  const env = {
    ...loadBackendEnv(),
    ...process.env,
  };
  const projectReference = parseProjectReference(env);
  const rawUrl = env.SUPABASE_Project_URL || env.DATABASE_URL || '';
  let password = '';
  try {
    password = new URL(rawUrl).password || '';
  } catch (_) {
    const passwordMatch = rawUrl.match(/postgres(?:\.[\w-]+)?:([^@]+)@/);
    password = passwordMatch ? decodeURIComponent(passwordMatch[1]) : '';
  }

  if (!projectReference || !password) {
    return null;
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

async function inspectSupabase(client) {
  const targetTables = ['companies', 'people', 'game_people', 'game_editorial', 'media_references', 'ost', 'ost_tracks', 'ost_releases'];
  const { rows: tables } = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = ANY($1)
  `, [targetTables]);
  const existingTables = new Set(tables.map((row) => row.table_name));

  const { rows: columns } = await client.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ANY($1)
  `, [targetTables]);

  const columnsByTable = {};
  targetTables.forEach((tableName) => {
    columnsByTable[tableName] = columns
      .filter((row) => row.table_name === tableName)
      .map((row) => row.column_name)
      .sort();
  });

  return {
    tables: Object.fromEntries(targetTables.map((tableName) => [tableName, existingTables.has(tableName)])),
    columns: columnsByTable,
  };
}

function loadCanonicalInputs() {
  return {
    creditsPath: resolveLatestCanonicalFile('credits'),
    companiesPath: resolveLatestCanonicalFile('companies'),
    editorialPath: resolveLatestCanonicalFile('editorial'),
    mediaDocsPath: resolveLatestCanonicalFile('media_docs'),
    musicPath: resolveLatestCanonicalFile('music'),
    composersPath: resolveLatestCanonicalFile('composers'),
  };
}

function flattenCreditsForPublish(creditsRows, companiesRows) {
  const people = new Map();
  const gamePeople = [];

  creditsRows.forEach((row) => {
    row.credits.roles.forEach((entry) => {
      const personId = entry.personId || `person:${String(entry.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;
      if (entry.name && !people.has(personId)) {
        people.set(personId, {
          id: personId,
          name: entry.name,
          normalizedName: entry.normalizedName || entry.name,
          primaryRole: entry.primaryRole || entry.role || null,
        });
      }

      gamePeople.push({
        gameId: row.itemId,
        personId,
        role: entry.role,
        confidence: entry.confidence,
        sourceRule: entry.source.rule,
      });
    });
  });

  return {
    companies: companiesRows,
    people: Array.from(people.values()),
    gamePeople,
  };
}

function flattenEditorialForPublish(editorialRows) {
  return editorialRows
    .map((row) => ({
      gameId: row.itemId,
      summary: row.editorial.summary.value,
      synopsis: row.editorial.synopsis.value,
      lore: row.editorial.lore.value,
      characters: row.editorial.characters.values,
    }))
    .filter((row) => row.summary || row.synopsis || row.lore || (Array.isArray(row.characters) && row.characters.length));
}

function flattenMediaDocsForPublish(mediaDocsRows) {
  const publishable = [];
  let localOnly = 0;

  mediaDocsRows.forEach((row) => {
    const references = [...row.mediaDocs.notices, ...row.mediaDocs.assetVariants];
    references.forEach((entry) => {
      if (!entry.url) {
        localOnly += 1;
        return;
      }
      publishable.push({
        entityType: 'game',
        entityId: row.itemId,
        mediaType: entry.mediaType === 'cover_reference' ? 'cover' : entry.mediaType,
        url: entry.url,
        provider: entry.provider || null,
        complianceStatus: entry.complianceStatus || null,
        storageMode: entry.storageMode || null,
      });
    });
  });

  return {
    publishable,
    localOnly,
  };
}

function flattenMusicForPublish(musicRows, composersRows) {
  const people = composersRows.map((entry) => ({
    id: entry.id,
    name: entry.name,
    normalizedName: entry.normalizedName || entry.name,
    primaryRole: 'composer',
  }));

  const gamePeople = [];
  const ost = [];
  const ostTracks = [];

  musicRows.forEach((row) => {
    row.music.composers.forEach((composer) => {
      const personId = composer.personId || `person:${String(composer.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;
      gamePeople.push({
        gameId: row.itemId,
        personId,
        role: 'composer',
        confidence: composer.confidence,
        sourceRule: composer.source.rule,
      });
    });

    if (row.music.composers.length || row.music.tracks.length) {
      ost.push({
        gameId: row.itemId,
        releaseCount: row.music.ost.releaseCount,
        needsReleaseEnrichment: row.music.ost.needsReleaseEnrichment,
      });
    }

    row.music.tracks.forEach((track) => {
      ostTracks.push({
        gameId: row.itemId,
        title: track,
      });
    });
  });

  return {
    people,
    gamePeople,
    ost,
    ostTracks,
    ostReleases: [],
  };
}

async function loadRemoteMediaReferences(client) {
  const { rows } = await client.query(`
    SELECT entity_id, media_type, url
    FROM media_references
    WHERE entity_type = 'game'
  `);
  return new Set(rows.map((row) => `${row.entity_id}|${row.media_type}|${row.url}`));
}

async function main() {
  ensureWorkspace();

  const startedAt = new Date();
  const dateStamp = utcDateStamp(startedAt);
  const timestampStamp = utcTimestampStamp(startedAt);
  const outputPath = path.join(CANONICAL_DIR, `publish_domains_${dateStamp}.json`);
  const logPath = path.join(LOGS_DIR, `publish_domains_${dateStamp}_${timestampStamp}.json`);
  const inputs = loadCanonicalInputs();
  const creditsRows = readJson(inputs.creditsPath);
  const companiesRows = readJson(inputs.companiesPath);
  const editorialRows = readJson(inputs.editorialPath);
  const mediaDocsRows = readJson(inputs.mediaDocsPath);
  const musicRows = readJson(inputs.musicPath);
  const composersRows = readJson(inputs.composersPath);

  const creditsPublish = flattenCreditsForPublish(creditsRows, companiesRows);
  const editorialPublish = flattenEditorialForPublish(editorialRows);
  const mediaDocsPublish = flattenMediaDocsForPublish(mediaDocsRows);
  const musicPublish = flattenMusicForPublish(musicRows, composersRows);

  const config = buildRemotePgConfig();
  const report = {
    pipeline: '10_publish_domains',
    mode: 'dry-run',
    runAt: startedAt.toISOString(),
    inputs: Object.fromEntries(Object.entries(inputs).map(([key, value]) => [key, formatOutputPath(value)])),
    connected: false,
    supabase: null,
    domains: {
      credits: {
        localCounts: {
          companies: creditsPublish.companies.length,
          people: creditsPublish.people.length,
          gamePeople: creditsPublish.gamePeople.length,
        },
        targets: {},
        ready: false,
      },
      editorial: {
        localCounts: {
          gameEditorial: editorialPublish.length,
        },
        targets: {},
        ready: false,
      },
      mediaDocs: {
        localCounts: {
          publishableRemoteReferences: mediaDocsPublish.publishable.length,
          localOnlyReferences: mediaDocsPublish.localOnly,
        },
        targets: {},
        ready: false,
      },
      music: {
        localCounts: {
          people: musicPublish.people.length,
          gamePeople: musicPublish.gamePeople.length,
          ost: musicPublish.ost.length,
          ostTracks: musicPublish.ostTracks.length,
          ostReleases: 0,
        },
        targets: {},
        ready: false,
      },
    },
  };

  if (!config) {
    report.supabase = {
      reason: 'Missing Supabase configuration in backend/.env',
    };
    writeJson(outputPath, report);
    writeJson(logPath, report);
    console.log(`[PUBLISH_DOMAINS] dry-run unavailable: ${report.supabase.reason}`);
    console.log(`[PUBLISH_DOMAINS] report: ${formatOutputPath(logPath)}`);
    return;
  }

  const { Client } = require(path.join(PROJECT_ROOT, 'backend', 'node_modules', 'pg'));
  const client = new Client(config);

  try {
    await client.connect();
    report.connected = true;
    const supabaseInfo = await inspectSupabase(client);
    report.supabase = supabaseInfo;

    report.domains.credits.targets = {
      companies: {
        exists: supabaseInfo.tables.companies,
        pendingRows: creditsPublish.companies.length,
      },
      people: {
        exists: supabaseInfo.tables.people,
        pendingRows: creditsPublish.people.length,
      },
      game_people: {
        exists: supabaseInfo.tables.game_people,
        pendingRows: creditsPublish.gamePeople.length,
      },
    };
    report.domains.credits.ready = Object.values(report.domains.credits.targets).every((target) => target.exists);
    report.domains.credits.blockedBy = Object.entries(report.domains.credits.targets).filter(([, target]) => !target.exists).map(([tableName]) => tableName);

    report.domains.editorial.targets = {
      game_editorial: {
        exists: supabaseInfo.tables.game_editorial,
        pendingRows: editorialPublish.length,
      },
    };
    report.domains.editorial.ready = report.domains.editorial.targets.game_editorial.exists;
    report.domains.editorial.blockedBy = report.domains.editorial.ready ? [] : ['game_editorial'];

    const remoteMediaKeys = supabaseInfo.tables.media_references ? await loadRemoteMediaReferences(client) : new Set();
    const pendingMediaRows = mediaDocsPublish.publishable.filter((entry) => !remoteMediaKeys.has(`${entry.entityId}|${entry.mediaType}|${entry.url}`));

    report.domains.mediaDocs.targets = {
      media_references: {
        exists: supabaseInfo.tables.media_references,
        localPublishableRows: mediaDocsPublish.publishable.length,
        pendingRows: pendingMediaRows.length,
        localOnlyRowsBlocked: mediaDocsPublish.localOnly,
      },
    };
    report.domains.mediaDocs.ready = report.domains.mediaDocs.targets.media_references.exists;
    report.domains.mediaDocs.blockedBy = report.domains.mediaDocs.ready ? [] : ['media_references'];

    report.domains.music.targets = {
      people: {
        exists: supabaseInfo.tables.people,
        pendingRows: musicPublish.people.length,
      },
      game_people: {
        exists: supabaseInfo.tables.game_people,
        pendingRows: musicPublish.gamePeople.length,
      },
      ost: {
        exists: supabaseInfo.tables.ost,
        pendingRows: musicPublish.ost.length,
      },
      ost_tracks: {
        exists: supabaseInfo.tables.ost_tracks,
        pendingRows: musicPublish.ostTracks.length,
      },
      ost_releases: {
        exists: supabaseInfo.tables.ost_releases,
        pendingRows: 0,
      },
    };
    report.domains.music.ready = Object.values(report.domains.music.targets).every((target) => target.exists);
    report.domains.music.blockedBy = Object.entries(report.domains.music.targets).filter(([, target]) => !target.exists).map(([tableName]) => tableName);
  } finally {
    await client.end().catch(() => {});
  }

  writeJson(outputPath, report);
  writeJson(logPath, report);

  console.log(`[PUBLISH_DOMAINS] dry-run connected`);
  console.log(`[PUBLISH_DOMAINS] credits ready=${report.domains.credits.ready} blockedBy=${report.domains.credits.blockedBy.join(',') || 'none'}`);
  console.log(`[PUBLISH_DOMAINS] editorial ready=${report.domains.editorial.ready} blockedBy=${report.domains.editorial.blockedBy.join(',') || 'none'}`);
  console.log(`[PUBLISH_DOMAINS] media_docs ready=${report.domains.mediaDocs.ready} pendingRemote=${report.domains.mediaDocs.targets.media_references.pendingRows} localOnly=${report.domains.mediaDocs.targets.media_references.localOnlyRowsBlocked}`);
  console.log(`[PUBLISH_DOMAINS] music ready=${report.domains.music.ready} blockedBy=${report.domains.music.blockedBy.join(',') || 'none'}`);
  console.log(`[PUBLISH_DOMAINS] report: ${formatOutputPath(logPath)}`);
}

main().catch((error) => {
  console.error(`[PUBLISH_DOMAINS] fatal: ${error.message}`);
  process.exit(1);
});
