# RetroDex — Automation Boundary

## What is automated (safe to run)
- `validate_all.js` — read-only checks, safe at any time
- `audit_games.js` — read-only audit, safe at any time
- `daily_run.js` — validation + staging only, no external writes
- `sync-gate.js stage/list/dryrun` — local only, no external writes

## What requires manual approval
- `sync-gate.js approve` — writes ONE entry to Notion Codex Sync Log
- Any game data import (`import_games.js`, `enrich_summaries.js`)

## What is permanently disabled until Phase 6 sign-off
- `broadAutomationEnabled` (currently false in `notion.config.js`)
- Games database sync to Notion
- Assets metadata sync to Notion
- Market data sync to Notion
- Any cron or scheduled sync

## Safe activation conditions for broader automation
Before enabling `broadAutomationEnabled`:
- [ ] `validate_all.js` passes 4/4 on two consecutive days
- [ ] At least 5 successful manual approve cycles completed
- [ ] `NOTION_API_KEY` confirmed working end-to-end from `sync-gate.js`
- [ ] Explicit sign-off from project owner
