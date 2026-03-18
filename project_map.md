# Project Map — RETRODEXseed
Généré le : 2026-03-17
Source analysée via backend actif + analyse ZIP lot41

---

## Source 1 : retrodex_v2_checkpoint_20260313_1722
`C:\Users\ftass\OneDrive\Bureau\RETRODEX VERSION OK\retrodex_v2_checkpoint_20260313_1722`

```
retrodex_v2_checkpoint_20260313_1722/
│
├── backend/                          ← Node.js Express (PORT 3000)
│   ├── server.js                     ← Point d'entrée principal
│   ├── package.json                  ← Dépendances Node
│   ├── package-lock.json
│   ├── .env                          ← Config locale (USE_SQLITE=true)
│   ├── models/
│   │   ├── Game.js                   ← Modèle Sequelize (id, title, console, year...)
│   │   ├── CollectionItem.js         ← Modèle collection (gameId, condition, notes)
│   │   └── index.js
│   ├── routes/
│   │   ├── games.js                  ← GET /api/games, GET /api/games/:id
│   │   ├── consoles.js               ← GET /api/consoles
│   │   └── (collection.js manquant)  ← POST/GET/DELETE /api/collection → Sprint 4
│   ├── config/
│   │   └── database.js               ← Config Sequelize SQLite/PostgreSQL
│   ├── public/                       ← Pages HTML servies statiquement
│   │   ├── home.html                 ← Hub de navigation backend (200 ✅)
│   │   ├── games-list.html           ← Liste jeux consumer (200 ✅)
│   │   ├── game-detail.html          ← Fiche jeu consumer (200 ✅)
│   │   ├── consoles.html             ← Page consoles (200 ✅)
│   │   └── debug.html                ← Debug riche (200 ✅)
│   ├── scripts/
│   │   ├── update_notion_progress.py ← Push Daily Log + Tickets vers Notion
│   │   ├── start-backend.ps1         ← Lancement Windows 1-clic
│   │   └── stop-backend.ps1          ← Arrêt Windows
│   └── storage/
│       └── retrodex.sqlite           ← Base SQLite (507 jeux, 16 consoles) ✅
│
├── prototype_v2/                     ← Frontend statique HTML/JS
│   ├── launcher.html                 ← Entrée démo principale
│   ├── index.html                    ← Shell principal RetroDex
│   ├── debug.html                    ← Page debug bridge
│   ├── css/
│   │   ├── main.css
│   │   └── retrodex.css
│   ├── js/
│   │   ├── utils.js                  ← RDX_PALETTE, getGenre, formatCurrency
│   │   ├── data-layer.js             ← DATA_LAYER (source de données)
│   │   ├── router.js                 ← ROUTER multi-vues
│   │   ├── app.js                    ← Boot
│   │   ├── retrodex.js               ← Vue 3DS principale
│   │   ├── market.js                 ← Vue dashboard market
│   │   ├── search.js                 ← Vue recherche
│   │   ├── home.js                   ← Vue home
│   │   ├── consoles.js               ← Vue consoles
│   │   ├── top-screen.js             ← Loader assets + générateur GB (~2527 lignes)
│   │   ├── illustration.js           ← Moteur procédural ILLUSTRATOR
│   │   ├── scene.js
│   │   └── illustration_v3_backup.js
│   ├── data/
│   │   ├── catalog.json              ← 507 jeux
│   │   ├── prices.json               ← 507 prix (loose/cib/mint)
│   │   ├── consoles.json             ← 16 systèmes
│   │   ├── entries.json              ← Données éditoriales
│   │   ├── demo_subset.json          ← 40 jeux showcase
│   │   ├── demo_subset.js
│   │   ├── demo_status.json          ← Compteurs démo (mis à jour 2026-03-17)
│   │   ├── demo_status.js
│   │   ├── market_history.js         ← 5 séries historiques 10 ans
│   │   ├── market_sales.js           ← 120 ventes vérifiées
│   │   ├── market_sources.js         ← Sources vérifiées
│   │   ├── market_coverage_report.json
│   │   ├── market_coverage_report.md
│   │   ├── market_import_manifest.json
│   │   ├── validate.py               ← Validation données
│   │   ├── validate_market_imports.py
│   │   ├── qa_demo_subset.py
│   │   ├── build_demo_status.py
│   │   ├── build_demo_subset.py
│   │   ├── generate_top_screen_generated_gb.py
│   │   └── [autres scripts Python]
│   ├── assets/
│   │   ├── generated_gb/             ← 40+ artworks Game Boy PNG
│   │   ├── placeholders/default.png
│   │   └── market/                   ← Template CRT photo
│   ├── img/
│   │   ├── 3ds-template.png
│   │   ├── 3ds-master.png
│   │   └── 3ds-frame.png
│   ├── modules/
│   │   └── retromarket/
│   │       ├── market.html           ← RetroMarket CRT terminal (standalone)
│   │       ├── market_data.js
│   │       ├── market_charts.js
│   │       └── market_ui.js
│   └── memory/
│       ├── project_memory.md         ← Bible technique Codex
│       ├── resume_state.md           ← État actuel
│       ├── next_task.md              ← Prochaine tâche
│       ├── progress_log.md           ← Journal S1→S15
│       └── top_screen_artwork_backlog.md
│
└── [autres dossiers du ZIP]
    ├── retrodeck_assets/             ← Assets pipeline (volumineux, cache)
    ├── data_engine/                  ← Pipeline Python
    ├── datapack/                     ← Format mise à jour externe
    └── maps/
```

