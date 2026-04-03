# RetroDex

> **Live**: https://retrodex-beryl.vercel.app/

Terminal de référence pour les collectionneurs de jeux rétro.

## Lire d'abord

Pour reprendre le projet correctement :
1. [AGENTS.md](./AGENTS.md)
2. [docs/CLAUDE_CONTINUITY_BRIEF.md](./docs/CLAUDE_CONTINUITY_BRIEF.md)
3. [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
4. [docs/DECISIONS.md](./docs/DECISIONS.md)

Etat actuel a retenir :
- [backend/public/](./backend/public/) est la surface publique canonique
- [frontend/](./frontend/) est un prototype secondaire
- Supabase est la verite runtime/prod
- SQLite local sert de staging/back-office

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

- Backend runtime : Node.js + Express + services Sequelize
- Base de données runtime : Postgres via `DATABASE_URL` en production, SQLite en local
- Scripts data/admin : `supabase-js` pour publish, audit et synchronisation
- Frontend : HTML/CSS/JS vanilla — design système Bloomberg
- Pipeline données : Wikidata + seed éditorial

## Etat canonique du stack

- Runtime public : Node.js + Express + services publics sous [backend/src/services/](./backend/src/services/)
- Source de verite runtime : [backend/db_supabase.js](./backend/db_supabase.js)
- Staging/back-office : SQLite local sous [backend/storage/retrodex.sqlite](./backend/storage/retrodex.sqlite)
- Scripts data/admin : audit, curation, enrichment, publication controlee vers Supabase
- Frontend actif : HTML/CSS/JS vanilla sous [backend/public/](./backend/public/)
- Prototype secondaire : [frontend/](./frontend/)

Voir aussi :
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- [docs/DECISIONS.md](./docs/DECISIONS.md)
- [docs/CLAUDE_CONTINUITY_BRIEF.md](./docs/CLAUDE_CONTINUITY_BRIEF.md)

## Lancer en local

```bash
cd backend
npm install
node src/server.js
```

Ouvre : http://localhost:3000/hub.html

## Variables d'environnement
