# CODEX CONTEXT — RetroDex MVP Database v2
> Fichier de référence pour Codex — à lire EN PREMIER à chaque session
> Dernière mise à jour : 20 mars 2026 — scope étendu Database + Market System

---

## 🎯 POSITIONNEMENT PRODUIT

> RetroDex = "A structured retro-gaming knowledge engine with integrated market insights."
> DATA FIRST — UI SECOND
> Layout cible : Bloomberg 3 colonnes (sidebar filtres / liste résultats / panneau détail)

---

## 🤖 RÈGLES ABSOLUES CODEX

- **PORT backend = 3000** — ne jamais changer
- **Ne jamais modifier** `frontend/data/*.js` ni `frontend/js/top-screen-generator.js`
- **Ne jamais committer** `.env`, `node_modules/`, `*.sqlite`, `logs/`
- **Ne jamais utiliser** `sequelize.sync({ force: true })` — `alter: true` uniquement
- **Branche = `feature/mvp-database-v2`** — ne pas créer d'autres branches
- **Un commit par tâche** — format : `type(scope): description`
- **Tester localement** avant tout commit

---

## 📁 STRUCTURE DU PROJET

```
C:\Users\ftass\OneDrive\Bureau\RETRODEXseed\
├── backend/
│   ├── src/
│   │   └── server.js              ← Express PORT 3000
│   ├── config/
│   │   └── database.js            ← dual-mode SQLite/PostgreSQL
│   ├── models/
│   │   ├── Game.js                ← 507 jeux (à migrer vers schéma v2)
│   │   └── CollectionItem.js      ← condition Loose/CIB/Mint + notes
│   ├── public/                    ← UI servie par Express
│   │   ├── hub.html               ← à refactorer (Phase 1)
│   │   ├── games-list.html        ← à refactorer (Phase 1-2)
│   │   ├── game-detail.html       ← à refactorer (Phase 1-2)
│   │   ├── collection.html
│   │   ├── consoles.html          ← OK
│   │   ├── stats.html
│   │   └── style.css              ← à refactorer (Phase 1)
│   └── storage/
│       └── retrodex.sqlite        ← NE PAS COMMITTER
├── scripts/
│   ├── import/
│   │   └── import_prices_pricecharting.js  ← PRÊT f105818, attend clé API
│   ├── market/                    ← À CRÉER (Phase 4)
│   │   ├── ingest_ebay.js
│   │   └── compute_aggregates.js
│   └── db/
│       └── migrate.js             ← SQLite → PostgreSQL
├── docs/
│   └── FRONTEND.md
├── frontend/                      ← prototype 3DS PORT 8080 — NE JAMAIS MODIFIER
└── CODEX_CONTEXT.md               ← CE FICHIER
```

---

## 🗄️ SCHÉMA ACTUEL (v0.3.1)

```sql
-- Table existante, 507 jeux
Games (
  id TEXT PK,    title TEXT,      platform TEXT,
  year INTEGER,  image TEXT,      description TEXT,
  rarity TEXT,   metascore INT,   developer TEXT,   genre TEXT,
  loosePrice REAL,  -- ⚠️ NULL — script prêt f105818
  cibPrice REAL,    -- ⚠️ NULL
  mintPrice REAL    -- ⚠️ NULL
)

-- Table existante
CollectionItems (
  id INT PK, gameId TEXT FK, condition TEXT, notes TEXT, addedAt DATETIME
)
```

---

## 🏗️ SCHÉMA CIBLE v2 (Phase 3)

