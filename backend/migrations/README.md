# Backend Migrations

- All structural changes for the canonical data layer must land here.
- SQLite is the canonical target during the refactor.
- Supabase updates follow only after SQLite migrations, backfills, and audit checks pass.
- Each migration must be:
  - idempotent or safely guarded
  - documented
  - reversible when practical
  - non-destructive by default
