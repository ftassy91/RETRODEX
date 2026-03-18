RetroDex asset pipeline

Purpose
- Build a persistent local sprite library for RetroDex without losing progress if execution stops.

What it creates
- `RETRODEXseedV0/prototype_v0/retrodeck_assets/<game_slug>/sprite.png`
- `RETRODEXseedV0/prototype_v0/retrodeck_assets/<game_slug>/metadata.json`
- `RETRODEXseedV0/prototype_v0/retrodeck_assets/checkpoint.json`
- `RETRODEXseedV0/prototype_v0/retrodeck_assets/asset_pipeline.log`
- `RETRODEXseedV0/prototype_v0/data/retrodeck_asset_library.json`
- `RETRODEXseedV0/prototype_v0/data/retrodeck_asset_library.js`

Current source strategy
- Reuses `data/top_screen_artwork.js` manual and identity overrides.
- Reuses the curated Wikipedia map already embedded in `js/top-screen.js`.
- Downloads the selected source image, converts it to a 4-tone Game Boy palette sprite, and stores it locally.

Safety rules
- Each game is saved immediately after processing.
- Checkpoint is updated after every game.
- Existing completed entries are not overwritten unless `--force` is used.
- The generated library manifest is rewritten after every game so the UI can resume from partial progress.

Usage
- `python data_engine/asset_pipeline/build_asset_library.py`
- `python data_engine/asset_pipeline/build_asset_library.py --limit 25`
- `python data_engine/asset_pipeline/build_asset_library.py --force`
