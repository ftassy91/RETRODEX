#!/usr/bin/env node
'use strict';

const path = require('path');

const {
  LOGS_DIR,
  RAW_DIR,
  SOURCE_DB_PATH,
  collectNulls,
  ensureWorkspace,
  formatOutputPath,
  resolveBetterSqlite3,
  sha256,
  utcDateStamp,
  utcTimestampStamp,
  writeJson,
} = require('./_shared');

function detectGamesQuery(sqlite) {
  const columns = sqlite.prepare('PRAGMA table_info(games)').all().map((column) => String(column.name || ''));
  return columns.includes('type')
    ? 'SELECT * FROM games WHERE type = ? ORDER BY title ASC, id ASC'
    : 'SELECT * FROM games ORDER BY title ASC, id ASC';
}

function main() {
  ensureWorkspace();

  const Database = resolveBetterSqlite3();
  const sqlite = new Database(SOURCE_DB_PATH, { readonly: true });

  try {
    const startedAt = new Date();
    const dateStamp = utcDateStamp(startedAt);
    const timestampStamp = utcTimestampStamp(startedAt);
    const outputPath = path.join(RAW_DIR, `games_${dateStamp}.json`);
    const logPath = path.join(LOGS_DIR, `run_${timestampStamp}.json`);
    const query = detectGamesQuery(sqlite);
    const rows = query.includes('type = ?')
      ? sqlite.prepare(query).all('game')
      : sqlite.prepare(query).all();

    writeJson(outputPath, rows);

    const checksum = sha256(JSON.stringify(rows));
    const logPayload = {
      pipeline: '01_ingest',
      run_at: startedAt.toISOString(),
      source: SOURCE_DB_PATH,
      source_table: 'games',
      total_read: rows.length,
      total_written: rows.length,
      errors: 0,
      skipped: 0,
      checksum,
      nulls: collectNulls(rows),
      output: formatOutputPath(outputPath),
    };

    writeJson(logPath, logPayload);

    console.log(`[INGEST] ${rows.length} lus, ${rows.length} ecrits, 0 erreurs, checkpoint: ${formatOutputPath(logPath)}`);
    console.log(`[INGEST] checksum: ${checksum}`);
    console.log(`[INGEST] output: ${formatOutputPath(outputPath)}`);
  } finally {
    sqlite.close();
  }
}

main();
