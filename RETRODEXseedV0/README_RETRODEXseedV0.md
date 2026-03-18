# RETRODEXseedV0 — État du package

Date de mise à jour : 2026-03-18
Emplacement actuel :
`C:\Users\ftass\OneDrive\Bureau\RETRODEXseed\RETRODEXseedV0`

## Ce dossier est quoi ?

`RETRODEXseedV0` n'est **pas** une archive complète de tout l'environnement RetroDex.
C'est un **seed de prototype front statique** centré sur :

- `prototype_v0/launcher.html`
- `prototype_v0/index.html`
- `prototype_v0/modules/retromarket/market.html`

Il contient aussi :

- les datasets front (`data/`, `datapack/`)
- les assets générés (`assets/generated_gb/`, `retrodeck_assets/`)
- la mémoire de travail (`memory/`)
- quelques fichiers de review / debug

Un manifeste machine-readable est aussi disponible ici :

- [manifest.json](C:/Users/ftass/OneDrive/Bureau/RETRODEXseed/RETRODEXseedV0/manifest.json)

## Ce que le package contient bien

Présent dans `prototype_v0/` :

- `assets/`
- `css/`
- `data/`
- `datapack/`
- `data_engine/`
- `img/`
- `js/`
- `maps/`
- `memory/`
- `modules/`
- `retrodeck_assets/`
- `review/`
- `launcher.html`
- `index.html`
- `debug.html`

Modules visibles déjà présents :

- `modules/retrodex/index.html`
- `modules/collection/index.html`
- `modules/retromarket/market.html`
- `modules/neoretro/index.html`

## Pièces manquantes ou non incluses

Ce package **ne contient pas** les éléments suivants :

- aucun dossier `backend/`
- aucune API Express / Sequelize
- aucun modèle `Game` / `CollectionItem`
- aucune route `/api/*`
- aucun script de lancement backend
- aucun script de sync Notion
- aucun setup Docker
- aucun export ZIP source
- aucun README d'archive maître
- aucune config `.env` backend

En clair :

- `RETRODEXseedV0` = **seed front statique**
- ce n'est **pas** le workspace complet de développement

## Dossier de développement complet de référence

Le workspace de développement principal se trouve ailleurs, dans :

`C:\Users\ftass\OneDrive\Bureau\RETRODEX VERSION OK\retrodex_v2_checkpoint_20260313_1722`

C'est dans ce dossier complet qu'on trouve en plus :

- `backend/`
- `scripts/`
- `exports/`
- `.git/`
- les commits de travail
- les outils de validation et d'intégration

## Points d'attention repérés

Le seed contient aussi quelques artefacts qui ne doivent pas être interprétés comme des dossiers fonctionnels :

- `prototype_v0\{css,js,data,img,memory}`
- `prototype_v0\assets\{source`

Ces entrées ressemblent à des restes de copie ou de pattern mal résolu.
Elles ne doivent pas être utilisées comme source de vérité.

## Utilisation correcte

Pour lancer correctement ce seed :

1. servir `prototype_v0/` via HTTP local
2. ouvrir :
   - `http://localhost:8080/launcher.html`
   - puis `index.html`
   - puis `modules/retromarket/market.html`
3. ne pas utiliser `file://`

## Conclusion

Si une analyse externe signale des "pièces manquantes", c'est normal si elle attendait un package complet.
`RETRODEXseedV0` est volontairement incomplet par rapport au workspace principal.

La bonne lecture est :

- package autonome pour le **front statique**
- pas package autonome pour le **backend, Notion, Docker, ou l'environnement complet**
