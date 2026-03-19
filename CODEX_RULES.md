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
