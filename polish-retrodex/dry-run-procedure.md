# Dry Run Procedure

## Goal
Validate the full Polish RetroDex v1.0 chain on a limited safe profile before any scale-up.

## Command
- `npm run prd:pipeline -- --profile=dry-run-sample`

## Included sample
- Pixel Warehouse: 2 platform scopes
- VGMaps: 1 platform scope
- VGMuseum: 1 whitelisted section

## Expected artifacts
- all six JSONL outputs created or appended
- `logs/run_reports/repo_audit_<run>.md`
- `logs/run_reports/dry_run_report_<run>.md`

## Validation points
- source counts are non-zero where expected
- normalization does not destroy title/platform information
- match statuses are distributed logically
- Pixel Warehouse publishes no assets
- only validated assets reach UI export
