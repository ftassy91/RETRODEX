# scripts/assets - batch asset utilities

`generate_assets.py` generates 320x180 PNG title cards in `assets/generated_gb/`.
Usage: `python generate_assets.py [--limit N]`
Output: `assets/generated_gb/<game_id>.png`

`scan-assets.js` scans local asset folders against the active games list.
Usage: `node scan-assets.js [--json] [--missing-only] [--verbose]`
Alternate usage: `node scripts/assets/scan-assets.js [options]`

Default games sources, in order:
- `data/exports/games_export.json`
- `frontend/data/entries.json`
- `frontend/data/catalog.json`
- `data/games.json`

Default asset types:
- `generated_gb`
- `covers`
- `notices`

Useful options:
- `--games <path>` to override the games JSON source
- `--types generated_gb,covers` to restrict scanned asset types
- `--report <path>` to override the JSON report file
- `--no-report` to skip writing `logs/audit/asset-scan-report.json`
