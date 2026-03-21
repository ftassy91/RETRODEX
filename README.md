# RetroDex

Terminal de référence pour les collectionneurs de jeux rétro.

## Ce que c'est

RetroDex est un outil pour explorer, collecter et comprendre
les jeux vidéo rétro. Interface Bloomberg terminale, données
de marché avec niveau de confiance, encyclopédie de franchises
et gestion de collection personnelle.

## Fonctionnalités

- Catalogue de 1296 jeux rétro (NES, SNES, Sega, Neo Geo, PS1...)
- Recherche universelle jeux + franchises
- Fiches jeu avec synopsis, équipe de développement, anecdotes
- 15 encyclopédies de franchises (Castlevania, Zelda, Final Fantasy...)
- Prix avec niveau de confiance (T1 vérifié / T3 indicatif / T4 estimé)
- Gestion de collection avec valeur totale estimée
- Interface terminale phosphore Bloomberg

## Stack

- Backend : Node.js + Express + Sequelize + SQLite
- Frontend : HTML/CSS/JS vanilla — design système Bloomberg
- Pipeline données : Wikidata + seed éditorial

## Lancer en local

```bash
cd backend
npm install
node src/server.js
```

Ouvre : http://localhost:3000/hub.html

## Variables d'environnement
