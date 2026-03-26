# STACK TECHNIQUE - Onboarding developpeur - RetroDex

## 1. Resume executif

RetroDex est actuellement un prototype local-first, front-first, sans build step, base sur des pages HTML statiques, du JavaScript vanilla et des jeux de donnees charges directement dans le navigateur. Le point d'entree principal observable dans ce workspace est [launcher.html](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/launcher.html), qui ouvre ensuite RetroDex et RetroMarket.

Le coeur technique reel, observe localement au 2026-03-22, est le suivant :

- runtime principal : [index.html](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/index.html)
- module marche : [modules/retromarket/market.html](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/modules/retromarket/market.html)
- couche data partagee : [js/data-layer.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/js/data-layer.js)
- collection locale : [js/collection-store.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/js/collection-store.js)
- presentation marche : [modules/retromarket/market_presenter.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/modules/retromarket/market_presenter.js)

Point important pour un nouveau dev : ce workspace ne contient pas de dossier `backend/`. Des notes historiques du projet mentionnent un backend optionnel Express/Sequelize/SQLite dans d'autres etats du repo, mais il n'est pas present ici et ne doit pas etre traite comme source de verite pour ce prototype.

## 2. Ce qu'est RetroDex

RetroDex est une archive interactive orientee collectionneur retro. Le produit assemble plusieurs surfaces :

- `Launcher` : point d'entree de demo et navigation modules
- `RetroDex` : fiche jeu et navigation archive dans une interface inspiree console portable
- `RetroMarket` : terminal marche local-first pour afficher snapshots, historique verifie et ventes verifiees quand elles existent
- `Collection` : module placeholder visible dans le launcher, alors que la vraie collection fonctionnelle du prototype est injectee dans la fiche jeu via la logique locale
- `Neo Retro Games` : placeholder produit

Logique produit actuellement observable :

- browse du catalogue
- lecture fiche jeu
- prix par etat depuis snapshot local
- enrichissement marche verifie quand des imports existent
- collection locale single-user via `localStorage`

## 3. Stack technique actuel

### Frontend

| Zone | Stack observe |
| --- | --- |
| Runtime principal | HTML statique + JS vanilla |
| Styles | CSS inline + feuilles locales dans `css/` + CSS inline dans certains modules |
| Charts | Chart.js via CDN dans `index.html` |
| Fonts | Google Fonts dans certains ecrans (`launcher.html`, `market.html`) |
| Routing | hash routing minimal dans [js/router.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/js/router.js) + navigation HTML directe entre pages |

### Data

| Zone | Source |
| --- | --- |
| Catalogue | [data/catalog.json](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/data/catalog.json) et [data/catalog.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/data/catalog.js) |
| Consoles | [data/consoles.json](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/data/consoles.json) et [data/consoles.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/data/consoles.js) |
| Prix snapshot | [data/prices.json](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/data/prices.json) et [data/prices.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/data/prices.js) |
| Editorial / entries | [data/entries.json](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/data/entries.json) et [data/entries.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/data/entries.js) |
| Marche verifie | [data/market_history.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/data/market_history.js), [data/market_sales.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/data/market_sales.js), [data/market_sources.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/data/market_sources.js) |
| Demo subset | [data/demo_subset.json](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/data/demo_subset.json) et [data/demo_status.json](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/data/demo_status.json) |

### Persistence locale

- collection locale : `localStorage`
- cle observee : `retrodex_owned_v1`
- source de verite locale : [js/collection-store.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/js/collection-store.js)

### Python / scripts

Le projet repose aussi sur plusieurs scripts Python utilitaires :

- regen data : [data/regen.py](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/data/regen.py)
- demo subset / status : [data/build_demo_subset.py](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/data/build_demo_subset.py), [data/build_demo_status.py](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/data/build_demo_status.py)
- market imports : [data/refresh_market_imports.py](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/data/refresh_market_imports.py), [data/validate_market_imports.py](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/data/validate_market_imports.py)
- asset pipeline : [data_engine/asset_pipeline/build_asset_library.py](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/data_engine/asset_pipeline/build_asset_library.py)
- sync Notion locale : [scripts/retrodex_sync_agent.py](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/scripts/retrodex_sync_agent.py)
- pipeline visuel autonome : [scripts/retrodex_visual_pipeline.py](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/scripts/retrodex_visual_pipeline.py)

