# RetroDex - Project Map

## Source de verite (tout le reste est secondaire)
backend/              -> API REST + pages UI (port 3000)
frontend/             -> 3DS prototype + RetroMarket (port 8080)
scripts/              -> audit, import, sync, assets
backend/storage/      -> SQLite canonique (507 jeux)

## Experimental - ne pas modifier sans intention
RETRODEXseedV0/       -> prototype v0, reference visuelle uniquement

## Ne jamais modifier directement
frontend/data/*.js          -> donnees du prototype 3DS
frontend/js/top-screen*.js  -> generateur GB deterministe
backend/storage/*.sqlite    -> base de donnees (via scripts seulement)

## Points d'entree
run_backend.bat   -> demarre le backend
run_frontend.bat  -> demarre le frontend
http://localhost:3000/hub.html  -> entree principale backend
http://localhost:8080/launcher.html -> entree principale frontend
