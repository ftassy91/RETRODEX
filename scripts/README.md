# Root Scripts

This directory contains root-level process utilities for the RetroDex Dev
Trinity workflow.

## Modules
- `scripts/sync/` = local-only sync event recording and future Notion handoff
- `scripts/import/` = local-only import validation and import attempt logging
- `scripts/audit/` = checkpoints and audit helpers

## Current policy
- Root scripts are intentionally explicit and local-first.
- They do not run autonomous loops.
- They do not write to Notion directly.
- They do not replace the existing frontend/backend runtime yet.

## Current entrypoints
- `python scripts/sync/local_sync.py --help`
- `python scripts/import/validate_import.py --help`
- `python scripts/audit/write_checkpoint.py --help`
- `node scripts/sync/sync-gate.js list`
