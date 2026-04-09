# DECISION-002: Security model and RLS strategy

**Date:** 2026-04-09
**Status:** Decided
**Lot:** LOT-THINK-02
**Decision:** Current security model is intentional. RLS activation deferred until multi-user or public API.

---

## Current architecture

### Authentication method

The backend authenticates to Supabase using `SUPABASE_SERVICE_KEY` (service role).

| File | Detail |
|---|---|
| `backend/db_supabase.js:24` | `SUPABASE_KEY = RESOLVED_SUPABASE_SERVICE_KEY \|\| RESOLVED_SUPABASE_ANON_KEY` |
| `backend/src/config/env.js:127-128` | Loads `SUPABASE_SERVICE_KEY` from env |

**Service role bypasses all RLS policies.** This means RLS is architecturally inert
regardless of whether it is enabled at table level.

### User model

Single-user. No authentication, no JWT, no Supabase Auth.

| File | Detail |
|---|---|
| `backend/src/services/public-collection/core.js` | `DEFAULT_COLLECTION_USER_ID = 'local'` |
| `backend/src/models/CollectionItem.js` | `user_session` defaults to `'local'` |
| `backend/db_supabase.js:776` | `getCollection(session = 'local')` |
| `backend/src/middleware/auth.js` | Can extract `x-retrodex-user-id` header but is dormant |

### Data access path

```
Browser --> Node.js/Express backend --> Supabase (service_role key)
```

The frontend never talks to Supabase directly. No anon key is exposed to the client.

---

## RLS state across 26 tables

### RLS enabled (4 tables, 0 policies)

| Table | RLS enabled | Policies | Why enabled |
|---|---|---|---|
| `games` | YES | 0 | Default Supabase dashboard setting on creation |
| `consoles` | YES | 0 | Same |
| `franchise_entries` | YES | 0 | Same |
| `collection_items` | YES | 0 | Same |

**These 4 tables have RLS enabled at schema level but no policies are defined.**
With service_role access, this has zero effect. With anon access, these tables
would be **unreadable** (RLS enabled + no policy = deny all for non-service roles).

### RLS disabled (22 tables)

| Category | Tables |
|---|---|
| Market | price_history, price_sources, price_ingest_runs, price_rejections |
| Editorial | game_editorial, game_content_profiles |
| Curation | game_curation_states, game_curation_events, console_publication_slots |
| People/OST | people, game_people, ost, ost_tracks, ost_releases |
| Provenance | source_records, field_provenance, quality_records, media_references |
| Competitive | game_competitive_profiles, game_record_categories, game_record_entries, game_achievement_profiles |
| Internal | _schema_migrations |

### GRANT SELECT coverage

16 tables have explicit `GRANT SELECT ON ... TO anon, authenticated, service_role`
issued by publish scripts. This means if the anon key were ever exposed to a client,
those 16 tables would be world-readable.

---

## Assessment: is this intentional?

**Yes.** The current model is correct for a single-user collector app with a
backend-only data path:

1. **No multi-user data isolation needed.** All data belongs to one collector.
2. **No client-side Supabase access.** The anon key is not exposed.
3. **Service role is appropriate.** The backend is the sole data accessor and
   needs full read/write to all tables for enrichment, publishing, and collection.
4. **RLS would add complexity with zero security benefit** in this architecture.

The 4 tables with RLS enabled are an artifact of Supabase dashboard defaults,
not a deliberate security choice. They cause no harm (service_role bypasses them)
but they are not part of a security design.

---

## Trigger conditions for RLS activation

RLS becomes necessary when **any** of these conditions become true:

| Trigger | Why RLS is needed | Priority |
|---|---|---|
| **T1: Anon key exposed to frontend** | Client could read/write Supabase directly. GRANT SELECT on 16 tables = public read. | CRITICAL |
| **T2: Multi-user authentication** | collection_items, game_curation_states need user-scoped access control. | HIGH |
| **T3: Public API** | External consumers could access data without backend mediation. | HIGH |
| **T4: Edge functions** | Supabase Edge Functions use anon/authenticated roles by default. | MEDIUM |

**None of these triggers are active today or planned short-term.**

---

## Proposed minimal RLS policy set (for when triggers activate)

When T1 or T2 fires, apply this minimal set:

### Phase 1: Read protection (T1)

```sql
-- All tables: allow anon read (public encyclopedia)
CREATE POLICY "anon_read" ON games FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read" ON consoles FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read" ON game_editorial FOR SELECT TO anon USING (true);
-- ... repeat for all encyclopedia tables

-- collection_items: deny anon, allow authenticated own data only
CREATE POLICY "owner_read" ON collection_items
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()::text);
```

### Phase 2: Write protection (T2)

```sql
-- collection_items: owner can insert/update/delete own rows
CREATE POLICY "owner_write" ON collection_items
  FOR ALL TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- Market/editorial tables: no public writes
-- (service_role only, which bypasses RLS)
```

### Phase 3: Admin isolation (T3/T4)

```sql
-- Curation, provenance, ingest tables: service_role only
-- RLS enabled, no anon/authenticated policy = deny by default
```

---

## Risks if no action is taken

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Anon key leaks via client bundle | Low (not exposed today) | 16 tables world-readable | Keep anon key server-side only |
| Someone enables frontend Supabase without RLS | Medium (future dev) | Collection data exposed | This document serves as guard rail |
| GRANT SELECT too broad | Low | No effect while anon key is server-only | Revoke anon grants when RLS is activated |

---

## Decision

**Do nothing now. The current model is intentional and secure for a single-user,
backend-only architecture.**

Action items for the future:
1. When any trigger (T1-T4) activates, implement RLS Phase 1 first
2. Before exposing anon key to any client, revoke blanket GRANT SELECT and
   replace with RLS policies
3. Before adding multi-user auth, migrate `user_session = 'local'` to
   `user_id = auth.uid()` and add owner policies

---

## Files referenced

| File | Role |
|---|---|
| `backend/db_supabase.js` | Supabase client init, service_role key |
| `backend/src/config/env.js` | Environment variable loading |
| `backend/src/models/CollectionItem.js` | user_session default |
| `backend/src/services/public-collection/core.js` | DEFAULT_COLLECTION_USER_ID |
| `backend/src/middleware/auth.js` | Dormant auth header extraction |
| `backend/scripts/publish-*.js` | GRANT SELECT statements (7 scripts) |
| `SUPABASE_AUDIT.md` | Finding F2: RLS coverage |
