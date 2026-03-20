# Canonical Path Remediation Summary

Date: 2026-03-18

## Scope
- Fixed the backend reseed path to use the local repository frontend data source.
- Aligned root launch instructions with the files that actually exist.
- Removed root launcher dependencies on any external workspace.
- Documented the canonical repository architecture without migrating the codebase.

## Changes Applied
- `backend/src/loadPrototypeData.js`
  - Reseed now resolves data from `RETRODEXseedV0/prototype_v0/data`.
- `README.md`
  - Root launch instructions now point to `RetroDex_Backend.bat` and `RetroDex_Frontend.vbs`.
- `RetroDex_Frontend.vbs`
  - Launches only the local frontend at `RETRODEXseedV0/prototype_v0`.
- `Creer_Raccourcis.vbs`
  - Desktop shortcut now targets `RetroDex_Backend.bat` instead of the missing `RetroDex_Backend.vbs`.
- `docs/project_overview.md`
- `docs/development_workflow.md`
- `docs/setup_runbook.md`
  - These documents now describe the real canonical structure:
    - repository root: `RETRODEXseed`
    - backend: `backend/`
    - canonical frontend: `RETRODEXseedV0/prototype_v0/`
- Operationally misleading `prototype_v2` references were updated in:
  - `backend/README.md`
  - `RETRODEXseedV0/README_RETRODEXseedV0.md`
  - `RETRODEXseedV0/manifest.json`
  - `RETRODEXseedV0/prototype_v0/start.sh`
  - `RETRODEXseedV0/prototype_v0/CHART_INSTALL.md`
  - `RETRODEXseedV0/prototype_v0/maps/README.md`
  - `RETRODEXseedV0/prototype_v0/modules/retromarket/README.md`
  - `RETRODEXseedV0/prototype_v0/data_engine/asset_pipeline/README.md`
  - `project_map.md`
  - `duplicate_report.md`

## Verification
- Backend reseed succeeds from the local repository.
- Backend smoke test passes after reseed.
- Local frontend pages `launcher.html` and `index.html` are reachable when served from `RETRODEXseedV0/prototype_v0`.
- Root frontend launcher no longer contains any external workspace fallback.

## Remaining Automation Blockers
- Root-level `scripts/sync/` and `scripts/import/` are still placeholders.
- The repository still contains legacy and generated artifacts that need a later cleanup policy.
- Several product modules and datasets remain incomplete, so broad automation should stay disabled for now.
