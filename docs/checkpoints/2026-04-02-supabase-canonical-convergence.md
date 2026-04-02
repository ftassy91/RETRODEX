# 2026-04-02 — Supabase Canonical Convergence

## Audit court

- Le chemin canonique du repo passait encore par `backend/scripts/publish-sandbox-to-supabase.js`, mais appelait implicitement le legacy `scripts/migrate/sqlite_to_supabase.js`.
- `publish-media-references-supabase.js` avait ete corrige sur la serialisation `jsonb`, mais manquait encore d'observabilite exploitable.
- `publish-curation-supabase.js` convergait, mais sans sortie standardisee de type `insert/update/unchanged/invalid`.
- `publish-records-supabase.js` convergait partiellement ; les faux diffs etaient lies a des normalisations heterogenes.
- `publish-credits-music-supabase.js` etait le vrai blocage : generation possible de `person:`, normalisation incoherente de `normalized_name`, et collisions sur l'index `idx_people_normalized_name`.

## Correctifs appliques

- Le chemin normal de `publish-sandbox-to-supabase.js` n'appelle plus `sqlite_to_supabase.js`.
- Le legacy reste accessible uniquement via `--with-legacy-migration`.
- Ajout dans `_supabase-publish-common.js` de helpers canoniques :
  - normalisation JSON / nombres / booleens pour les diffs
  - comparaison `rowsDiffer`
  - generation stable `buildCanonicalPersonId`
  - validation `isValidPersonId`
- `publish-media-references-supabase.js` :
  - diff aligne sur les helpers partages
  - logs precis en cas de rechute `jsonb`
  - sortie standardisee `insert/update/unchanged/invalid`
- `publish-curation-supabase.js` :
  - diff aligne sur les helpers partages
  - sortie standardisee par bloc
- `publish-records-supabase.js` :
  - diff aligne sur les helpers partages
  - sortie standardisee sur `source_records`, `field_provenance`, `quality`
- `publish-credits-music-supabase.js` :
  - plus aucun `person:` genere
  - remapping des `legacy person_id` invalides vers un identifiant canonique stable
  - normalisation canonique de `normalized_name`
  - reconciliation avec les personnes deja presentes a distance via `normalized_name`
  - logs structures sur collision d'upsert
  - sortie standardisee `insert/update/unchanged/invalid`

## Resultats reels

Dry-runs convergents :

- `publish-media-references-supabase.js` -> `pendingRows = 0`
- `publish-records-supabase.js` -> `pendingRows = 0`
- `publish-curation-supabase.js` -> `pendingRows = 0`
- `publish-credits-music-supabase.js` -> `pendingRows = 0`, `invalidRows = 0`, plus aucun `person:` dans les echantillons

Apply cibles executes :

- `publish-records-supabase.js --apply`
- `publish-credits-music-supabase.js --apply`

Validation :

- `npm run publish:plan`
- `npm run smoke`
- `cd backend && npm test -- --runInBand`

## Decision finale

La publication finale canonique n'est **pas consideree comme validee**.

Raison :

- le `publish:run` global a ete lance
- il est reste bloque trop longtemps sur `publish-records --apply`
- les process ont ete arretes proprement pour eviter un etat ambigu

Conclusion operative :

- les publishers canoniques critiques sont maintenant beaucoup plus propres et convergents
- la voie normale est clarifiee
- la migration legacy n'est plus sur le chemin par defaut
- mais l'orchestrateur global `publish:run` doit encore etre durci/optimise avant d'etre considere comme chemin final totalement fiable
