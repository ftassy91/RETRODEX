# RetroDex Admin Services Audit

State reviewed on March 31, 2026.

Closure note:

- this audit was later executed as a dedicated admin/services lot
- the classification below is historical
- the stabilized current state is tracked in [ARCHITECTURE.md](./docs/ARCHITECTURE.md), [DECISIONS.md](./docs/DECISIONS.md), and [CLAUDE_CONTINUITY_BRIEF.md](./docs/CLAUDE_CONTINUITY_BRIEF.md)

Scope limited to the retained non-canonical services under [backend/src/services/admin](./backend/src/services/admin):

- [audit-service.js](./backend/src/services/admin/audit-service.js)
- [game-read-service.js](./backend/src/services/admin/game-read-service.js)
- [console-service.js](./backend/src/services/admin/console-service.js)
- [curation-service.js](./backend/src/services/admin/curation-service.js)
- [enrichment-backlog-service.js](./backend/src/services/admin/enrichment-backlog-service.js)

This audit does not open a refactor by itself. It classifies first.

## Decision Matrix

| Service | Size | Active consumers | Public overlap | Proposed plan |
| --- | ---: | --- | --- | --- |
| [backend/src/services/admin/audit-service.js](./backend/src/services/admin/audit-service.js) | 849 | admin audit route, `run-audit.js` | medium | `decouper` |
| [backend/src/services/admin/game-read-service.js](./backend/src/services/admin/game-read-service.js) | 843 | `audit-service`, `console-service`, `curation-service` | high | `decouper` |
| [backend/src/services/admin/console-service.js](./backend/src/services/admin/console-service.js) | 485 | `curation-service`, `enrichment-backlog-service` | medium | `isoler` |
| [backend/src/services/admin/curation-service.js](./backend/src/services/admin/curation-service.js) | 824 | `run-pass1-curation.js`, `run-pass1-enrichment-backlog.js`, tests | medium | `decouper` |
| [backend/src/services/admin/enrichment-backlog-service.js](./backend/src/services/admin/enrichment-backlog-service.js) | 553 | `run-pass1-enrichment-backlog.js`, tests | low | `conserver` |

## Service Fiches

### `audit-service.js`

- Path:
  [backend/src/services/admin/audit-service.js](./backend/src/services/admin/audit-service.js)
- Real responsibility:
  combines at least four concerns:
  - audit summary generation
  - game and console scoring
  - divergence reporting between legacy and canonical views
  - persistence of `quality_records` plus audit JSON exports
- Active consumers:
  - [backend/src/routes/admin/audit.js](./backend/src/routes/admin/audit.js)
  - [backend/scripts/run-audit.js](./backend/scripts/run-audit.js)
- Public overlap:
  - overlaps with [public-publication-service.js](./backend/src/services/public-publication-service.js) for publication/visibility signals
  - overlaps indirectly with [public-game-reader.js](./backend/src/services/public-game-reader.js) and [public-console-service.js](./backend/src/services/public-console-service.js) on canonical content presence and console metadata
  - does not overlap with a canonical public audit surface; its audit-specific role is still unique
- Why not absorb now:
  the service still depends on Sequelize models and back-office-only scoring/output logic; moving it into public services would blur the runtime boundary again
- Proposed plan:
  `decouper`
- Suggested future split:
  - `admin-quality-record-service`
  - `admin-divergence-report-service`
  - `admin-audit-report-writer`
  - keep scoring helpers shared only if they remain pure

### `game-read-service.js`

- Path:
  [backend/src/services/admin/game-read-service.js](./backend/src/services/admin/game-read-service.js)
- Real responsibility:
  legacy hydrated read model for games, used as the common data substrate of the admin services
- Active consumers:
  - [backend/src/services/admin/audit-service.js](./backend/src/services/admin/audit-service.js)
  - [backend/src/services/admin/console-service.js](./backend/src/services/admin/console-service.js)
  - [backend/src/services/admin/curation-service.js](./backend/src/services/admin/curation-service.js)
- Public overlap:
  - high overlap with [public-game-reader.js](./backend/src/services/public-game-reader.js)
  - overlap with [public-publication-service.js](./backend/src/services/public-publication-service.js) for published visibility
  - partial overlap with [public-runtime-payload-service.js](./backend/src/services/public-runtime-payload-service.js) on hydrated catalog payloads
- Why not absorb now:
  its output shape is still tied to Sequelize-backed admin workflows and legacy field semantics; direct absorption would risk forcing admin concerns back into the public read layer
