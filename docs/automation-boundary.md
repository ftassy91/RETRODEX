# RetroDex — Automation Boundary
## Last updated: 2026-03-18 — Sprint 2

---

## What is automated (safe to run anytime)
- validate_all.js — read-only, safe at any time
- audit_games.js — read-only, safe at any time
- validate_import.js — read-only, safe at any time
- daily_run.js — validate + audit + stage only, no external writes
- sync-gate.js stage / list / dryrun — local only, no external writes
- generate_assets.py — local PNG generation, no external writes

## What requires manual approval (one action at a time)
- sync-gate.js approve — writes ONE entry to Notion Codex Sync Log
- test-approve.mjs — same, stable fallback
- importGamesFromCSV() — modifies SQLite, requires backup first
- enrich_summaries.js — modifies SQLite summaries

## What is permanently disabled until sign-off
- broadAutomationEnabled (currently: false in notion.config.js)
- Games database sync to Notion
- Assets metadata sync to Notion
- Market data sync to Notion
- Any cron or scheduled sync loop
- Mass delete or replace of SQLite records

---

## Safe activation checklist for broadAutomationEnabled

Before setting broadAutomationEnabled to true, ALL of these must be true:

- [ ] validate_all.js passes 4/4 on TWO consecutive days
- [ ] At least 5 successful manual approve cycles completed
- [ ] NOTION_API_KEY confirmed working end-to-end from sync-gate.js
- [ ] SQLite backup confirmed in backend/storage/retrodex.sqlite.bak
- [ ] All Notion databases connected and responding 200
- [ ] Explicit written sign-off from project owner in this document

**Current status:** NOT ACTIVATED

---

## Safe activation checklist for importGamesFromCSV()

Before running a bulk import:

- [ ] SQLite backup created: cp backend/storage/retrodex.sqlite backend/storage/retrodex.sqlite.bak
- [ ] validate_import.js passes before import
- [ ] CSV validated manually (headers correct, no blank id/title rows)
- [ ] validate_import.js run again after import to confirm counts

---

## Emergency recovery

If SQLite is corrupted or data is lost:
1. Stop the backend (Ctrl+C)
2. Copy backup: cp backend/storage/retrodex.sqlite.bak backend/storage/retrodex.sqlite
3. Restart backend: node server.js
4. Run: node scripts/audit/validate_all.js
