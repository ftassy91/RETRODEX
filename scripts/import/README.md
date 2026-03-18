# Root Import Module

This module validates future import files before any data is ingested.

## What it does now
- validates JSON payloads for future `games` and `assets` imports
- writes import attempt logs to `logs/import/import_attempts.jsonl`
- writes the latest validation report to `logs/import/latest_import_report.json`

## What it does not do yet
- no game import into runtime data
- no asset registration into live datasets
- no market import execution
- no Notion sync side effects

## Entry point
```powershell
python scripts/import/validate_import.py --kind games --input path\\to\\candidate_games.json
```

## Supported schemas
### `games`
- JSON array or `{ "records": [...] }`
- required fields per record:
  - `title` (string)
  - `platform` (string)
  - `release_year` (integer)
- optional fields:
  - `genre`
  - `developer`
  - `publisher`
  - `franchise`
  - `episode`
  - `asset_refs` (array of strings)

### `assets`
- JSON array or `{ "records": [...] }`
- required fields per record:
  - `game_title` (string)
  - `asset_type` (string)
  - `source_path` (string)
- optional fields:
  - `platform`
  - `asset_path`
  - `variant`
  - `notes`
  - `checksum`
  - `tags` (array of strings)
