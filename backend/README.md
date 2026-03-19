# RetroDex Backend

Backend Node minimal et lisible pour brancher un petit JSON API sur les donnees
RetroDex existantes.

## Ce qu'il fait

- utilise `Express` pour exposer des routes simples
- utilise `Sequelize` avec `SQLite`
- recharge les donnees depuis :
  - `frontend/data/catalog.json`
  - `frontend/data/entries.json`
  - `frontend/data/prices.json`
- stocke une copie locale dans `backend/storage/retrodex.sqlite`
- garde les donnees SQLite entre deux redemarrages
- ne reseed pas au boot si la base contient deja des jeux

## Routes

- `GET /`
- `GET /games`
- `GET /games/:id`
- `GET /api/health`
- `GET /api/games`
- `GET /api/games/random`
- `GET /api/games/:id`
- `GET /api/games/:id/summary`
- `GET /api/consoles`
- `GET /collection`
- `GET /api/collection`
- `POST /collection`
- `POST /api/collection`
- `DELETE /collection/:id`
- `DELETE /api/collection/:id`
- `POST /api/sync`
- `GET /debug.html`
- `GET /home.html`
- `GET /collection.html`
- `GET /consoles.html`
- `GET /games-list.html`
- `GET /game-detail.html`

### Note sur le seed

- au demarrage, le backend remplit SQLite seulement si la table `games` est vide
- `POST /api/sync` force un reseed manuel depuis les JSON du prototype
- le reseed manuel passe par une transaction pour eviter une base vide si un import echoue
- `npm run sync` fait la meme chose en ligne de commande

### Note sur `limit`

- `GET /api/games` utilise une limite par defaut de `20`
- si `limit` est invalide, vide ou inferieur a `1`, l'API retombe sur cette valeur par defaut
- la limite maximale reste `100`

### Note sur la recherche

- `GET /games` et `GET /api/games` utilisent maintenant une recherche titre insensible a la casse
- un filtre comme `?q=zelda` fonctionne donc de la meme facon en SQLite et en PostgreSQL

### Note sur les erreurs

- les routes async passent maintenant par un wrapper commun
- une erreur backend renvoie un JSON simple :
  - `{"ok": false, "error": "Internal server error"}`

## Demarrage

```powershell
cd backend
Copy-Item .env.example .env
npm install
npm start
```

Ou plus simplement :

```powershell
powershell -ExecutionPolicy Bypass -File ".\start-backend.ps1"
```

Le script :

- verifie que `node` et `npm` sont disponibles
- detecte si le backend tourne deja
- lance `npm start` dans une nouvelle fenetre `cmd` si besoin
- attend que `http://127.0.0.1:3000/api/health` reponde
- ouvre `http://127.0.0.1:3000/home.html`

Si tu veux juste le demarrer sans ouvrir le navigateur :

```powershell
powershell -ExecutionPolicy Bypass -File ".\start-backend.ps1" -NoBrowser
```

Pour stopper le backend local proprement :

```powershell
powershell -ExecutionPolicy Bypass -File ".\stop-backend.ps1"
```

Le serveur tourne ensuite sur :

- `http://localhost:3000`

## SQLite ou PostgreSQL

Par defaut, le backend reste en mode SQLite local pour rester simple.

Il passe automatiquement en PostgreSQL si tu renseignes :

- `DATABASE_URL`
- ou `PGHOST`, `PGPORT`, `PGDATABASE`, `PGSCHEMA`, `PGUSER`, `PGPASSWORD`

Exemple minimal :

```powershell
$env:PGHOST='localhost'
$env:PGPORT='5432'
$env:PGDATABASE='retrodex_mvp'
$env:PGSCHEMA='retrodex'
$env:PGUSER='retrodex_mvp'
$env:PGPASSWORD='ton_mot_de_passe'
cmd /c npm start
```

### Bootstrap local sans `CREATEDB`

Pour tenter de creer une base PostgreSQL locale :

```powershell
powershell -ExecutionPolicy Bypass -File ".\init-postgres.ps1" -DatabaseName retrodex
```

Si le role courant a `CREATEDB`, le script cree la base cible.

Sinon, il ne bloque plus :

- il cherche une base existante accessible
- il cree un schema dedie dedans
- il t'indique quelle combinaison `PGDATABASE` + `PGSCHEMA` utiliser

Exemple concret pour un role sans `CREATEDB` :

```powershell
$env:PGHOST='localhost'
$env:PGPORT='5432'
$env:PGUSER='retrodex_mvp'
$env:PGPASSWORD='ton_mot_de_passe'
powershell -ExecutionPolicy Bypass -File ".\init-postgres.ps1" -DatabaseName retrodex -FallbackDatabase retrodex_mvp -SchemaName retrodex

$env:PGDATABASE='retrodex_mvp'
$env:PGSCHEMA='retrodex'
cmd /c npm start
```

Cette approche permet d'utiliser PostgreSQL local meme si la creation d'une nouvelle base `retrodex` est interdite.

## Exemples

