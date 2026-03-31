# Console and Developer Transition Strategy

State recorded on March 31, 2026.

This document defines the future additive path for `games.console` and `games.developer`.

## Current Runtime Contract

The active public runtime still depends on these string fields in `public.games`:

- `games.console`
- `games.developer`

That means:

- they remain the factual production contract today
- `console_id` and `developer_id` are not ready to replace them
- no FK-first migration should be started from the current state

## Why the Transition Must Stay Additive

The runtime, frontend payloads, and existing Supabase read models still resolve console and developer identity from the string fields. A direct FK cutover would create avoidable regressions in:

- catalog filters
- console payloads
- search projections
- publication payloads
- quality and curation side pipelines

## Approved Future Sequence

1. Keep `games.console` and `games.developer` as the runtime contract.
2. Build or refresh the canonical registries for consoles and developers without changing runtime behavior.
3. Add any future `console_id` or `developer_id` columns only as additive nullable fields.
4. Backfill those additive fields only after a dedicated coverage audit proves that mappings are reliable.
5. Introduce a later dual-read runtime phase where strings remain authoritative and IDs are measured for parity.
6. Cut over only after:
   - parity is proven in production-like reads
   - affected payloads are checked end to end
   - explicit human approval is given
7. Consider string removal only after a separate deprecation decision.

## Hard Gates

- No schema or runtime cutover from strings to IDs in the current phase.
- No FK-first migration for `console` or `developer` without a dedicated audit lot.
- No production mutation for this transition without explicit human approval.

## Related DB Gate for `price_status`

Phase DB stays closed for the future `price_status v2` rule until real `ebay` ingestion exists in `price_history`.

That gate is independent from the `console` / `developer` transition, but both changes share the same rule:

- no production DB reopen without a concrete data trigger and explicit approval

Reference documents:

- [PHASE3_DB_READINESS.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/PHASE3_DB_READINESS.md)
- [PHASE3_BACKFILL_EXECUTION.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/PHASE3_BACKFILL_EXECUTION.md)
- [LEGACY_AUDIT.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/docs/LEGACY_AUDIT.md)
