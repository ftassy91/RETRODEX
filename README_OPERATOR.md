# RETRODEX - Operator Guide

## Cycle de travail

AUDIT - PLAN - VALIDATE - EXECUTE - VERIFY

Regle absolue : pas de plan = pas de code.

---

## Commandes projet (Claude Code)

| Commande | Mode | Quand |
|---|---|---|
| /session-start | - | Debut de chaque session |
| /operator-audit | CONTROL | Auditer le workflow developpeur |
| /product-audit | CONTROL | Auditer RetroDex comme systeme collecteur |
| /plan-lot | THINK | Transformer un besoin en lot borne |
| /execute-lot | BUILD | Executer un lot valide |
| /verify-lot | CONTROL | Verifier qu un lot respecte le plan |

## Modeles (Claude Code CLI)

| Alias | Modele | Usage |
|---|---|---|
| cc | opusplan | Defaut |
| cco | opus | Audit profond, architecture |
| ccs | sonnet | Implementation rapide |

## Demarrage rapide

claude
/session-start
/operator-audit ou /product-audit
/plan-lot
/execute-lot
/verify-lot

## Architecture canonique

backend/public/         = UI production (canonical)
backend/src/routes/     = Routes Express (canonical)
backend/src/services/   = Logique metier (canonical)
backend/db_supabase.js  = Acces donnees (canonical)
Supabase                = Source de verite production
SQLite                  = Fallback local uniquement
frontend/               = Non-canonical