---

## Source 2 : MVP RETRODEX
`C:\Users\ftass\OneDrive\Bureau\MVP RETRODEX`
Structure à confirmer lors de l'exécution du script de migration.
Contenu probable : version antérieure du backend Node.js avec React frontend.

---

## API Backend — Routes confirmées (port 3000)

| Route | Statut | Description |
|-------|--------|-------------|
| `GET /` | ✅ 200 | Health check JSON |
| `GET /api/health` | ✅ 200 | Status + chemin SQLite |
| `GET /api/games` | ✅ 200 | Liste jeux (507 total) |
| `GET /api/games/:id` | ✅ 200 | Fiche jeu individuelle |
| `GET /api/consoles` | ✅ 200 | 16 consoles avec compteurs |
| `GET /api/games/:id/summary` | ✅ 200 | Résumé debug riche |
| `GET /api/collection` | ✅ 200 | Collection backend (lecture) |
| `POST /api/collection` | ✅ 201 | Ajout d'un jeu dans la collection |
| `DELETE /api/collection/:id` | ✅ 200 | Suppression d'un jeu de la collection |
| `GET /api/stats` | ❌ 404 | Non implémenté |

## Reprise active Sprint 4

- Backend `RETRODEXseed` relancé et validé le 2026-03-17
- `RetroDex_Backend.bat` pointe maintenant vers :
  - `C:\Users\ftass\OneDrive\Bureau\RETRODEXseed\backend`
- Sprint 4 a démarré côté backend avec :
  - `src/models/CollectionItem.js`
  - `GET /collection`
  - `GET /api/collection`
  - `POST /collection`
  - `POST /api/collection`
  - `DELETE /collection/:id`
  - `DELETE /api/collection/:id`
- Validation réelle :
  - smoke test backend OK
  - insertion + suppression + cleanup OK dans la collection

## Pages publiques backend (port 3000)

| Page | Statut |
|------|--------|
| `home.html` | ✅ 200 |
| `collection.html` | ✅ 200 |
| `games-list.html` | ✅ 200 |
| `game-detail.html` | ✅ 200 |
| `consoles.html` | ✅ 200 |
| `debug.html` | ✅ 200 |
| `launcher.html` | ❌ 404 (sert depuis prototype_v2/) |
| `index.html` | ❌ 404 (sert depuis prototype_v2/) |

## Données

| Source | Localisation | Volume |
|--------|-------------|--------|
| SQLite | backend/storage/retrodex.sqlite | 507 jeux, 16 consoles |
| catalog.json | prototype_v2/data/catalog.json | 507 jeux |
| prices.json | prototype_v2/data/prices.json | 507 prix |
| consoles.json | prototype_v2/data/consoles.json | 16 systèmes |
| demo_subset.json | prototype_v2/data/demo_subset.json | 40 jeux showcase |
| market_history.js | prototype_v2/data/ | 5 séries × 10 ans |
| market_sales.js | prototype_v2/data/ | 120 ventes vérifiées |

## Dépendances Backend (package.json)

| Package | Rôle |
|---------|------|
| express | Serveur HTTP |
| sequelize | ORM |
| sqlite3 | Base SQLite |
| pg | PostgreSQL (optionnel) |
| cors | CORS |
| dotenv | Variables d'environnement |

## Technologies Prototype Front

| Technologie | Usage |
|-------------|-------|
| Vanilla JS | Logique applicative |
| Chart.js (CDN) | Graphiques |
| Jersey 10 + VT323 (Google Fonts) | Typographie |
| Canvas API | Illustration Game Boy |
| localStorage | Cache artworks |
