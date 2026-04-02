# RetroDex Completion Coverage Model

## Purpose

RetroDex now distinguishes two internal reads:

- `Audit quality`: how strong and publishable a game or catalogue slice is overall.
- `Completion coverage`: how much of the tracked enrichment surface is actually filled, targeted, or blocked by source.

The goal is not to replace audit scoring. The goal is to make enrichment coverage readable and pilotable.

## Canonical sources

The completeness stack is intentionally converged:

- audit snapshots in `backend/data/audit/`
- top1200 selection band in `backend/data/audit/top1200/`
- shared completion service in `backend/src/services/admin/completion-service.js`
- CLI read via `npm run enrichment:report-top1200-richness`
- API read via `/api/audit/completion`
- internal page via `/completion.html`

These surfaces must read the same model, not parallel interpretations.

## Families and statuses

Tracked families:

- `identity`
- `editorial`
- `crew`
- `market`
- `media`
- `collection`

Tracked statuses:

- `strong`
- `close`
- `weak`
- `blocked_by_source`

`blocked_by_source` means the gap is known and tracked, but no safe exploitable source currently closes it.

## Bands

The internal reading is split by catalogue bands:

- `Top100`
- `Top500`
- `Top1200`
- `Long tail`

`Top1200` is the canonical operational band for richness coverage.

## Operational reading

Use the model this way:

1. Read `audit quality` to understand catalogue health.
2. Read `completion coverage` to decide what to enrich next.
3. Use `field_rankings` for immediate gaps.
4. Use `blocked_by_source` to separate real debt from source-limited debt.

## Surface boundaries

- Public product pages may expose compact derived signals only.
- Full completeness payloads belong to back-office surfaces.
- `completion.html` is internal and non-primary.
