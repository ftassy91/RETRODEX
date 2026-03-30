"use strict";

const {
  OUTPUT_FILES,
  ensureBaseDirs,
  loadConfig,
  nowIso,
  parseArgs,
  readJson,
  readJsonl,
  relativeToProject,
  writeReportMarkdown,
} = require("../core/shared");
const { runDiscover } = require("./run-discover");
const { runNormalize } = require("./run-normalize");
const { runMatch } = require("./run-match");
const { runPublish } = require("./run-publish");
const { runReview } = require("./run-review");
const { runNotionSync } = require("./run-notion-sync");
const { runUiExport } = require("./export-ui-payloads");

function buildRepoAuditReport(runId) {
  const report = `# Repo Audit - ${runId}

- Runtime chosen: Node/JS, aligned with the existing \`polish-retrodex/\` workspace.
- Reused lineage: \`polish-retrodex/pipelines/01..10\`, \`scripts/sync/sync-gate.js\`, \`scripts/sync/sync-module.js\`, \`scripts/audit/write_checkpoint.py\`.
- Retained conventions:
  - outputs append-only en JSONL
  - checkpoints under \`polish-retrodex/logs/checkpoints/\`
  - markdown reports under \`polish-retrodex/logs/run_reports/\`
  - local canonical matching on \`data/exports/games_export.json\` with read-only SQLite fallback
  - no backend/Supabase write by default
- v1 truth layers:
  - \`source_records\`
  - \`normalized_records\`
  - \`match_candidates\`
  - \`external_assets\`
  - \`review_queue\`
  - \`ui_payloads\`
- Notion governance:
  - staging only through the existing sync gate
  - no direct Notion write outside approved workflow
- Legacy pipeline \`scripts/pipeline/*.js\`: partially reusable, but not the v1 baseline.
`;
  return writeReportMarkdown(`repo_audit_${runId}.md`, report);
}

function buildDryRunReport(runId) {
  const discoverReport = readJson(
    require("path").join(require("path").dirname(OUTPUT_FILES.source_records), `discover_report_${runId}.json`),
    { summary: [] },
  );
  const sourceRows = readJsonl(OUTPUT_FILES.source_records).filter((row) => row.run_id === runId);
  const normalizedRows = readJsonl(OUTPUT_FILES.normalized_records).filter((row) => row.run_id === runId);
  const bySourceLines = (discoverReport.summary || []).map((item) => {
    const discovered = item.stats?.total_records ?? item.inserted ?? 0;
    return `- ${item.source}: discovered=${discovered}, inserted=${item.inserted}, duplicates=${item.duplicates || 0}`;
  });
  const duplicates = (discoverReport.summary || []).reduce((acc, item) => acc + (item.duplicates || 0), 0);
  const parsingIssues = normalizedRows.filter((row) => !row.title_normalized || !row.platform_normalized).length;
  const matchingReady = normalizedRows.filter((row) => row.title_normalized && row.platform_normalized).length;

  const report = `# Dry Run Report - ${runId}

Generated at: ${nowIso()}

## Counts by source
${bySourceLines.join("\n")}

## Normalization
- normalized records: ${normalizedRows.length}
- obvious parsing issues: ${parsingIssues}
- matching readiness: ${matchingReady}/${normalizedRows.length}

## Noise assessment
- duplicate source records: ${duplicates}
- stage 5 stops before reviewed matching decisions

## Recommended fixes before scale
- inspect low-volume sources if counts are unexpectedly small
- extend platform aliases for any unmatched platform labels
- whitelist additional VGMuseum sections only after review of parse quality
- keep Pixel Warehouse as seed-only, no asset publication
`;
  return writeReportMarkdown(`dry_run_report_${runId}.md`, report);
}

async function runPipeline(options = {}) {
  ensureBaseDirs();
  const args = options.args || parseArgs(process.argv.slice(2));
  const stagesConfig = loadConfig("stages.json");
  const profile = options.profile || args.profile || "dry-run-sample";
  if (!stagesConfig[profile]) {
    throw new Error(`Unknown pipeline profile "${profile}".`);
  }

  const discoverResult = await runDiscover({
    runId: options.runId,
    profile,
    resume: args.resume || options.resume,
  });
  const runId = discoverResult.runId;
  const repoAuditPath = buildRepoAuditReport(runId);
  const normalizeResult = await runNormalize({ runId, resume: args.resume || options.resume });
  const dryRunReportPath = buildDryRunReport(runId);
  const matchResult = await runMatch({ runId, resume: args.resume || options.resume });
  const publishResult = await runPublish({ runId, resume: args.resume || options.resume, dryRun: true });
  const reviewResult = await runReview({ runId, resume: args.resume || options.resume });
  const notionResult = await runNotionSync({ runId, dryRun: true });
  const uiResult = await runUiExport({ runId });

  return {
    runId,
    profile,
    repoAuditPath,
    dryRunReportPath,
    discoverResult,
    normalizeResult,
    matchResult,
    publishResult,
    reviewResult,
    notionResult,
    uiResult,
  };
}

if (require.main === module) {
  runPipeline().then((result) => {
    console.log(JSON.stringify({
      ok: true,
      run_id: result.runId,
      profile: result.profile,
      repo_audit: relativeToProject(result.repoAuditPath),
      dry_run_report: relativeToProject(result.dryRunReportPath),
      outputs: Object.fromEntries(
        Object.entries(OUTPUT_FILES).map(([key, value]) => [key, relativeToProject(value)]),
      ),
    }, null, 2));
  }).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  runPipeline,
};