### Backend / DB / infra

Etat observe dans ce workspace :

- aucun `package.json`
- aucun dossier `backend/`
- aucun `vercel.json`
- aucun `railway.json`
- aucun `.env` ou `.env.example`

Conclusion operationnelle :

- local : oui, prototype statique directement runnable
- production cible : non confirmee dans ce workspace
- Railway / PostgreSQL : mentionnes dans des notes historiques, a verifier dans un autre repo ou un autre etat du projet avant de les documenter comme stack active

## 4. Architecture de l'application

### Vue d'ensemble

```text
launcher.html
  -> modules/retrodex/index.html -> redirection vers index.html
  -> modules/retromarket/market.html
  -> modules/collection/index.html (placeholder)
  -> modules/neoretro/index.html (placeholder)
```

### Architecture front observee

1. `launcher.html`
- page d'entree de demo
- navigation module par grille 2x2
- pas de logique metier critique

2. `index.html`
- runtime principal RetroDex
- charge les datasets `data/*.js`
- charge la couche partagee `js/*.js`
- contient encore une part importante de logique inline
- integre maintenant la collection locale et la presentation marche partagee

3. `modules/retromarket/market.html`
- ecran marche dedie
- s'appuie sur `DATA_LAYER`
- s'appuie sur `RETROMARKET_DATA`
- s'appuie sur `RETROMARKET_PRESENTATION`

### Separation des responsabilites observee

| Fichier | Responsabilite |
| --- | --- |
| [js/data-layer.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/js/data-layer.js) | chargement des donnees et acces partage |
| [js/router.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/js/router.js) | hash router minimal |
| [js/app.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/js/app.js) | bootstrap |
| [js/retrodex.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/js/retrodex.js) | vue RetroDex modulaire legacy/secondaire |
| [js/home.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/js/home.js) | home/editorial/collection legacy modulaire |
| [js/search.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/js/search.js) | recherche modulaire |
| [js/collection-store.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/js/collection-store.js) | source de verite locale de collection |
| [js/collection-panel.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/js/collection-panel.js) | wiring DOM collection dans la fiche |
| [modules/retromarket/market_data.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/modules/retromarket/market_data.js) | adaptation des donnees marche |
| [modules/retromarket/market_presenter.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/modules/retromarket/market_presenter.js) | labels/hierarchie/wrapping de presentation |
| [modules/retromarket/market_ui.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/modules/retromarket/market_ui.js) | binding UI du terminal |

### Dette structurelle connue

- `index.html` reste tres lourd et concentre encore beaucoup de logique
- coexistence entre runtime inline dans `index.html` et piste modulaire `js/*.js`
- donnees en double format `.json` et `.js`
- plusieurs docs memoire mentionnent un backend absent du workspace
- encodage et historiques de texte heterogenes dans certaines notes/docs

## 5. Arborescence projet

```text
prototype_v0/
|-- launcher.html
|-- index.html
|-- start.sh
|-- css/
|-- js/
|-- data/
|-- modules/
|   |-- retrodex/
|   |-- retromarket/
|   |-- collection/
|   `-- neoretro/
|-- assets/
|-- retrodeck_assets/
|-- data_engine/
|-- scripts/
|-- datapack/
|-- memory/
|-- review/
`-- logs/
```

### Zones importantes

- `data/`
  source de verite metier locale du prototype

- `js/`
  couche partagee JS vanilla

- `modules/retromarket/`
  terminal marche autonome

- `assets/`
  images runtime, placeholders, rendus, icones, sorties visuelles

- `retrodeck_assets/`
  librairie asset pipeline persistante, avec metadata et checkpoints

- `data_engine/asset_pipeline/`
  scripts de generation/curation d'assets

- `scripts/`
  automation locale, sync Notion, pipeline visuel

- `memory/`
  journal technique et etat du projet

- `data/notion_exports/`
  snapshots/export locaux lies a l'integration Notion optionnelle

### Ce qui est legacy ou WIP

- `modules/collection/index.html`
  placeholder visible, pas module complet

- `modules/neoretro/index.html`
  placeholder visible

- `js/home.js`, `js/retrodex.js`, `js/market.js`, `js/search.js`
  base modulaire partiellement utile, mais pas unique source de verite du runtime principal

- notes `memory/*.md`
  utiles pour le contexte, mais a recouper avec le code avant toute conclusion forte

