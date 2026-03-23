# RetroDex — Protocole de synchronisation Claude ↔ Codex

> **Ce fichier est la source de vérité du workflow.**
> Il doit être lu en entier avant chaque session de travail.
> Il doit être mis à jour après chaque changement structurant.

---

## Principe

Claude et Codex ne travaillent jamais en aveugle.
Chaque décision d'architecture prise par Claude est consignée ici.
Chaque implémentation faite par Codex est consignée ici.
Ni l'un ni l'autre ne peut créer de divergence silencieuse.

---

## Couches de vérité

| Couche | Source de vérité | Responsable |
|---|---|---|
| Code et implémentation | GitHub — branche active | Codex |
| Architecture et décisions | `SYNC.md` + Notion TECHNIQUE | Claude |
| Tâches et état d'avancement | Notion ROADMAP + BRIEF CODEX | Claude + utilisateur |
| Variables d'environnement | `backend/.env` (non commité) | Utilisateur |

---

## Architecture cible — décisions validées

### Décision 1 — Supabase remplace SQLite + Railway PostgreSQL

**Validée le :** 23 mars 2026
**Raison :** Supabase = PostgreSQL + REST API + SDK JS + RLS intégré + interface admin. Élimine Railway comme infra séparée.

**Implémentation requise :**
- `backend/src/db/supabase.js` remplace `database.js` + `query.js`
- `supabase/schema.sql` définit les tables et RLS
- `scripts/migrate/sqlite_to_supabase.js` migre les données locales

**Variables d'env :**
```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJh...
SUPABASE_SERVICE_KEY=eyJh...  ← scripts curation uniquement
```

### Décision 2 — Vercel remplace Railway pour le frontend

**Validée le :** 23 mars 2026
**Raison :** Le frontend est HTML/CSS/JS vanilla statique. Vercel est la cible native pour ce type de déploiement. L'API Express peut être convertie en fonctions Vercel serverless.

**Implémentation requise :**
- `vercel.json` à la racine du projet
- `outputDirectory: "frontend"` pour le HTML statique
- Routes API : `backend/src/server.js` devient une fonction serverless Vercel

**Commande de déploiement :**
```bash
vercel --prod
```

### Décision 3 — Pipeline de curation isolé du runtime

**Validée le :** 23 mars 2026
**Raison :** Les scripts batch (IGDB, eBay, Anthropic, DALL-E 3) ne doivent pas polluer le code de l'application. Ils s'exécutent séparément et publient dans Supabase.

**Structure :**
```
scripts/
├── fix/          ← corrections ponctuelles (one-shot)
├── enrich/       ← enrichissement données (IGDB, Anthropic, eBay)
├── migrate/      ← migrations DB
├── visual/       ← pipeline covers DALL-E 3
└── utils/        ← helpers partagés entre scripts
```

### Décision 4 — Supabase comme seul point d'accès données

**Validée le :** 23 mars 2026
**Raison :** Éliminer la dualité SQLite/PostgreSQL. En local comme en prod, on pointe vers Supabase. En dev sans connexion, le fallback SQLite est disponible via `supabase.js`.

---

## État des implémentations

### Fichiers fournis par Claude — à implémenter par Codex

| Fichier | Statut | Action Codex |
|---|---|---|
| `vercel.json` | ✅ Fourni | Copier à la racine du projet |
| `supabase/schema.sql` | ✅ Fourni | Exécuter dans Supabase Dashboard → SQL Editor |
| `backend/src/db/supabase.js` | ✅ Fourni | Remplacer `database.js` et `query.js` |
| `scripts/migrate/sqlite_to_supabase.js` | ✅ Fourni | Copier, lancer après schema |
| `.env.example` | ✅ Fourni | Mettre à jour `backend/.env` |
| `SYNC.md` | ✅ Ce fichier | Committer à la racine |

### Modifications routes Express — à faire par Codex

```
backend/src/routes/games.js
  → Remplacer les appels query.js par supabase.js helpers
  → const { queryGames, getGameById } = require('../db/supabase');

backend/src/routes/search.js
  → Utiliser supabase.db.from('retrodex_search_index')

backend/src/routes/collection.js
  → Utiliser supabase.db.from('collection_items')

backend/src/routes/stats.js
  → Utiliser supabase.getStats()

backend/src/routes/prices.js
  → Utiliser supabase.db.from('price_history')
```

### Scripts de curation — à adapter par Codex

```
scripts/enrich/fetch_prices_ebay.js
  → Remplacer Sequelize par supabase.db.from('games').upsert(...)

scripts/enrich/fetch_covers_igdb.js
  → Même adaptation

scripts/enrich/generate_encyclopedia.js
  → Même adaptation
```

### Implémentations validées — 23 mars 2026

- `A1` — Migration SQLite → Supabase exécutée
  - `franchise_entries` : `15`
  - `games` : `1490`
  - décision métier appliquée : exclusion de `type='console'` et déduplication explicite du doublon `Majora's Mask`
  - commit : `c408e40`

