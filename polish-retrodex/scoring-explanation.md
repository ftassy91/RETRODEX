# Match Scoring Explanation

The matching score is computed on 100 points.

## Breakdown
- `title_score` on 60
  - `0.7 * token similarity`
  - `0.3 * normalized Levenshtein`
- `platform_score` on 25
  - `25` exact canonical platform match
  - `20` same hardware family
  - `0` otherwise
- `alias_score` on 10
  - franchise, edition and region hints
- `context_score` on 5
  - source-specific context coherence

## Thresholds
- `>= 90` => `auto_matched`
- `75..89` => `needs_review`
- `< 75` => `rejected`

## Determinism
- no random weighting
- no hidden LLM inference
- same inputs must produce the same score and the same status
