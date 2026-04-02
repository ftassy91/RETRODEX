"use strict";

const path = require("path");

const { healthcheckUrl } = require("../core/healthcheck-urls");
const { publishAsset } = require("../core/publish-assets");
const { validateAsset } = require("../core/validate-assets");
const {
  OUTPUT_FILES,
  appendJsonl,
  appendPipelineLog,
  ensureBaseDirs,
  getLatestRunId,
  nowIso,
  parseArgs,
  readJsonl,
  relativeToProject,
  writeJson,
} = require("../core/shared");

function dedupeSkippedRows(rows) {
  const seen = new Set();
  const unique = [];
  for (const row of rows) {
    const key = [
      row.source_record_id || "",
      row.reason || "",
      row.healthcheck_status || "",
    ].join("::");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(row);
  }
  return unique;
}

async function runPublish(options = {}) {
  ensureBaseDirs();
  const args = options.args || parseArgs(process.argv.slice(2));
  const runId = options.runId || args["run-id"] || getLatestRunId(OUTPUT_FILES.match_candidates);
  if (!runId) {
    throw new Error("No match run available for publish.");
  }

  const sourceRecords = readJsonl(OUTPUT_FILES.source_records)
    .filter((row) => row.run_id === runId)
    .reduce((acc, row) => {
      acc[row.source_record_id] = row;
      return acc;
    }, {});

  const matchRows = readJsonl(OUTPUT_FILES.match_candidates).filter((row) => row.run_id === runId);
  const existing = new Set(
    readJsonl(OUTPUT_FILES.external_assets)
      .filter((row) => row.run_id === runId)
      .map((row) => row.source_record_id),
  );

  const publishableRows = [];
  const skipped = [];

  for (const match of matchRows) {
    const record = sourceRecords[match.source_record_id];
    if (!record) {
      continue;
    }
    if ((args.resume || options.resume) && existing.has(record.source_record_id)) {
      continue;
    }
    if (record.source_name === "pixel_warehouse") {
      skipped.push({
        source_record_id: record.source_record_id,
        reason: "catalog seed only",
      });
      continue;
    }

    if (!["auto_matched", "approved"].includes(match.match_status)) {
      skipped.push({
        source_record_id: record.source_record_id,
        reason: "match not publishable",
      });
      continue;
    }

    const health = await healthcheckUrl(record.detail_url || record.record_url);
    const validation = validateAsset(record, match, health);

    if (
      !validation.ui_allowed
      || !validation.asset_type
      || validation.license_status === "blocked"
    ) {
      skipped.push({
        source_record_id: record.source_record_id,
        reason: validation.notes.join("; ") || match.match_status,
        healthcheck_status: health.healthcheck_status,
      });
      continue;
    }

    publishableRows.push({
      run_id: runId,
      stage: "publish",
      schema_version: "polish-retrodex.external_assets.v1",
      created_at: nowIso(),
      source_name: record.source_name,
      ...publishAsset(record, match, validation, health),
    });
  }

  appendJsonl(OUTPUT_FILES.external_assets, publishableRows);
  appendPipelineLog("info", "publish", "Publish evaluation completed.", {
    runId,
    published: publishableRows.length,
    skipped: skipped.length,
  });

  const uniqueSkipped = dedupeSkippedRows(skipped);

  const reportPath = path.join(path.dirname(OUTPUT_FILES.external_assets), `publish_report_${runId}.json`);
  writeJson(reportPath, {
    run_id: runId,
    generated_at: nowIso(),
    published: publishableRows.length,
    skipped: uniqueSkipped.length,
    skipped_total: skipped.length,
    skipped_rows: uniqueSkipped,
  });

  return {
    runId,
    inserted: publishableRows.length,
    outputFile: OUTPUT_FILES.external_assets,
    reportPath,
    skipped: uniqueSkipped,
  };
}

if (require.main === module) {
  runPublish().then((result) => {
    console.log(JSON.stringify({
      ok: true,
      run_id: result.runId,
      inserted: result.inserted,
      skipped: result.skipped.length,
      output_file: relativeToProject(result.outputFile),
      report: relativeToProject(result.reportPath),
    }, null, 2));
  }).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  runPublish,
};
