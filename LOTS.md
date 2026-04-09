# LOTS.md - Suivi des lots RetroDex

## Convention

Chaque lot suit le cycle : PLAN - VALIDATE - EXECUTE - VERIFY
Prefixe de commit Git recommande : [LOT-XX-NN]

| Prefixe | Domaine |
|---|---|
| LOT-OP- | Operateur (workflow, outils, documentation dev) |
| LOT-PROD- | Produit (features, data, UI RetroDex) |
| LOT-FIX- | Correctif urgent |

---

## Lots executes

### LOT-OP-01 - Source de verite projet
- **Statut :** Done
- **Date :** 2026-04-09
- **Objectif :** Mettre en place le cockpit operateur
- **Fichiers :** CLAUDE.md, .claude/commands/*, README_OPERATOR.md, LOTS.md

### LOT-OP-02 - Commit scaffold, resoudre conflit AGENTS.md
- **Statut :** Done
- **Date :** 2026-04-09
- **Objectif :** Proteger les artefacts LOT-OP-01 dans git, neutraliser le conflit d'autorite AGENTS.md vs CLAUDE.md
- **Fichiers :** CLAUDE.md, LOTS.md, README_OPERATOR.md, .claude/commands/*, AGENTS.md, docs/CLAUDE_CONTINUITY_BRIEF.md

### LOT-PROD-01 - Audit des 26 tables Supabase
- **Statut :** Done
- **Date :** 2026-04-09
- **Objectif :** Documenter chaque table Supabase
- **Livrable :** SUPABASE_AUDIT.md
- **Modele utilise :** Sonnet (donnees deja fetchees, analyse organisationnelle)
- **Findings cles :** 26 tables (pas 13), RLS sur 4/26, mismatch casing condition, duplication games/game_editorial, migration tracking inactif

### LOT-FIX-01 - Fix mismatch casing condition (game-detail)
- **Statut :** Done
- **Date :** 2026-04-09
- **Objectif :** Corriger la comparaison case-sensitive entre condition des prix (lowercase) et condition collection (Title Case) dans game-detail.js
- **Fichiers :** backend/public/js/pages/game-detail.js

### LOT-OP-03 - Housekeeping operateur
- **Statut :** Done
- **Date :** 2026-04-09
- **Objectif :** Mettre a jour le compte de tables dans CLAUDE.md, synchroniser LOTS.md, ajouter la commande /status
- **Fichiers :** CLAUDE.md, LOTS.md, .claude/commands/status.md, README_OPERATOR.md

### LOT-FIX-02 - Currency-aware formatting dans le header collection
- **Statut :** Done
- **Date :** 2026-04-09
- **Commit :** 622152b
- **Objectif :** Remplacer formatCurrency() et le "$" hardcode dans les fonctions summary header par formatCollectionPrice() avec devise dominante (EUR/USD/?)
- **Fichiers :** backend/public/js/pages/collection.js, backend/src/services/public-collection/stats.js
- **Modele utilise :** Opus (plan) + Sonnet (execute)
- **Notes :** 3 sites formatCurrency restants (paid chip, seuil chip, row paid) hors scope — concernent des montants saisis par l'utilisateur, devise source a decider

---

## Lots planifies

### LOT-PROD-02 - Telemetrie pipeline + dette casing queries.js
- **Statut :** Done
- **Date :** 2026-04-09
- **Commit :** 47dde3c
- **Objectif :** Activer les logs price_ingest_runs + price_rejections, normaliser queries.js::normalizeCondition() en Title Case
- **Fichiers :** backend/src/services/public-price/queries.js, backend/src/services/market/observe/ingest-runs.js, backend/src/services/market/observe/index.js, backend/scripts/market/run-market-pipeline.js
- **Modele utilise :** Opus (plan) + Sonnet (execute)
- **Notes :** recordRun default a apply, writeRejections() ajoute, normalizeCondition() retourne Loose/CIB/Mint. Premier --apply = test d'integration.

### LOT-THINK-01 - Decision: duplication games/game_editorial
- **Statut :** Planifie
- **Objectif :** Decider si games est un cache de game_editorial ou si les champs doublons sont a supprimer
- **Modele recommande :** Opus (decision architecturale)

### LOT-THINK-02 - Modele de securite RLS
- **Statut :** Planifie
- **Objectif :** Documenter le modele de securite intentionnel, activer RLS sur les tables manquantes si necessaire
- **Modele recommande :** Opus
