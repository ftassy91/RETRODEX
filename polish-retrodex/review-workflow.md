# Review Workflow

## Review queue entry types
- `ambiguous_match`
- `rejected_match`
- `asset_validation`
- `broken_url`

## Priority rules
- `high`
  - close ambiguous matches
  - broken URLs for otherwise publishable assets
- `medium`
  - uncertain asset validation
  - weaker ambiguous matches
- `low`
  - rejected matches kept for audit

## Operational loop
1. Run the pipeline in sample mode.
2. Inspect `outputs/review_queue.jsonl`.
3. Approve or reject candidate matches outside the pipeline.
4. Rerun publish and UI export only after match decisions are clear.
