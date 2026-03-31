# RetroDex Enrichment

## Règles générales

- Toujours commencer par un dry-run quand le script le permet.
- Supabase production n'est jamais écrite sans validation humaine.
- Les scripts de publication Supabase nécessitent un environnement valide :
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_KEY` ou équivalent résolu par [env.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/backend/src/config/env.js)
- Les scripts doivent être considérés comme non autorisés en prod si leur comportement `dry-run` n'est pas explicitement confirmé.

## Scripts

| Script | Rôle | Commande | Dry-run | Credentials | Idempotence |
| --- | --- | --- | --- | --- | --- |
| `backend/scripts/backfill-canonical.js` | backfill canonique depuis legacy | `node backend/scripts/backfill-canonical.js --dry-run=true` | oui | DB locale / runtime DB | pensée pour être rejouable |
| `backend/scripts/import-catalog.js` | import catalogue | `node backend/scripts/import-catalog.js --dry-run=true` | oui | DB locale / runtime DB | pensée pour être rejouable |
| `backend/scripts/publish-sandbox-to-supabase.js` | orchestrateur publication sandbox -> Supabase | `node backend/scripts/publish-sandbox-to-supabase.js --dry-run` | oui | `SUPABASE_URL`, service key | pensée pour dry-run d'abord |
| `backend/scripts/sync-supabase-ui-fields.js` | synchronisation champs UI vers Supabase | `node backend/scripts/sync-supabase-ui-fields.js --dry-run` | implicite dans la Phase 3 prévue | `SUPABASE_URL`, service key | à exécuter avec prudence |
| `backend/scripts/seed.js` | seed local | `node backend/scripts/seed.js --dry-run` | oui | aucune clé externe détectée | local only |
| `backend/scripts/run-audit.js` | recalc audit/qualité | `node backend/scripts/run-audit.js` | non détecté | DB locale / runtime DB | supposé rejouable |
| `backend/scripts/run-pass1-curation.js` | lance la curation PASS 1 | `node backend/scripts/run-pass1-curation.js` | non détecté | DB locale / runtime DB | à considérer contrôlé |
| `backend/scripts/run-pass1-enrichment-backlog.js` | lance le backlog d'enrichissement PASS 1 | `node backend/scripts/run-pass1-enrichment-backlog.js` | non détecté | DB locale / runtime DB | à considérer contrôlé |
| `backend/scripts/publish-credits-music-supabase.js` | publication credits/music | `node backend/scripts/publish-credits-music-supabase.js` | non détecté dans le scan rapide | `SUPABASE_URL`, service key | à auditer avant prod |
| `backend/scripts/publish-curation-supabase.js` | publication états de curation | `node backend/scripts/publish-curation-supabase.js` | non détecté dans le scan rapide | `SUPABASE_URL`, service key | à auditer avant prod |
| `backend/scripts/publish-editorial-supabase.js` | publication éditoriale | `node backend/scripts/publish-editorial-supabase.js` | non détecté dans le scan rapide | `SUPABASE_URL`, service key | à auditer avant prod |
| `backend/scripts/publish-external-assets-supabase.js` | publication assets externes | `node backend/scripts/publish-external-assets-supabase.js` | non détecté dans le scan rapide | `SUPABASE_URL`, service key | à auditer avant prod |
| `backend/scripts/publish-media-references-supabase.js` | publication références média | `node backend/scripts/publish-media-references-supabase.js` | non détecté dans le scan rapide | `SUPABASE_URL`, service key | à auditer avant prod |
| `backend/scripts/publish-records-supabase.js` | publication provenance / records | `node backend/scripts/publish-records-supabase.js` | non détecté dans le scan rapide | `SUPABASE_URL`, service key | à auditer avant prod |
| `backend/scripts/publish-structural-supabase.js` | publication tables structurelles | `node backend/scripts/publish-structural-supabase.js` | non détecté dans le scan rapide | `SUPABASE_URL`, service key | à auditer avant prod |
| `backend/scripts/export_db.js` | export DB locale | `node backend/scripts/export_db.js` | non détecté | local | utilitaire |
| `backend/scripts/_supabase-publish-common.js` | helper interne partagé | non appelé directement | n/a | `SUPABASE_URL`, service key | helper |

## Credentials externes

À la date de l'audit, les scripts `backend/scripts/*.js` scannés ne montrent pas de dépendance directe à :

- `YOUTUBE_API_KEY`
- `IGDB_CLIENT_ID`
- `IGDB_CLIENT_SECRET`
- `EBAY_APP_ID`

Ces credentials restent des besoins potentiels de pipeline futurs, mais ils ne bloquent pas les scripts DB déjà présents dans `backend/scripts`.

## Règle de prudence

Les scripts de publication Supabase non explicitement documentés `dry-run` dans le code doivent être traités comme :

- non approuvés pour prod par défaut
- à auditer individuellement avant toute exécution write