- Proposed plan:
  `decouper`
- Suggested future split:
  - `admin-game-read/base-row`
  - `admin-game-read/canonical-joins`
  - `admin-game-read/publication-bridge`
  - then reassess whether any pure read helpers can be absorbed by public readers

### `console-service.js`

- Path:
  [backend/src/services/admin/console-service.js](./backend/src/services/admin/console-service.js)
- Real responsibility:
  builds admin/legacy console item payloads and console-grouped game views for curation workflows
- Active consumers:
  - [backend/src/services/admin/curation-service.js](./backend/src/services/admin/curation-service.js)
  - [backend/src/services/admin/enrichment-backlog-service.js](./backend/src/services/admin/enrichment-backlog-service.js)
- Public overlap:
  - overlaps with [public-console-service.js](./backend/src/services/public-console-service.js) for console lookup, aliases, and catalog identity
  - overlaps with [public-runtime-payload-service.js](./backend/src/services/public-runtime-payload-service.js) for console/game listing
- Why not absorb now:
  the current consumer set is entirely admin-side and still depends on the admin game read model
- Proposed plan:
  `isoler`
- Meaning:
  keep it explicitly back-office-only for now; do not force convergence before `game-read-service` is reduced

### `curation-service.js`

- Path:
  [backend/src/services/admin/curation-service.js](./backend/src/services/admin/curation-service.js)
- Real responsibility:
  mixes:
  - heuristic content profiling
  - validation scoring
  - PASS 1 dataset construction
  - report writing
  - persistence into curation tables
- Active consumers:
  - [backend/scripts/run-pass1-curation.js](./backend/scripts/run-pass1-curation.js)
  - [backend/scripts/run-pass1-enrichment-backlog.js](./backend/scripts/run-pass1-enrichment-backlog.js) for `PASS1_KEY`
  - [backend/tests/curation-service.test.js](./backend/tests/curation-service.test.js)
  - [backend/src/services/admin/enrichment-backlog-service.js](./backend/src/services/admin/enrichment-backlog-service.js)
- Public overlap:
  - overlaps with [public-publication-service.js](./backend/src/services/public-publication-service.js) on the same canonical curation/publication tables
  - no direct overlap with active public route logic, but both layers reason about publication state
- Why not absorb now:
  the heuristics and PASS 1 workflow are explicitly editorial/back-office concerns, not public runtime concerns
- Proposed plan:
  `decouper`
- Suggested future split:
  - `admin-curation-heuristics`
  - `admin-curation-dataset-builder`
  - `admin-curation-persistence`
  - `admin-curation-report-writer`

### `enrichment-backlog-service.js`

- Path:
  [backend/src/services/admin/enrichment-backlog-service.js](./backend/src/services/admin/enrichment-backlog-service.js)
- Real responsibility:
  derives backlog targets from curation state plus media counters, then emits backlog reports
- Active consumers:
  - [backend/scripts/run-pass1-enrichment-backlog.js](./backend/scripts/run-pass1-enrichment-backlog.js)
  - [backend/tests/enrichment-backlog-service.test.js](./backend/tests/enrichment-backlog-service.test.js)
- Public overlap:
  - low direct overlap with public services
  - it depends on admin curation state and console helpers, but it is mostly a derived reporting layer
- Why not refactor first:
  it is downstream of `curation-service` and `console-service`; refactoring it first would not reduce the main structural risk
- Proposed plan:
  `conserver`
- Meaning:
  keep as-is until the upstream admin services are clarified, then revisit if it is still too large

## Recommended Order If a Future Refactor Lot Opens

1. [backend/src/services/admin/game-read-service.js](./backend/src/services/admin/game-read-service.js)
2. [backend/src/services/admin/curation-service.js](./backend/src/services/admin/curation-service.js)
3. [backend/src/services/admin/audit-service.js](./backend/src/services/admin/audit-service.js)
4. [backend/src/services/admin/console-service.js](./backend/src/services/admin/console-service.js)
5. [backend/src/services/admin/enrichment-backlog-service.js](./backend/src/services/admin/enrichment-backlog-service.js)

## Immediate Conclusions

- No service in this set should be deleted blindly.
- The largest structural risk is not runtime coupling anymore; it is oversized admin services with mixed responsibilities.
- The most important future lot is not absorption into public services, but separation of admin read, scoring, persistence, and reporting concerns.
- The public runtime boundary is currently healthy and should not be reopened by trying to force these services into `public-*`.
