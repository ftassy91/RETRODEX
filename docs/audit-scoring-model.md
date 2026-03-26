# Audit and Scoring Model

## Weighted score

- identity completeness: 30
- market readiness: 25
- source trust: 20
- editorial depth: 15
- structural consistency: 10

## Freshness score

- 100: last observation <= 30 days
- 75: <= 90 days
- 50: <= 180 days
- 25: <= 365 days
- 0: none or older

## Quality tiers

- Tier A: score >= 85 and no critical identity/provenance gap
- Tier B: 70-84
- Tier C: 50-69
- Tier D: < 50 or critical blocker

## Minimum game audit outputs

- total count
- count by platform
- count by quality tier
- count missing prices
- count missing summaries
- count missing dev team
- count missing composers
- count missing source attribution
- count with weak trust

## Minimum console audit outputs

- total count
- completeness by entity
- price readiness
- linkage to games

## Priority model

`priority_score = legal_feasibility * source_availability * (0.35 * user_value + 0.25 * business_value + 0.20 * missing_criticality + 0.20 * catalog_importance)`
