# 2026-04-02 - Supabase Canonical Convergence

## Audit court

- Le vrai blocage n'etait plus les publishers canoniques isoles, mais le couplage `run-audit -> quality_records.updated_at -> publish-records`.
- `publish-sandbox-to-supabase.js` executait bien la chaine canonique, mais ne validait que les codes de sortie, pas la convergence reelle.
- Sous Windows, le post-verify cassait encore sur l'appel `npm`.
- `publish-external-assets` et `publish-media` ecrivaient tous les deux sur `media_references`, ce qui laissait un delta residuel si `publish-media` ne passait pas en dernier.

## Correctifs appliques

- `backend/src/services/admin/audit/persistence.js`
  - `quality_records.updated_at` ne bouge plus quand le contenu metier est strictement identique.
  - comparaison semantique sur les scores, le tier, les champs critiques et le `breakdown_json`.
- `backend/scripts/publish-records-supabase.js`
  - application par blocs transactionnels separes.
  - resume par bloc avec `insert/update/unchanged/pending/durationMs`.
  - journalisation explicite des blocs lents.
- `backend/scripts/publish-sandbox-to-supabase.js`
  - timeouts par step.
  - capture `stdout/stderr/duration/timedOut/parsedSummary`.
  - `--skip-audit` disponible, mais audit inline garde le comportement par defaut.
  - post-verify automatique en mode `write`.
  - verdict final machine/humain via `status`, `validated`, `converged`, `criticalPending`, `criticalInvalid`, `decision`.
  - compatibilite Windows corrigee pour `npm` via `cmd.exe`.
  - selection du vrai resume `run-audit`, sans tomber sur `*_curation_summary.json`.
- Ordre canonique ajuste :
  1. `publish-structural`
  2. `publish-records`
  3. `publish-editorial`
  4. `publish-credits-music`
  5. `publish-external-assets`
  6. `publish-media`
  7. `publish-curation`

## Resultats reels

Controles cibles :

- `node backend/scripts/run-audit.js` x2 : plus de drift massif sur `quality_records`
- `node backend/scripts/publish-records-supabase.js` : `pendingRows = 0`
- `node backend/scripts/publish-credits-music-supabase.js` : `pendingRows = 0`, `invalidRows = 0`
- `node backend/scripts/publish-media-references-supabase.js` : `pendingRows = 0`
- `node backend/scripts/publish-curation-supabase.js` : `pendingRows = 0`

Validation finale executee :

- `npm run publish:run`
- post-verify integre :
  - `publish-records` ok
  - `publish-credits-music` ok
  - `publish-media` ok
  - `publish-curation` ok
  - `smoke` ok
  - `backend tests` ok

Rapport valide :

- `data/publish/2026-04-02T12-19-59-062Z-report.json`
- verdict :
  - `status = ok`
  - `validated = true`
  - `converged = true`
  - `criticalPending = []`
  - `criticalInvalid = []`

## Decision finale

La migration/publication canonique Supabase est maintenant **consideree comme sure et validee**.

Pourquoi cette decision est raisonnable :

- l'audit inline reste actif dans `publish:run`
- `quality_records` est devenu deterministe
- les publishers critiques repassent a zero immediatement apres ecriture
- aucun `person:` invalide ne remonte
- `smoke` et `backend tests` passent dans la meme chaine de validation

## Point restant a surveiller

- `publish-records --apply` reste le step le plus long du pipeline. Il est maintenant convergent et observable, mais reste le premier point a profiler si le temps total du run devient un sujet prioritaire.