```sql
-- Entités principales
Game (id, slug, name, franchise, release_year, genre, summary, source_confidence, created_at, updated_at)
GameRelease (id, slug, game_id FK, region_id FK, platform_id FK, release_date, version_name)
Console (id, slug, name, manufacturer_id FK, generation, summary, created_at, updated_at)
ConsoleVariant (id, slug, console_id FK, name, region_id FK, release_date, special_edition_flag)
Accessory (id, slug, name, console_id FK, manufacturer_id FK, accessory_type, summary)
Company (id, slug, name, role, country)              -- developer/publisher/manufacturer
Region (id, code, name)                               -- JP/US/EU/WW/AU/PAL/NTSC-J/NTSC-U
OST (id, slug, game_id FK, name, composer, track_count, release_date)
CRTDisplay (id, slug, name, manufacturer_id FK, screen_size, resolution, connectors)
CollectorEdition (id, slug, item_id, item_type, name, contents, limited_units, region_id FK)
NeoRetroItem (id, slug, name, manufacturer_id FK, item_type, original_ref_id, release_date)

-- Market system
MarketSale (
  id INT PK, item_id TEXT, item_type TEXT, title_raw TEXT,
  price REAL, currency TEXT, condition TEXT,        -- loose/cib/new
  source TEXT, sold_date DATE, url TEXT,            -- ebay_sold/pricecharting
  confidence_score REAL, created_at DATETIME
)
MarketAggregate (
  item_id TEXT PK, item_type TEXT,
  avg_price_loose REAL, avg_price_cib REAL, avg_price_new REAL,
  median_loose REAL, median_cib REAL, median_new REAL,
  min_price REAL, max_price REAL,
  last_7_days_avg REAL, last_30_days_avg REAL,
  trend TEXT,           -- up/down/stable
  volatility REAL, sales_volume INT, last_computed_at DATETIME
)

-- Collection étendue
CollectionItems (
  id INT PK, item_id TEXT, item_type TEXT,
  list_type TEXT,        -- owned/wanted/for_sale
  condition TEXT,        -- Loose/CIB/Mint
  notes TEXT, price_paid REAL, added_at DATETIME
)
```

---

## 🌐 ROUTES API EXISTANTES

```
GET  /api/health
GET  /api/games          → items, returned, total
GET  /api/games/:id      → fiche complète
GET  /api/collection     → items + condition + game
POST /api/collection     → { gameId, condition, notes }
DELETE /api/collection/:id
GET  /api/stats          → totaux + conditionBreakdown
GET  /api/consoles       → 16 consoles
```

**Routes à créer (Phase 3-4) :**
```
GET  /api/items          → tous types d'entités (game/console/accessory/etc.)
GET  /api/items/:id      → détail générique
GET  /api/market/:id     → MarketAggregate pour un item
GET  /api/market/history/:id → MarketSale chronologique
```

---

## 📋 ÉTAT COMPLET DES TÂCHES

### Phase 0 — Data 🔴 BLOQUANT

| ID | Tâche | Statut |
|---|---|---|
| P0-01 | Diagnostic loosePrice null | ✅ Done |
| P0-02/03 | Import prix PriceCharting | ⏸ Attend clé API (script f105818 prêt) |
| P0-04 | PriceHistory 6 mois | 📋 To Do |
| P0-05 | Supprimer badges port 3000/8080 hub | 📋 To Do |
| P0-06 | Supprimer RETRODEX FRONT/RETROMARKET hub | 📋 To Do |

**Lancer P0-02/03 :**
```powershell
$env:PRICECHARTING_API_KEY="YOUR_KEY"
node scripts/import/import_prices_pricecharting.js --dry-run
node scripts/import/import_prices_pricecharting.js
```

### Phase 1 — Cleanup 📋 To Do
- P1-01 Supprimer canvas GB (games-list.html) — 1h
- P1-02 Supprimer hero canvas (game-detail.html) — 1h
- P1-03 Supprimer wrappers décoratifs CRT/LCD — 1h
- P1-04 Hub → page de recherche centrale — 2h
- P1-05 style.css → design tokens Bloomberg — 2h

### Phase 2 — Core UI 📋 To Do
- P2-01 Layout 3 colonnes Bloomberg — 3h
- P2-02 Composant ResultRow dense (48px) — 2h
- P2-03 Composant DetailPanel — 2h
- P2-04 Chart sélecteur 1M/6M/1A/10A — 2h