```powershell
Invoke-RestMethod "http://localhost:3000/"
Invoke-RestMethod "http://localhost:3000/api/health"
Invoke-RestMethod "http://localhost:3000/games"
Invoke-RestMethod "http://localhost:3000/games/tetris-game-boy"
Invoke-RestMethod "http://localhost:3000/api/games?console=Game Boy&limit=5"
Invoke-RestMethod "http://localhost:3000/api/games/random?console=Game Boy"
Invoke-RestMethod "http://localhost:3000/api/games/tetris-game-boy"
Invoke-RestMethod "http://localhost:3000/api/games/tetris-game-boy/summary"
Invoke-RestMethod "http://localhost:3000/api/consoles"
Invoke-RestMethod "http://localhost:3000/api/collection" -Method Post -ContentType "application/json" -Body '{"gameId":"tetris-game-boy","condition":"Loose","notes":"Premier test"}'
Invoke-RestMethod "http://localhost:3000/api/collection/1" -Method Delete
Invoke-RestMethod "http://localhost:3000/api/sync" -Method Post
```

## Page debug

## Home beginner

Le backend sert maintenant un petit point d'entree ici :

- `http://localhost:3000/home.html`

Cette page sert a :

- verifier rapidement l'etat backend
- ouvrir :
  - `games-list.html`
  - `game-detail.html`
  - `debug.html`
- afficher un mini resume :
  - database active
  - storage
  - nombre de jeux
  - nombre de consoles
  - premiers jeux de la liste
  - raccourci vers `collection.html`

Elle est recommandee comme premiere page pour un debutant.

## Page debug

Le backend sert aussi une petite page HTML autonome ici :

- `http://localhost:3000/debug.html`

Elle permet de :

- verifier que l'API repond
- chercher des jeux par titre
- filtrer par console
- tirer un jeu aleatoire
- ouvrir un panneau resume backend lisible pour un jeu
- ouvrir directement une fiche detaillee via :
  - `http://localhost:3000/debug.html?gameId=tetris-game-boy`
- copier rapidement :
  - `id`
  - `title`
  - `console`
- ouvrir la page meme depuis `file://` avec une URL backend editable

Elle est volontairement simple pour rester lisible par un debutant.

Le fichier `frontend/debug.html` reste volontairement plus leger :

- il sert de pont statique/backend
- il peut comparer les donnees
- il peut ouvrir la page backend riche pour le detail complet
- il ne remplace pas le flow principal JSON-first

## GamesList beginner

Le backend sert aussi une page beginner tres simple ici :

- `http://localhost:3000/games-list.html`

Elle permet de :

- chercher des jeux via `GET /games`
- filtrer par console
- limiter le nombre de lignes
- ouvrir un detail simple via `GET /games/:id`
- ouvrir la page debug riche pour un detail plus complet

Cette page est volontairement separee du prototype principal :

- elle sert juste a prouver que le backend peut etre consomme
- elle ne remplace pas `frontend/index.html`

## Consoles beginner

Le backend sert aussi une page beginner simple ici :

- `http://localhost:3000/consoles.html`

Elle permet de :

- consommer `GET /api/consoles`
- afficher la liste des consoles disponibles
- voir rapidement combien de jeux sont presents par console
- ouvrir `games-list.html` avec un filtre console deja applique

Cette page reste volontairement tres simple :

- un 4e point d'entree beginner utile
- sans logique metier supplementaire
- sans toucher au flow statique principal

## Collection beginner

Le backend sert aussi une page beginner simple ici :

- `http://localhost:3000/collection.html`

Elle permet de :

- consommer `GET /api/collection`
- voir les items de collection existants
- ouvrir la fiche backend d'un jeu ajoute
- supprimer un item via `DELETE /api/collection/:id`

Cette page reste volontairement simple :

- elle valide le cycle collection sans React ni auth
- elle s'appuie sur les routes Sprint 4 deja en place
- elle ne remplace pas le flow statique principal

## GameDetail beginner

Le backend sert aussi une page detail beginner ici :

- `http://localhost:3000/game-detail.html?id=tetris-game-boy`

Elle permet de :

- charger un jeu par `id`
- consommer directement `GET /games/:id`
- afficher une fiche simple
- renvoyer vers `games-list.html`
- ouvrir la page debug riche pour le meme jeu

Cette page reste volontairement tres simple :

- une fiche beginner dediee
- sans dupliquer la page debug riche
- sans toucher au flow statique principal

## Collection backend

Le backend expose maintenant un premier point d'entree lecture seule pour la collection :

- `GET /collection`
- `GET /api/collection`

Pour l'instant :

- la collection est vide au demarrage
- la route permet surtout de preparer Sprint 4 sans casser le backend beginner existant
- le prochain petit lot logique sera d'ajouter `POST /api/collection`

## Routes beginner-friendly

En plus des routes `/api/*`, le backend expose maintenant :

- `GET /games`
- `GET /games/:id`

Ces routes renvoient directement :

- un tableau JSON simple pour `/games`
- un objet jeu simple pour `/games/:id`

Elles sont pratiques pour :

- un premier `curl`
- une verification rapide dans le navigateur
- un frontend debutant qui veut juste lire la liste sans wrapper

Si tu ouvres `backend/public/debug.html` directement depuis le disque :

- la page tente automatiquement `http://127.0.0.1:3000`
- il faut donc lancer d'abord :
  - `npm start`

## Smoke test

Le smoke test backend demarre maintenant sur un port dedie pour eviter un conflit
si le backend principal tourne deja sur `3000`.

```powershell
cmd /c npm run smoke
```

Par defaut, le test utilise :

- `http://127.0.0.1:3100`