## 6. Lancement local

### Prerequis

- Python 3 disponible localement
- navigateur moderne
- lancement via HTTP, pas `file://`

### Commande la plus simple

Depuis la racine du workspace :

```bash
python -m http.server 8080
```

ou sur environnement Unix-like :

```bash
./start.sh
```

Le script [start.sh](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/start.sh) lance un `python3 -m http.server 8080` puis ouvre :

- `http://localhost:8080/launcher.html`

### Points d'entree utiles

- launcher : `http://localhost:8080/launcher.html`
- runtime principal : `http://localhost:8080/index.html`
- runtime principal sans splash de validation : `http://localhost:8080/index.html?nosplash=1`
- RetroMarket : `http://localhost:8080/modules/retromarket/market.html`

### Validation locale minimale recommandee

1. lancer `launcher.html`
2. ouvrir RetroDex
3. verifier navigation entre jeux
4. verifier que la fiche charge bien prix + bloc collection + market snapshot
5. ouvrir RetroMarket
6. verifier search + selection + fallback `data unavailable`

## 7. Base de donnees et logique metier

### Il n'y a pas de base de donnees active dans ce workspace

Le prototype charge des datasets versionnes depuis `data/`.

Etat confirme localement :

- `catalog.json` : 507 jeux
- `prices.json` : 507 entrees prix
- `consoles.json` : 16 consoles

### Structure jeu

Les jeux viennent principalement de [data/catalog.json](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/data/catalog.json). Les champs observes et reutilises dans le front incluent typiquement :

- `id`
- `title`
- `console`
- `year`
- `developer`
- `metascore`
- `rarity`

L'enrichissement editorial vient de [data/entries.json](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/data/entries.json).

### Pricing

Pricing snapshot :

- source locale : [data/prices.json](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/data/prices.json)
- structure principale : `loose`, `cib`, `mint`

Pricing marche verifie :

- historique : [data/market_history.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/data/market_history.js)
- ventes : [data/market_sales.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/data/market_sales.js)
- sources : [data/market_sources.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/data/market_sources.js)

Couverture observee dans [data/market_coverage_report.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/data/market_coverage_report.md) :

- 5 jeux avec historique
- 15 jeux avec ventes verifiees
- 15 jeux avec sources

### Confiance / honnetete de la donnee

Il n'y a pas de `confidence_score` formel global observe dans ce workspace. En revanche, le projet fait deja une distinction utile entre :

- `snapshot`
- `partial`
- `verified`

Cette logique passe surtout par [modules/retromarket/market_presenter.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/modules/retromarket/market_presenter.js) et par les statuts calcules dans [modules/retromarket/market_data.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/modules/retromarket/market_data.js).

### Collection

La collection du prototype est locale, single-user, sans auth, sans sync serveur.

- source de verite : [js/collection-store.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/js/collection-store.js)
- persistance : `localStorage`
- cle : `retrodex_owned_v1`

Important :

- le launcher expose un module Collection placeholder
- la fonctionnalite collection la plus reelle dans ce workspace est branchee dans la fiche jeu principale

### Search / archive / modules

- recherche archive : `DATA_LAYER.searchGames(query, filters)`
- overview marche : `DATA_LAYER.getMarketOverview()`
- stats rarete : `DATA_LAYER.getRarityStats()`
- fiche marche detaillee : `RETROMARKET_DATA.getMarketRecord(gameId)`

## 8. Deploiement / production

### Ce qui est confirme

- prototype runnable localement en statique
- pas de build step obligatoire
- pas de pipeline de deploiement confirme localement
- integration Notion optionnelle et desactivee par defaut

### Ce qui est a confirmer

- cible production reelle
- hosting final
- usage effectif de Railway
- usage effectif d'une base PostgreSQL

Des notes memoire mentionnent un backend optionnel et des trajectoires Railway/PostgreSQL, mais rien de tout cela n'est observable comme stack active dans ce workspace au 2026-03-22.

### Integration Notion

Le projet embarque un bootstrap de sync local :

- script : [scripts/retrodex_sync_agent.py](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/scripts/retrodex_sync_agent.py)
- config exemple : [scripts/retrodex_sync_config.example.json](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/scripts/retrodex_sync_config.example.json)

Etat observe localement :

