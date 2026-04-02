# RetroDex — Rapport final premium convergence

Date: 2026-04-02

## Avant
- surfaces publiques cohérentes mais encore inégalement premium
- langage de lecture parfois hétérogène
- défauts visibles mineurs sur certaines pages et certains helpers
- fiche jeu encore en dessous de son rôle stratégique

## Après
- langage public stabilisé autour de :
  - `Richesse`
  - `État`
  - `Confiance`
- `game-detail` renforcée comme surface principale :
  - hero plus informatif
  - panneau de lecture immédiate
  - meilleure hiérarchie entre identité, synthèse et signaux
- `hub`, `games-list`, `search` plus cohérents dans leur vocabulaire et leurs signaux
- `RetroMarket` nettoyé sur les libellés visibles
- CSS partagé harmonisé sur les éléments critiques
- lot documenté et relisible

## Arbitrages
- priorité donnée à la convergence visible plutôt qu'à un nouveau chantier data
- priorité donnée aux surfaces coeur plutôt qu'à l'ensemble du catalogue secondaire
- priorité donnée à la cohérence système plutôt qu'à des micro-features

## Validation
- `npm run smoke`
- `cd backend && npm test -- --runInBand`
- vérification syntaxique JS des fichiers publics coeur

## Ce qui reste sous le niveau 9
- plusieurs surfaces secondaires portent encore des strates historiques
- le design system reste perfectible hors pages coeur
- la fiche jeu peut encore monter en qualité éditoriale et en voisinage/navigation
- le packaging premium global du projet peut encore être densifié

## Leviers suivants les plus rentables
1. poursuivre le nettoyage visible des surfaces publiques secondaires
2. pousser encore la fiche jeu sur le voisinage, les références et la relation à l'action
3. finaliser une note premium de lecture produit + architecture + complétude
4. continuer à réduire les incohérences CSS locales au profit de patterns vraiment stables
