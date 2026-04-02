"use strict";

const path = require("path");

const { extractFranchiseHints } = require("../core/extract-franchise");
const { normalizePlatform } = require("../core/normalize-platforms");
const { normalizeTitle } = require("../core/normalize-titles");
const {
  OUTPUT_FILES,
  appendJsonl,
  appendPipelineLog,
  buildScopedId,
  ensureBaseDirs,
  getLatestRunId,
  nowIso,
  parseArgs,
  readJsonl,
  relativeToProject,
  writeJson,
} = require("../core/shared");

async function runNormalize(options = {}) {
  ensureBaseDirs();
  const args = options.args || parseArgs(process.argv.slice(2));
  const runId = options.runId || args["run-id"] || getLatestRunId(OUTPUT_FILES.source_records);
  if (!runId) {
    throw new Error("No discover run available for normalization.");
  }

  const sourceRows = readJsonl(OUTPUT_FILES.source_records).filter((row) => row.run_id === runId);
  const existing = new Set(
    readJsonl(OUTPUT_FILES.normalized_records)
      .filter((row) => row.run_id === runId)
      .map((row) => row.source_record_id),
  );

  const normalizedRows = [];
  const transformations = [];

  for (const row of sourceRows) {
    if ((args.resume || options.resume) && existing.has(row.source_record_id)) {
      continue;
    }

    const title = normalizeTitle(row.title_raw);
    const variant = normalizeTitle(row.variant_label || "");
    const platform = normalizePlatform(row.platform_raw);
    const hints = extractFranchiseHints(row.title_raw);
    const notes = [...title.notes, ...platform.notes, ...hints.notes];
    if (row.variant_label && variant.normalized && variant.normalized !== title.normalized) {
      notes.push("preserved variant label for asset-level context");
    }

    normalizedRows.push({
      run_id: runId,
      stage: "normalize",
      schema_version: "polish-retrodex.normalized_records.v2",
      created_at: nowIso(),
      source_name: row.source_name,
      normalized_record_id: buildScopedId("norm", [row.source_record_id]),
      source_record_id: row.source_record_id,
      content_type: row.content_type || "source_record",
      title_normalized: title.normalized,
      title_match_key: title.normalized,
      platform_normalized: platform.normalized,
      platform_family: platform.family || platform.normalized,
      franchise_normalized: hints.franchise_normalized,
      edition_hint: hints.edition_hint,
      region_hint: hints.region_hint,
      variant_label: row.variant_label || null,
      variant_label_normalized: variant.normalized || null,
      content_type_normalized: String(row.content_type || "source_record").trim().toLowerCase(),
      asset_type: row.asset_type_guess || null,
      asset_subtype: row.asset_subtype || null,
      normalization_notes: notes,
      canonical_lookup_key: `${title.normalized}::${platform.normalized}`,
      source_context: row.source_context || {},
      contributor_raw: row.contributor_raw || null,
    });

    if (notes.length) {
      transformations.push({
        source_record_id: row.source_record_id,
        title_raw: row.title_raw,
        title_normalized: title.normalized,
        platform_raw: row.platform_raw,
        platform_normalized: platform.normalized,
        notes,
      });
    }
  }

  appendJsonl(OUTPUT_FILES.normalized_records, normalizedRows);
  appendPipelineLog("info", "normalize", "Normalization completed.", { runId, inserted: normalizedRows.length });

  const reportPath = path.join(path.dirname(OUTPUT_FILES.normalized_records), `normalize_report_${runId}.json`);
  writeJson(reportPath, {
    run_id: runId,
    generated_at: nowIso(),
    input_records: sourceRows.length,
    normalized_records: normalizedRows.length,
    transformed_records: transformations.length,
    sample_transformations: transformations.slice(0, 25),
  });

  return {
    runId,
    inserted: normalizedRows.length,
    outputFile: OUTPUT_FILES.normalized_records,
    reportPath,
  };
}

if (require.main === module) {
  runNormalize().then((result) => {
    console.log(JSON.stringify({
      ok: true,
      run_id: result.runId,
      inserted: result.inserted,
      output_file: relativeToProject(result.outputFile),
      report: relativeToProject(result.reportPath),
    }, null, 2));
  }).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  runNormalize,
};