- pas de `scripts/retrodex_sync_config.json`
- Notion desactivee par defaut
- les operations sont mises en queue tant que le token et les mappings DB ne sont pas fournis

## 9. Workflow recommande

### Ordre de prise en main conseille

1. ouvrir `launcher.html`
2. lire [memory/project_memory.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/memory/project_memory.md)
3. lire [memory/resume_state.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/memory/resume_state.md)
4. lire [js/data-layer.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/js/data-layer.js)
5. lire [index.html](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/index.html) pour comprendre le runtime reel
6. lire [modules/retromarket/market_data.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/modules/retromarket/market_data.js)
7. lire [js/collection-store.js](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/js/collection-store.js)

### Discipline conseillee

- toujours verifier le code reel avant de suivre une note `memory/`
- considerer `data/` comme source de verite metier locale
- ne jamais inventer prix, historique ou ventes verifiees
- tester sous `http://`, pas `file://`
- isoler les changements lourds hors de `index.html` quand c'est possible
- preferer des helpers courts et centralises plutot qu'un nouveau gros bloc inline

### Pieges a eviter

- supposer qu'un backend existe dans ce workspace
- supposer qu'un deploiement prod est pret
- supposer que le module `Collection` du launcher est la source de verite fonctionnelle
- dupliquer la logique pricing entre `index.html` et `market_presenter.js`
- traiter les notes historiques comme l'etat courant sans verification

## 10. Points de vigilance

### 1. `index.html` reste le point de dette principal

- beaucoup de logique encore inline
- runtime reel plus proche de `index.html` que de la piste modulaire pure

### 2. Dualite des architectures

- piste modulaire `js/*.js`
- runtime inline `index.html`
- modules HTML dedies (`modules/retromarket/market.html`, placeholders)

Le projet est fonctionnel, mais pas encore totalement unifie.

### 3. Dualite des formats data

- `.json` pour scripts/outillage
- `.js` pour chargement browser sans build

Cette dualite est voulue, mais peut creer des oublis si on met a jour une seule face.

### 4. Docs vs code

Les docs memoire mentionnent plusieurs etats du projet, dont un backend optionnel absent ici. Pour un onboarding safe, privilegier toujours le code du workspace courant.

### 5. Notion

L'integration Notion est optionnelle et partiellement outillee, mais pas prete sans credentials et mappings.

## 11. Checklist de prise en main rapide

### Lecture

- [STACK_TECHNIQUE_ONBOARDING_RETRODEX.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/STACK_TECHNIQUE_ONBOARDING_RETRODEX.md)
- [memory/project_memory.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/memory/project_memory.md)
- [memory/resume_state.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/memory/resume_state.md)
- [modules/retromarket/README.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/modules/retromarket/README.md)
- [scripts/README.md](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/prototype_v0/scripts/README.md)

### Lancement

```bash
python -m http.server 8080
```

Puis ouvrir :

- `http://localhost:8080/launcher.html`
- `http://localhost:8080/index.html?nosplash=1`
- `http://localhost:8080/modules/retromarket/market.html`

### Verifications minimales

- RetroDex charge sans erreur bloquante
- la navigation entre jeux fonctionne
- la collection locale persiste via `localStorage`
- RetroMarket charge et degrade proprement quand les donnees manquent
- les datasets `catalog`, `prices`, `consoles` sont coherents

### Avant de coder une feature

- identifier si la logique vit dans `index.html` ou dans un module dedie
- verifier si `DATA_LAYER` couvre deja le besoin
- verifier si la presentation marche doit passer par `market_presenter.js`
- verifier si la persistance locale doit passer par `collection-store.js`

## 12. Resume ultra-court

Si tu rejoins RetroDex aujourd'hui, retiens ceci :

- c'est un prototype statique local-first, pas une app full-stack active dans ce workspace
- la vraie source de verite locale est dans `data/`
- le runtime reel passe surtout par `index.html`
- RetroMarket est le module le mieux separe
- la collection est locale via `localStorage`
- Notion est outille mais non connecte dans ce workspace
- la principale dette technique est la coexistence entre inline runtime et modularisation partielle

## Note de confiance

Cette page a ete redigee a partir :

- du code observe dans ce workspace
- des scripts reels disponibles
- des notes memoire internes

Quand un point n'etait pas confirme par le code courant, il a ete formule comme historique, optionnel ou a confirmer.
