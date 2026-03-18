# RetroMarket Curation Batch 001

This workspace is a preparation layer for the first verified import batch.
Snapshot prices below come from the local RetroDex price dataset and are only reference points.
Verified history, sales, and source fields must be filled from real checked sources before rebuild.

## Workflow
1. Fill `market_history_template.json` with verified yearly points
2. Fill `market_sales_template.json` with verified recent sales
3. Fill `market_sources_template.json` with source metadata
4. Run `python prototype_v2/data/refresh_market_imports.py`

## Priority Games

| # | Game | Console | Year | Meta | Snapshot Loose | Snapshot CIB | Snapshot Mint | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | The Legend of Zelda: Ocarina of Time | Nintendo 64 | 1998 | 99 | $9 | $22 | $56 | verified_batch_ready |
| 2 | Tony Hawk's Pro Skater 2 | PlayStation | 2000 | 98 | $29 | $47 | $64 | sales_and_source_captured |
| 3 | Soul Calibur | Dreamcast | 1999 | 98 | $15 | $15 | $53 | sales_and_source_captured |
| 4 | Panzer Dragoon Saga | Sega Saturn | 1998 | 98 | $770 | $1411 | $2369 | sales_and_source_captured |
| 5 | Tetris | Game Boy | 1989 | 98 | $11 | $53 | $78 | sales_and_source_captured |
| 6 | Perfect Dark | Nintendo 64 | 2000 | 97 | $20 | $30 | $50 | sales_and_source_captured |
| 7 | Super Mario 64 | Nintendo 64 | 1996 | 97 | $7 | $41 | $43 | verified_batch_ready |
| 8 | Super Mario Bros. 3 | Nintendo Entertainment System | 1990 | 97 | $10 | $29 | $40 | sales_and_source_captured |
| 9 | Tekken 3 | PlayStation | 1998 | 96 | $12 | $28 | $65 | sales_and_source_captured |
| 10 | Gran Turismo | PlayStation | 1997 | 96 | $9 | $22 | $55 | sales_and_source_captured |
| 11 | GoldenEye 007 | Nintendo 64 | 1997 | 96 | $8 | $28 | $58 | sales_and_source_captured |
| 12 | Super Mario World 2: Yoshi's Island | Super Nintendo | 1995 | 96 | $13 | $19 | $28 | sales_and_source_captured |

## Source Capture Checklist

- Record exact source type and source name for every curated game.
- Prefer auction archives, sold listings, or clearly attributable market databases.
- Use ISO dates (`YYYY-MM-DD`) for sales entries.
- Keep values numeric only in JSON templates.
