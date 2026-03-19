# scripts/sync — Pipeline de synchronisation Notion

Synchronisation manuelle uniquement. Pas d'auto-approve.

sync-gate.js     — stage / list / dryrun / approve (CLI)
sync-module.js   — API de staging pour daily_run
daily_run.js     — validate + audit + stage (jamais approve auto)
test-approve.mjs — approve stable via top-level await
notion.config.js — configuration cibles Notion

RÈGLE : broadAutomationEnabled = false.
Ne jamais passer à true sans sign-off explicite.