- `A2` — Route `backend/src/routes/games.js` migrée vers Supabase
  - `GET /api/games` lit via `queryGames(...)`
  - `GET /api/games/:id` lit via `getGameById(...)`
  - format JSON conservé : `items`, `total`, `returned`
  - validations passées :
    - `/api/games?sort=rarity_desc&limit=3` → `LEGENDARY` en tête
    - `/api/games?sort=price_desc&limit=3` → `loosePrice > 500` en tête
  - commit : `56bf162`

- `A3` — Route `backend/src/routes/market.js` migrée vers Supabase pour `/api/search`
  - tentative prioritaire sur `retrodex_search_index`
  - fallback direct sur `games` + `franchise_entries` si le view n'est pas disponible
  - scoring de pertinence conservé
  - ajustement du tie-break pour faire remonter la franchise quand le nom est identique à un jeu
  - validations passées :
    - `/api/search?q=mario&limit=5` → `Super Mario` dans les 2 premiers, `Sonic` absent des 3 premiers
    - `/api/search?q=zelda&limit=5` → franchise `The Legend of Zelda` dans les 2 premiers
  - commit : `a39bd0f`

- `A4` — Route `backend/src/routes/collection.js` migrée vers Supabase pour `/api/collection`
  - `GET /api/collection` lit `collection_items` avec `user_session = 'local'`
  - `POST /api/collection` insère dans Supabase
  - `PATCH /api/collection/:id` met à jour dans Supabase
  - `DELETE /api/collection/:id` supprime dans Supabase
  - contrat frontend conservé :
    - `GET` → `{ items, total }`
    - `POST` → `201`
    - `PATCH` → `200`
    - `DELETE` → `200` avec `{ ok: true, deletedId }`
  - validation passée :
    - ajout d'un jeu → visible dans `GET`
    - patch condition/notes → persisté
    - suppression → le jeu disparaît de `GET`
  - commit : `e5a2a66`

---

## Protocole de mise à jour

### Quand Claude décide quelque chose

Claude met à jour `SYNC.md` dans la section **État des implémentations** avec :
- La décision
- Le fichier concerné
- L'action attendue de Codex

Claude met aussi à jour Notion → section TECHNIQUE.

### Quand Codex implémente quelque chose

Codex commit avec le message : `[SYNC] feat: description`
et ajoute un commentaire en tête du fichier modifié :

```javascript
// SYNC: implémenté le [date] — [description courte]
// Décision source : SYNC.md § [section]
```

### Quand l'utilisateur valide

L'utilisateur coche l'étape dans Notion ROADMAP.
L'utilisateur met à jour le statut dans cette table.

---

## Variables d'environnement — état cible

```bash
# ── Supabase (obligatoire en prod) ──────────────────────────
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJh...
SUPABASE_SERVICE_KEY=eyJh...       # scripts curation uniquement

# ── Enrichissements (optionnels) ─────────────────────────────
IGDB_CLIENT_ID=...
IGDB_CLIENT_SECRET=...
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
EBAY_APP_ID=...
EBAY_CERT_ID=...
EBAY_ENV=production

# ── Local (défaut si Supabase absent) ────────────────────────
DATABASE_PATH=./backend/storage/retrodex.sqlite
PORT=3000
NODE_ENV=development
```

---

## Ordre de migration recommandé

```
Étape 1 — Créer le projet Supabase
  → supabase.com → New project → noter URL + keys

Étape 2 — Appliquer le schéma
  → Supabase Dashboard → SQL Editor → coller supabase/schema.sql

Étape 3 — Renseigner les variables
  → backend/.env ← SUPABASE_URL + SUPABASE_SERVICE_KEY

Étape 4 — Migrer les données
  → node scripts/migrate/sqlite_to_supabase.js --dry-run
  → node scripts/migrate/sqlite_to_supabase.js

Étape 5 — Adapter les routes
  → Voir section "Modifications routes Express" ci-dessus

Étape 6 — Déployer sur Vercel
  → vercel --prod
  → Configurer les env vars dans le dashboard Vercel

Étape 7 — Valider
  → https://[app].vercel.app/api/health
  → Tester toutes les pages
```

---

## Risques et points de vigilance

| Risque | Mitigation |
|---|---|
| Supabase RLS bloque les requêtes | Vérifier les policies dans Dashboard → Auth → Policies |
| Timeout Vercel sur requêtes lentes | maxDuration: 30 dans vercel.json — augmenter si nécessaire |
| Schema mismatch SQLite vs Supabase | Colonne `loose_price` vs `loosePrice` — supabase.js gère le mapping |
| Données sensibles dans les URLs | Ne jamais passer de clés dans les query params |
| CORS en production | Ajouter `cors({ origin: ['https://[app].vercel.app'] })` dans server.js |

---

*Dernière mise à jour : 23 mars 2026 — Architecture Vercel + Supabase validée*