### Phase 3 — Schema v2 📋 To Do
- P3-01 Migrer Games → items (multi-type) — 3h
- P3-02 Table item_relations — 2h
- P3-03 CollectionItems + list_type — 1h
- P3-04 Route /api/items unifiée — 2h
- P3-05 Tables Company + Region — 1h
- P3-06 Table GameRelease — 2h
- P3-07 Table ConsoleVariant — 1h
- P3-08 Table Accessory — 1h
- P3-09 Tables OST + CRT + CollectorEdition + NeoRetro — 3h
- P3-10 Champs slug + source_confidence partout — 1h

### Phase 4 — Data Upgrade 📋 To Do
- P4-01 Indicateurs tendance ↑↓= % — 2h
- P4-02 Filtres sidebar permanents — 2h
- P4-03 Table MarketSale (données brutes) — 2h
- P4-04 Table MarketAggregate (données calculées) — 2h
- P4-05 Pipeline ingestion eBay sold listings — 5h+
- P4-06 Score de confiance des ventes — 2h
- P4-07 Calcul automatique MarketAggregate — 2h

### Phase 5 — Collection System 📋 To Do
- P5-01 WANTED + price tracking + alerte seuil — 3h
- P5-02 FOR SALE + URL partageable — 3h
- P5-03 Profil + valeur totale estimée — 3h

---

## 🎨 DESIGN TOKENS BLOOMBERG (Phase 2)

```css
:root {
  --bg:              #0a0e0a;
  --bg-surface:      #0f1510;
  --bg-card:         #131a13;
  --border:          #1e2e1e;
  --text-primary:    #a8d8a8;
  --text-secondary:  #5a8a5a;
  --text-muted:      #2e4e2e;
  --text-value:      #d4f0d4;
  --text-alert:      #f0d060;
  --accent:          #3ddc3d;
  --accent-dim:      #1a6e1a;
  --condition-loose: #888888;
  --condition-cib:   #4ecdc4;
  --condition-mint:  #ffd700;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
  --font-size-base:  13px;
}
```

---

## 📊 MARKET DATA — RÈGLES CRITIQUES

```
✅ TOUJOURS différencier condition : loose / CIB / new
✅ TOUJOURS séparer MarketSale (brut) et MarketAggregate (calculé)
✅ FILTRER outliers (>3σ) avant calcul des agrégats
✅ Score de confiance minimum : 0.6 pour inclusion dans agrégat
❌ JAMAIS mélanger listings actifs et prix vendus
❌ JAMAIS stocker un prix sans sa condition
```

---

## 🏷️ HISTORIQUE GIT

| Tag | Contenu |
|---|---|
| v0.3.1 | Sauvegarde avant pivot — état stable |
| v0.3.0 | Bloc G + Phase 1 fix paths |
| v0.2.0 | Sprint 6+7+8 UI visuals |

**Branche archive :** `archive/v0.3.1-before-pivot`
**Branche active :** `feature/mvp-database-v2`

---

## 🔗 LIENS NOTION

| Page | URL |
|---|---|
| MVP DATABASE Hub | https://www.notion.so/3298a0e1ed24812697c7f28b0a4de2e0 |
| Kanban 34 tickets | https://www.notion.so/396c65124e4b4b1a8944de3342d905fc |
| Schema Architecture | https://www.notion.so/3298a0e1ed248188a0e7f9a2bf09c5a2 |
| Planning J1 | https://www.notion.so/3298a0e1ed24814aa0a8f3634deccae6 |
| Roadmap 2 jours | https://www.notion.so/3298a0e1ed24813fbbebfe2e85bd4023 |
| Journal de Bord | https://www.notion.so/42789033d3a64319b8d7915bdeca4423 |
| Audit Critique | https://www.notion.so/3298a0e1ed248134addef4e81c8dfbc2 |
| Brief Expert | https://www.notion.so/3298a0e1ed248100ab64ff0d87e13641 |
| Brief Unifié Final | https://www.notion.so/3298a0e1ed24819a97d1ce15b042fa5c |
