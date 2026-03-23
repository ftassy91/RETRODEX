# RetroDex - Protocole de synchronisation Claude <-> Codex

> Source de verite du workflow technique. Ce fichier doit etre relu avant chaque session et mis a jour apres chaque changement structurant.

---

## Couches de verite

| Couche | Source de verite | Responsable |
|---|---|---|
| Code et implementation | Git - branche active | Codex |
| Architecture et decisions | `backend/SYNC.md` + Notion technique | Claude |
| Taches et avancement | Notion roadmap + brief actif | Claude + utilisateur |
| Variables d'environnement | `backend/.env` (non committe) | Utilisateur |

---

## Decisions d'architecture validees

### Decision 1 - Supabase remplace SQLite/PostgreSQL comme cible principale

- Validation : 23 mars 2026
- Raison : point d'acces unique, interface admin, SDK JS, simplification du runtime

Implications :
- `backend/db_supabase.js` porte la couche d'acces donnees
- `scripts/migrate/sqlite_to_supabase.js` migre les donnees locales
- fallback SQLite conserve pour le developpement local seulement

Variables attendues :
```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...
```

### Decision 2 - Vercel est la cible frontend

- Validation : 23 mars 2026
- Le frontend statique est deployee via Vercel
- L'API Express reste adaptee en parallele

### Decision 3 - Pipeline de curation isole

- Les scripts batch restent hors runtime applicatif
- Structure cible :
```text
scripts/
├── fix/
├── enrich/
├── migrate/
├── visual/
└── utils/
```

### Decision 4 - Supabase comme point d'acces donnees des routes migrees

- Les routes migrees ne doivent plus dependre de `query.js`
- Les routes gardent leur contrat JSON existant

---

## Ordre de migration

1. Creer et configurer Supabase
2. Appliquer le schema
3. Renseigner `backend/.env`
4. Migrer les donnees
5. Migrer les routes
6. Valider `/api/health`
7. Deployer

---

## Journal Codex - progression route par route

### A1 - Migration SQLite -> Supabase

- Statut : valide
- Resultat canonique :
  - `games` : `1490`
  - `franchise_entries` : `15`
- Decision metier :
  - exclusion de `type='console'` de la table `games`
  - canonisation du doublon logique `Majora's Mask`

### A2 - `/api/games`

- Statut : valide
- Fichier principal : `backend/src/routes/games.js`
- Couche data : `backend/db_supabase.js`
- Validation :
  - `rarity_desc` retourne des `LEGENDARY` en tete
  - `price_desc` retourne un `loosePrice > 500` en premier

### A3 - `/api/search`

- Statut : valide
- Fichier principal : `backend/src/routes/market.js`
- Lecture via Supabase
- Fallback direct sur tables si `retrodex_search_index` indisponible
- Scoring de pertinence conserve

### A4 - `/api/collection`

- Statut : valide
- Fichier principal : `backend/src/routes/collection.js`
- Lecture/ecriture via Supabase
- `user_session='local'` force
- Note : certains champs legacy de collection ne sont pas encore portes par le schema Supabase

### A5 - `/api/stats`

- Statut : valide
- Fichier principal : `backend/src/routes/market.js`
- Helper partage corrige : `backend/db_supabase.js`
- Validation :
  - `GET /api/games?limit=1` -> `total = 1490`
  - `GET /api/stats` -> `total_games = 1490`
  - alignement confirme entre `/api/games` et `/api/stats`

### A6 - `/api/prices`

- Statut : valide
- Fichier principal : `backend/src/routes/prices.js`
- Lecture via Supabase `price_history`
- Jointure jeu faite en deux temps pour rester robuste meme si la relation Supabase n'est pas exposee
- Validation :
  - `GET /api/prices/recent` -> `{ ok: true, count: 0, sales: [] }`
  - `GET /api/prices/panzer-dragoon-saga-sega-saturn` -> `{ ok: true, count: 0, sales: [] }`
  - `GET /api/prices/panzer-dragoon-saga-sega-saturn/summary` -> `{ ok: true, byCondition: [] }`

---

## Risques et points de vigilance

| Risque | Mitigation |
|---|---|
| RLS Supabase bloque les requetes | verifier les policies et les droits de la cle utilisee |
| Vue `retrodex_search_index` absente | fallback direct sur `games` + `franchise_entries` |
| Ecart de schema legacy/ Supabase | centraliser les mappings dans `backend/db_supabase.js` |
| Cle service exposee par erreur | ne jamais la committer, usage scripts uniquement |
| Hook Notion non bloquant | laisser Git continuer, traiter Notion separement |

---

*Derniere mise a jour operationnelle : 23 mars 2026 - A6 validee cote code*
