#!/usr/bin/env node
'use strict';

const path = require('path');

const { gameSchema } = require('../schemas/game.schema');
const {
  LOGS_DIR,
  buildCompleteness,
  collectFieldNames,
  ensureWorkspace,
  formatOutputPath,
  readJson,
  resolveLatestRawFile,
  utcDateStamp,
  utcTimestampStamp,
  writeJson,
} = require('./_shared');

function resolveInputPath() {
  const explicit = process.argv.slice(2).find((arg) => arg.startsWith('--input='));
  if (explicit) {
    return path.resolve(process.cwd(), explicit.slice('--input='.length));
  }

  return resolveLatestRawFile();
}

function summarizeIssues(issues = []) {
  const counts = new Map();

  issues.forEach((issue) => {
    const pathKey = Array.isArray(issue.path) && issue.path.length
      ? issue.path.join('.')
      : '(root)';
    counts.set(pathKey, (counts.get(pathKey) || 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([field, count]) => ({ field, count }))
    .sort((left, right) => right.count - left.count || left.field.localeCompare(right.field));
}

function printTopIncomplete(completenessRows) {
  console.log('[VALIDATE] Top 10 champs les plus incomplets');
  completenessRows.slice(0, 10).forEach((row, index) => {
    console.log(`${String(index + 1).padStart(2, '0')}. ${row.field} -> ${row.missing}/${row.total} manquants (${row.completeness_pct}% complets)`);
  });
}

function main() {
  ensureWorkspace();

  const startedAt = new Date();
  const dateStamp = utcDateStamp(startedAt);
  const timestampStamp = utcTimestampStamp(startedAt);
  const inputPath = resolveInputPath();
  const rows = readJson(inputPath);
  const completeness = buildCompleteness(rows);
  const validationErrors = [];
  let validRows = 0;

  rows.forEach((row, index) => {
    const result = gameSchema.safeParse(row);
    if (result.success) {
      validRows += 1;
      return;
    }

    validationErrors.push({
      row_index: index,
      id: row?.id || null,
      issues: result.error.issues.map((issue) => ({
        path: issue.path,
        code: issue.code,
        message: issue.message,
        received: issue.received || null,
      })),
    });
  });

  const reportPath = path.join(LOGS_DIR, `validation_${dateStamp}_${timestampStamp}.json`);
  const summaryPath = path.join(LOGS_DIR, `run_${timestampStamp}.json`);
  const issueSummary = summarizeIssues(validationErrors.flatMap((entry) => entry.issues));
  const reportPayload = {
    pipeline: '02_validate',
    run_at: startedAt.toISOString(),
    input: formatOutputPath(inputPath),
    total_rows: rows.length,
    valid_rows: validRows,
    invalid_rows: validationErrors.length,
    expected_fields: collectFieldNames(rows),
    top_incomplete_fields: completeness.slice(0, 10),
    issue_summary: issueSummary,
    invalid_samples: validationErrors.slice(0, 25),
  };

  const summaryPayload = {
    pipeline: '02_validate',
    run_at: startedAt.toISOString(),
    source: formatOutputPath(inputPath),
    total_read: rows.length,
    total_written: validRows,
    errors: validationErrors.length,
    skipped: 0,
    nulls: Object.fromEntries(completeness.map((entry) => [entry.field, entry.missing])),
    output: formatOutputPath(reportPath),
  };

  writeJson(reportPath, reportPayload);
  writeJson(summaryPath, summaryPayload);

  console.log(`[VALIDATE] ${rows.length} lus, ${validRows} valides, ${validationErrors.length} erreurs, rapport: ${formatOutputPath(reportPath)}`);
  printTopIncomplete(completeness);
}

main();
