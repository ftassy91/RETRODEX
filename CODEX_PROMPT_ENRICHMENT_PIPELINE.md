# RetroDex - Prompt Optimise - Pipeline d'Enrichissement

This file is the authoritative mission prompt for the current enrichment
pipeline. It reflects the real project state after runtime stabilization,
admin/services cleanup, and the first editorial enrichment lots.

Use this prompt for Codex or Claude when opening new enrichment work.
It supersedes the older data/market pipeline prompts for this specific domain,
without deleting them as historical references.

```text
MISSION - RetroDex : formaliser et etendre le pipeline d'enrichissement admin existant, sans creer de systeme parallele

## Contexte absolu

Tu travailles sur RetroDex dans un etat deja stabilise au 1er avril 2026.

L'architecture canonique est deja en place et ne doit pas etre remise en cause :

- Supabase = source de verite runtime / prod
- SQLite local = environnement de staging back-office autorise pour dry-run, scoring, enrichissement et validation avant publication
- routes publiques = orchestration HTTP uniquement
- services = logique metier / acces data
- normalisation commune via `backend/src/lib/normalize.js`
- runtime public actif deja nettoye et stabilise
- back-office isole sous :
  - `backend/src/routes/admin`
  - `backend/src/services/admin`
- aucune mutation prod implicite
- aucun retour vers une architecture hybride ou monolithique

IMPORTANT :
Tu ne construis PAS un nouveau systeme d'enrichissement parallele.
Tu dois prolonger le systeme admin/back-office deja existant.

## Lecture obligatoire avant toute decision

Avant d'ecrire du code, lis et prends comme verite prioritaire :

1. `docs/CLAUDE_CONTINUITY_BRIEF.md`
2. `docs/ARCHITECTURE.md`
3. `docs/DECISIONS.md`
4. `docs/ENRICHMENT.md`
5. `docs/enrichment-pipeline.md`
6. `docs/PHASE3_DB_READINESS.md`

Tu dois aussi auditer le code reel avant toute proposition structurelle.

## Etat reel a respecter

Le repo contient deja un socle d'enrichissement et de pilotage :

### Services admin existants
- `backend/src/services/admin/curation-service.js`
- `backend/src/services/admin/audit-service.js`
- `backend/src/services/admin/enrichment-backlog-service.js`
- `backend/src/services/admin/game-read-service.js`
- `backend/src/services/admin/console-service.js`

### Arbres internes deja stabilises
- `backend/src/services/admin/curation/*`
- `backend/src/services/admin/audit/*`
- `backend/src/services/admin/game-read/*`

### Helpers deja presents
- `backend/src/services/admin/enrichment-backlog-profile.js`
- `backend/src/services/admin/console-profile.js`

### Scripts existants
- `backend/scripts/run-pass1-curation.js`
- `backend/scripts/run-audit.js`
- `backend/scripts/run-pass1-enrichment-backlog.js`
- `backend/scripts/publish-editorial-supabase.js`
- `backend/scripts/sync-supabase-ui-fields.js`
- autres scripts `publish-*` deja presents dans `backend/scripts/`

### Tables / structures deja existantes a auditer et reutiliser en priorite
- `game_curation_states`
- `game_curation_events`
- `game_content_profiles`
- `console_publication_slots`
- `game_editorial`
- `media_references`
- `game_people`
- `source_records`
- `field_provenance`
- `quality_records`
- eventuellement `market_snapshots`, `price_history`

### Etat metier actuel
- Phase 3 v1 est deja appliquee en prod
- `price_status v2` est suspendu tant qu'il n'y a pas de vraie ingestion `ebay`
- ce chantier ne doit pas rouvrir la DB Phase 3
- l'enrichissement editorial a deja demarre ; les volumes exacts doivent etre reverifies au debut du lot
- prix v2 reste hors scope

## Objectif metier

Industrialiser le pipeline d'enrichissement existant pour conduire progressivement RetroDex vers au moins 100 fiches premium reellement completes, en restant compatible avec l'architecture actuelle.

Le systeme doit etre capable de :
- selectionner les meilleurs candidats
- mesurer ce qui manque reellement par domaine
- enrichir localement en staging back-office
- publier explicitement en prod apres validation humaine
- tracer les sources / preuves
- recalculer la completude
- determiner quelles fiches entrent dans le top 100 premium

## Regle fondamentale

Tu dois travailler dans la continuite stricte de l'existant.

### Interdictions
- ne pas toucher au runtime public actif
- ne pas remettre de logique metier dans les routes
- ne pas creer un systeme parallele concurrent de `curation` / `audit` / `enrichment-backlog`
- ne pas remplacer les statuts existants (`editorial_status`, `media_status`, `price_status`)
- ne pas inventer une seconde verite de completude deconnectee
- ne pas considerer SQLite local comme verite prod
- ne pas creer un gros script monolithique qui ferait tout
- ne pas bricoler le frontend public
- ne pas rouvrir `price_status v2`
- aucune mutation prod sans validation humaine explicite

### Obligations
- reutiliser d'abord l'existant
- rester Supabase-first pour la verite prod
- rester admin/back-office pour l'orchestration
- garder le workflow dry-run -> validation -> publication
- garder des regles canoniques uniques
- isoler clairement :
  - regles
  - scoring
  - couverture
  - evidence / provenance
  - selection
  - orchestration
- documenter chaque nouveau lot
- conserver un systeme relancable, tracable, rejouable

## Principe de conception

Le systeme cible doit prolonger le pipeline actuel, pas le remplacer.

Sequence cible :
1. selectionner les jeux prioritaires
2. mesurer leur couverture actuelle
3. determiner les domaines manquants
4. enrichir localement en staging
5. tracer les sources et le niveau de confiance
6. publier explicitement dans Supabase apres validation humaine
7. recalculer les statuts / scores
8. mesurer le top 100 premium

## Definition d'une fiche premium

Tu dois proposer une logique canonique additive, compatible avec les statuts existants.

Elle doit definir explicitement :
- `completeness_score`
- `completion_tier`
- `is_top100_candidate`
- `is_publishable`

### Contraintes
- ne pas remplacer `editorial_status`, `media_status`, `price_status`
- s'appuyer dessus comme signaux de base
- ajouter une couche premium plus fine si necessaire

### Blocs attendus

#### Bloc 1 - identite minimale
Une fiche n'est jamais candidate si elle n'a pas au minimum :
- `title`
- `console`
- `year` ou `releaseDate`
- `cover`
- `summary` ou `synopsis`
- `developer` ou `publisher`

#### Bloc 2 - richesse editoriale
Signaux attendus parmi :
- `summary`
- `synopsis`
- `lore`
- `characters`

#### Bloc 3 - credits / roles
Signaux attendus parmi :
- `developer`
- `publisher`
- `distributor`
- `soundtrack_label`
- `Director`
- `Composer`
- `Writer`
- `Producer`
- `Designer`
- `Programmer`

#### Bloc 4 - medias / archive
Signaux attendus parmi les types deja coherents avec la taxonomie existante :
- `manual`
- `map`
- `sprite_sheet`
- `ending`
- `archive_item`
- `youtube_video`
- `screenshot`
- `scan`
- `artwork` / `asset` seulement si l'audit prouve qu'ils ont deja une place canonique dans la taxonomie existante

#### Bloc 5 - musique
Bonus premium si la fiche contient :
- compositeurs
- tracks

### Tiers attendus
Par exemple :
- `gold` = premium complet
- `silver` = tres riche mais encore incomplet
- `bronze` = publiable mais pas premium

Tu peux ajuster les seuils, mais ils doivent etre :
- explicites
- stables
- documentes
- compatibles avec l'existant

## Architecture cible

Tu dois proposer l'extension minimale coherente avec l'etat actuel.

Structure souhaitee, a ajuster seulement si l'audit prouve mieux :

- `backend/src/services/admin/enrichment/rules.js`
- `backend/src/services/admin/enrichment/scoring.js`
- `backend/src/services/admin/enrichment/coverage-service.js`
- `backend/src/services/admin/enrichment/evidence-service.js`
- `backend/src/services/admin/enrichment/target-selection-service.js`

Tu ne crees une couche `queue-service.js` ou de nouveaux `workers/*` que si l'audit prouve que les services/scripts existants ne suffisent pas.

Meme regle pour les tables :
- ne cree `game_enrichment_jobs`, `game_enrichment_coverage`, `game_enrichment_evidence` que si l'existant ne couvre pas deja correctement ces responsabilites
- audit d'abord
- migration explicite ensuite si necessaire
- jamais de mutation prod implicite

## Compatibilite obligatoire avec l'existant

Tu dois reutiliser autant que possible :
- `editorial_status`, `media_status`, `price_status`
- `game_curation_states`
- `game_curation_events`
- `game_content_profiles`
- `console_publication_slots`
- `quality_records`
- `source_records`
- `field_provenance`
- les services admin deja stabilises
- la documentation deja alignee

Tu ne dois pas :
- remplacer le pipeline PASS1 existant
- casser les scripts `run-pass1-curation.js`, `run-audit.js`, `run-pass1-enrichment-backlog.js`
- publier implicitement en Supabase
- introduire une seconde logique de selection concurrente sans rattachement explicite au backlog actuel

## Strategie d'execution demandee

Tu ne fais pas tout d'un coup.
Tu travailles par lots explicites.

# LOT 1 - Audit de compatibilite et fondations canoniques

## Objectif
Ne rien reinventer avant d'avoir prouve ce qui manque.

## Travail attendu
- auditer le pipeline d'enrichissement deja existant
- cartographier ce que couvrent deja :
  - `curation-service`
  - `audit-service`
  - `enrichment-backlog-service`
  - les scripts `run-*` et `publish-*`
- lister les tables existantes reutilisables
- definir la regle canonique de scoring premium
- definir la regle canonique de couverture
- proposer uniquement les nouvelles briques reellement necessaires
- documenter clairement ce qui doit etre :
  - reutilise
  - etendu
  - cree

## Execution autorisee
Si l'audit le permet sans creer d'architecture parallele, tu peux implementer le socle minimal du Lot 1 dans le meme mouvement.

## Criteres de sortie
- mini-audit clair
- aucune regression runtime public
- aucune mutation prod implicite
- scoring canonique explicite
- strategie de couverture explicite
- architecture cible justifiee par l'existant
- si code ajoute :
  - `node --check` vert
  - `npm run smoke` vert

# LOT 2 - Selection pilotee du top 100

## Objectif
Construire une selection premium compatible avec le backlog reel.

## Travail attendu
- definir un `priority_score` compatible avec les signaux existants
- produire un top 100 calculable
- eviter les selections absurdes ou irrealistes
- s'appuyer sur :
  - statut editorial actuel
  - richesse media existante
  - potentiel credible d'enrichissement
  - interet catalogue / franchise / console
- etendre l'existant plutot que creer une queue concurrente

## Criteres de sortie
- top 100 calculable
- logique documentee
- dry-run disponible
- aucune mutation prod implicite

# LOT 3 - Orchestration d'enrichissement additive

## Objectif
Completer l'orchestration actuelle seulement la ou elle manque.

## Travail attendu
- formaliser un cycle type :
  - selection
  - enrichissement local
  - evidence
  - curation
  - audit
  - publication ciblee apres validation humaine
- ne creer des workers specialises que si necessaire apres audit
- garder des etapes separees :
  - local staging
  - publication prod
  - sync des statuts

## Criteres de sortie
- cycle relancable
- pas de doublons non maitrises
- logs propres
- evidence stockee ou planifiee proprement
- pas de mutation prod implicite

# LOT 4 - Audit du top 100 premium

## Objectif
Mesurer la realite du resultat.

## Travail attendu
- script ou service d'audit final
- sortie claire :
  - combien de `gold`
  - combien de `silver`
  - combien de `bronze`
  - combien encore incompletes
- liste des domaines manquants par jeu
- ordre de reprise recommande

## Criteres de sortie
- vision claire et exploitable
- possibilite de relancer intelligemment les enrichissements
- aucune ambiguite entre staging local et verite prod

## Contraintes de methode

- audit d'abord
- implementation ensuite
- commits atomiques
- un objectif clair par commit
- rollback simple
- pas d'elargissement de perimetre
- documentation alignee
- aucune modification prod sans validation humaine explicite

## Livrables attendus au premier mouvement

1. un mini-audit de compatibilite avec l'architecture existante
2. une proposition canonique de scoring premium
3. une proposition canonique de couverture
4. un plan par lots realiste
5. le LOT 1 implemente seulement si le perimetre le permet sans forcer une architecture parallele
6. la documentation correspondante

## Regle finale

Le systeme d'enrichissement doit donner cette impression :
- il prolonge naturellement RetroDex
- il reutilise l'architecture deja stabilisee
- il ne cree pas de dette technique parallele
- il garde la separation staging local / publication prod
- il permet d'atteindre 100 fiches premium de maniere pilotee, tracable et relancable
```
