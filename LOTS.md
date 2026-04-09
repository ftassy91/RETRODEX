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

---

## Lots planifies

### LOT-PROD-01 - Audit des 26 tables Supabase
- **Statut :** Done
- **Date :** 2026-04-09
- **Objectif :** Documenter chaque table Supabase
- **Livrable :** SUPABASE_AUDIT.md
- **Modele utilise :** Sonnet (donnees deja fetchees, analyse organisationnelle)
- **Findings cles :** 26 tables (pas 13), RLS sur 4/26, mismatch casing condition, duplication games/game_editorial, migration tracking inactif
