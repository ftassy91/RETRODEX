"use strict";

const path = require("path");

const {
  OUTPUT_FILES,
  appendJsonl,
  appendPipelineLog,
  buildScopedId,
  ensureBaseDirs,
  getLatestRunId,
  nowIso,
  parseArgs,
  readJson,
  readJsonl,
  relativeToProject,
  writeJson,
} = require("../core/shared");

function buildReviewEntry(runId, payload) {
  return {
    run_id: runId,
    stage: "review",
    schema_version: "polish-retrodex.review_queue.v1",
    created_at: nowIso(),
    updated_at: nowIso(),
    status: "open",
    assigned_to: null,
    ...payload,
  };
}

async function runReview(options = {}) {
  ensureBaseDirs();
  const args = options.args || parseArgs(process.argv.slice(2));
  const runId = options.runId || args["run-id"] || getLatestRunId(OUTPUT_FILES.match_candidates);
  if (!runId) {
    throw new Error("No match run available for review.");
  }

  const sourceRecords = readJsonl(OUTPUT_FILES.source_records)
    .filter((row) => row.run_id === runId)
    .reduce((acc, row) => {
      acc[row.source_record_id] = row;
      return acc;
    }, {});
  const matches = readJsonl(OUTPUT_FILES.match_candidates).filter((row) => row.run_id === runId);
  const existing = new Set(
    readJsonl(OUTPUT_FILES.review_queue)
      .filter((row) => row.run_id === runId)
      .map((row) => row.entity_id),
  );
  const publishReport = readJson(path.join(path.dirname(OUTPUT_FILES.external_assets), `publish_report_${runId}.json`), { skipped_rows: [] });

  const reviewRows = [];

  for (const match of matches) {
    if (existing.has(match.source_record_id)) {
      continue;
    }

    if (match.match_status === "needs_review") {
      reviewRows.push(buildReviewEntry(runId, {
        review_id: buildScopedId("review", [match.source_record_id, "needs-review"]),
        entity_type: "game_match",
        entity_id: match.source_record_id,
        issue_type: "ambiguous_match",
        priority: match.match_score >= 85 ? "high" : "medium",
        reason: match.match_reason,
        proposed_game_id: match.game_id,
        match_score: match.match_score,
      }));
      continue;
    }

    if (match.match_status === "rejected" && match.match_score >= 70) {
      reviewRows.push(buildReviewEntry(runId, {
        review_id: buildScopedId("review", [match.source_record_id, "rejected"]),
        entity_type: "game_match",
        entity_id: match.source_record_id,
        issue_type: "rejected_match",
        priority: "low",
        reason: match.match_reason,
        proposed_game_id: match.game_id,
        match_score: match.match_score,
      }));
    }
  }

  for (const skipped of publishReport.skipped_rows || []) {
    if (existing.has(skipped.source_record_id)) {
      continue;
    }
    const record = sourceRecords[skipped.source_record_id];
    if (!record) {
      continue;
    }
    const brokenLink = skipped.healthcheck_status === "broken" || skipped.healthcheck_status === "timeout";
    const actionableValidation = !brokenLink
      && record.source_name !== "pixel_warehouse"
      && skipped.reason
      && !/catalog seed only/i.test(skipped.reason)
      && !/match not publishable/i.test(skipped.reason);
    if (!brokenLink && !actionableValidation) {
      continue;
    }
    reviewRows.push(buildReviewEntry(runId, {
      review_id: buildScopedId("review", [skipped.source_record_id, "publish"]),
      entity_type: "external_asset",
      entity_id: skipped.source_record_id,
      issue_type: brokenLink
        ? "broken_url"
        : "asset_validation",
      priority: brokenLink
        ? "high"
        : "medium",
      reason: skipped.reason,
      proposed_game_id: null,
      match_score: null,
    }));
  }

  appendJsonl(OUTPUT_FILES.review_queue, reviewRows);
  appendPipelineLog("info", "review", "Review queue generated.", { runId, inserted: reviewRows.length });

  const reportPath = path.join(path.dirname(OUTPUT_FILES.review_queue), `review_report_${runId}.json`);
  writeJson(reportPath, {
    run_id: runId,
    generated_at: nowIso(),
    review_entries: reviewRows.length,
    sample: reviewRows.slice(0, 25),
  });

  return {
    runId,
    inserted: reviewRows.length,
    outputFile: OUTPUT_FILES.review_queue,
    reportPath,
  };
}

if (require.main === module) {
  runReview().then((result) => {
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
  runReview,
};
