## RÈGLE GIT — Branches

Ne jamais créer de branche autonome (codex/*, fix/*, etc.).
Ne jamais committer directement sur main ou develop.

Avant tout travail :
  git branch --show-current
  → doit afficher : feature/sprint-X-nom
  → sinon : STOP, attendre instruction

Flux obligatoire :
  feature/sprint-X-nom → develop → main

## REGLE GIT - Branchement

Ne jamais committer directement sur main.
Flux obligatoire : feature/* -> develop -> main

Branches actives :
  main                    -> stable, deployable
  develop                 -> integration sprints
  feature/sprint-X-nom    -> travail en cours

Debut de tache : git checkout -b feature/sprint-X-nom depuis develop
Fin de tache   : merge feature -> develop, puis supprimer la branche
Release        : merge develop -> main + tag vX.Y.Z

## REGLE DE NAVIGATION - LIRE EN PREMIER

Source de verite unique : RETRODEXseed/
  backend/   -> port 3000
  frontend/  -> port 8080
  scripts/   -> automation

INTERDIT de modifier :
  RETRODEXseedV0/**       -> legacy, lecture seule
  frontend/data/*.js      -> donnees prototype 3DS
  frontend/js/top-screen-generator.js -> algorithme deterministe
  backend/storage/*.sqlite -> base de donnees

En cas de doute sur le bon fichier :
  -> toujours choisir backend/ ou frontend/
  -> ne jamais modifier RETRODEXseedV0/
