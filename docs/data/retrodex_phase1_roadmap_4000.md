# RetroDex — Roadmap Phase 1 : cap 4000 fiches canoniques

**Référence :** `origin/main` @ `b4f3a2e` (2026-04-06)
**Date :** 2026-04-07
**Objectif central :** 4000 fiches avec `isPublishable = true` et `completenessScore ≥ 55`

---

## Principe de priorisation

Chaque action est évaluée par rapport à une seule question :

> Cela augmente-t-il directement le nombre de fiches atteignant le standard minimum réaliste (bronze) ?

Si non → report ou préparation sans industrialisation.

---

## Bloc A — Faire maintenant

*Tout ce qui augmente directement le nombre de fiches bronze (score ≥55, isPublishable = true)*

### A1. Mesurer l'état réel (priorité 0)

**Action :** lancer le CLI de couverture sur la totalité du catalogue.
```bash
node backend/scripts/enrichment/recompute-enrichment-coverage.js --candidate-limit=5000
```

**Livrable attendu :**
- Nombre exact de fiches `isPublishable = true`
- Nombre exact par tier (bronze / silver / gold)
- Liste des `missingCoreRequirements` les plus fréquents
- Nombre réel de fiches dans le catalogue (pour savoir combien il manque avant 4000)

**Pourquoi en premier :** impossible de prioriser sans ce chiffre. Toute décision sans cette mesure est spéculative.

---

### A2. Corriger les fiches bloquées par le gate identity

Le gate identity échoue si l'un des 6 signaux est absent :
`title`, `console`, `release`, `cover`, `editorial_seed`, `studio_seed`

Les cas les plus probables de blocage :
- `cover` absent → relancer IGDB / ScreenScraper cover fetch pour les fiches sans cover_url
- `editorial_seed` absent (pas de summary ni synopsis) → G2 summary batch ciblé sur les fiches sans summary
- `studio_seed` absent (pas de developer string ni company developer) → G3 dev team sur les fiches sans developer

**Action :** identifier les fiches avec `missingCoreRequirements` non vide → enrichissement ciblé sur ces champs uniquement.

---

### A3. Pousser les fiches `probable` vers `bronze`

Les fiches avec `completenessScore` entre 45 et 54 sont à un pas du seuil bronze.
Un seul signal editorial ou media peut suffire à franchir le seuil.

**Action :** pour les fiches entre 45 et 55 de score, identifier le `missingDomainSignals[0]` et enrichir ce champ en priorité.

---

### A4. Continuer les lots d'enrichissement actifs dans leur périmètre

Les séries G5, G7, G8 (premium lots) continuent à enrichir les fiches les plus avancées.
Ne pas redéfinir leur périmètre. Les laisser fonctionner sur leur catalogue cible.

---

### A5. Tracer les fiches publiées

Maintenir `game_curation_states` à jour pour les fiches publiées.
Le champ `is_target` et `console_publication_slots` permettent le pilotage par console.

---

## Bloc B — Préparer sans industrialiser

*Ce qu'il faut préparer proprement maintenant, sans ouvrir un grand chantier*

### B1. Raccorder `game_credits` aux services publics

La table `game_credits` est créée et backfillée.
Le backfill script `backfill_game_credits.js` est opérationnel.

**Préparation :** documenter la décision de bascule (quand les services publics liront `game_credits` au lieu de `game_people` + `game_companies`).
Ne pas lancer la bascule sans un lot dédié avec perimeter et exit criteria.

**Risque à surveiller :** si l'enrichissement continue à écrire dans `game_people` / `game_companies` après la bascule, `game_credits` se désynchronise.

### B2. Préparer la bascule OST

Même situation que B1 pour `game_ost` + `game_ost_tracks`.
Backfill script présent. Services publics lisent encore `ost` + `ost_tracks`.

**Préparation :** vérifier que `backfill_game_ost.js` couvre bien tous les cas de `ost_releases` (fallback `osts` legacy présent dans credits.js).

### B3. Suivre l'état de `price_summary`

La table est créée et le backfill script est prêt.
Elle n'est pas encore raccordée aux services publics.
Quand elle le sera, `priceConfidenceTier` devra utiliser `price_summary.confidence_score` plutôt que le compte manuel de `price_history`.

**Préparation :** documenter le chemin de raccordement. Ne pas modifier `public-price-service.js` sans lot dédié.

### B4. Clarifier le statut de `retrodex_index`

**[à vérifier]** La table `retrodex_index` (modèle `RetrodexIndex.js`) existe mais son usage dans les routes n'a pas été vérifié dans cet audit.
Vérifier si elle est montée dans une route et si elle est peuplée.

### B5. Clarifier `franch_id` et la table franchises

`franch_id` existe dans `Game.js`. La route `/api/franchises*` existe.
La table `franchises` n'est pas visible dans les migrations locales.
**Action :** vérifier en Supabase si la table `franchises` existe et si `franch_id` est renseigné.

---

## Bloc C — Reporter après les 4000

*Ce qui n'est pas prioritaire et pourrait créer de la dette si ouvert trop tôt*

### C1. `price_status v2`

Confirmé gated sur ingestion eBay réelle dans `price_history` (DECISIONS.md).
Ne pas rouvrir tant qu'eBay n'est pas ingéré.

### C2. Transition `console_id` / `developer_id` comme contrat runtime

Le runtime est toujours string-driven. La transition vers les FKs nécessite un lot dédié de parité et dual-read.
Aucune urgence pour le cap 4000.

### C3. ML / embeddings pour matching

Pas justifié à ce stade. Le score de match Phase 1 suffit.

### C4. Dashboards de pilotage graphiques

Le CLI JSON suffit pour piloter. Un dashboard peut venir après les 4000.

### C5. Architecture microservices ou pipelines multi-sources complexes

Hors périmètre total de cette phase.

### C6. Collection multi-utilisateurs

Migration `20260331_007_collection_runtime_canonical.js` en pending_review.
Non validée pour prod. À traiter dans un lot séparé après les 4000.

### C7. LCS / companion features

Non ouvert, non prioritaire.

---

## Résumé des actions immédiates

| Priorité | Action | Effort estimé |
|----------|--------|---------------|
| 0 | Lancer recompute-enrichment-coverage sur tout le catalogue | faible |
| 1 | Enrichir les fiches bloquées par gate identity manquant | moyen |
| 2 | Pousser les fiches 45-54 vers bronze par 1 signal | moyen |
| 3 | Continuer G5/G7/G8 dans leur périmètre | continu |
| 4 | Documenter la décision de bascule game_credits | faible |
| 5 | Vérifier retrodex_index et franch_id dans Supabase | faible |
