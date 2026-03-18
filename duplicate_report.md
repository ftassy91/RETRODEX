# Duplicate Report — RETRODEXseed
Note: this is a historical duplicate report. Any `prototype_v2` path in this file corresponds to `RETRODEXseedV0/prototype_v0/` in the current repository layout.
Historical labels are preserved for traceability only; do not treat `prototype_v2` as an active workspace path.

Généré le : 2026-03-17

---

## Doublons identifiés entre checkpoint et prototype_v2

### catalog.json / catalog.js
- `prototype_v2/data/catalog.json` ← source
- `prototype_v2/data/catalog.js` ← copie JS wrapper
- `prototype_v2/data/catalog_active.js` ← subset actif (démarre sur demo_subset)
- **Décision** : garder `catalog.json` comme source de vérité dans `database/json/`

### consoles.json / consoles.js
- `prototype_v2/data/consoles.json` ← source
- `prototype_v2/data/consoles.js` ← copie JS wrapper
- `backend` utilise la SQLite (sync via seed)
- **Décision** : garder `consoles.json`, supprimer `.js` wrapper

### entries.json / entries.js / entries_active.js
- 3 versions : source JSON, wrapper JS, version active filtrée
- **Décision** : garder `entries.json` uniquement

### demo_status.json + demo_status.js
- Doublon intentionnel (JSON source + wrapper JS chargeable via `<script>`)
- **Décision** : conserver les deux, régénérer toujours depuis `build_demo_status.py`

### debug.html (doublon entre backend et prototype_v2)
- `backend/public/debug.html` ← version riche backend
- `prototype_v2/debug.html` ← bridge front vers backend
- **Décision** : conserver les deux, rôles différents

### illustration.js vs illustration_v3_backup.js
- `prototype_v2/js/illustration.js` ← version active
- `prototype_v2/js/illustration_v3_backup.js` ← sauvegarde
- **Décision** : garder `illustration.js`, archiver le backup dans `docs/archive/`

### market_history_template.json + market_sales_template.json
- Templates de structure pour les imports RetroMarket
- **Décision** : déplacer dans `tools/templates/`

---

## Doublons internes dans prototype_v2/data/

| Fichier actif | Doublon | Action |
|---------------|---------|--------|
| `catalog.json` | `catalog.js`, `catalog_active.js`, `catalog_synthetic_backup.json` | Garder JSON, archiver les autres |
| `entries.json` | `entries.js`, `entries_active.js` | Garder JSON |
| `consoles.json` | `consoles.js` | Garder JSON |
| `demo_subset.json` | `demo_subset.js` | Garder les deux (usage différent) |
| `market_history_template.json` | — | Déplacer vers tools/templates/ |
| `market_sales_template.json` | — | Déplacer vers tools/templates/ |
| `market_sources_template.json` | — | Déplacer vers tools/templates/ |
| `illustration.js` | `illustration_v3_backup.js` | Garder actif, archiver backup |

---

## Scripts Python redondants

| Script | Statut | Action |
|--------|--------|--------|
| `validate.py` | ✅ actif | Garder dans tools/python/ |
| `validate_market_imports.py` | ✅ actif | Garder |
| `qa_demo_subset.py` | ✅ actif | Garder |
| `build_demo_status.py` | ✅ actif | Garder |
| `build_demo_subset.py` | ✅ actif | Garder |
| `generate_top_screen_generated_gb.py` | ✅ actif | Garder |
| `refresh_market_imports.py` | ✅ actif | Garder |
| `generate_market_coverage_report.py` | ✅ actif | Garder |
| `regen.py` | ❓ à vérifier | Garder prudemment |
| `tmp2tbxpvnl` | ❌ fichier temp | Supprimer |

---

## Fichiers temporaires à supprimer

- `prototype_v2/data/tmp2tbxpvnl` — fichier temp sans extension
- `retrodeck_assets/_cache/` — cache régénérable
- `**/__pycache__/` — bytecode Python
- `**/*.pyc` — bytecode compilé

---

## Résumé des décisions

| Action | Nombre estimé |
|--------|--------------|
| Fichiers à conserver | ~85% |
| Fichiers à archiver (backup) | ~10% |
| Fichiers à supprimer (temp/cache) | ~5% |
| Doublons à fusionner | 8 cas |
