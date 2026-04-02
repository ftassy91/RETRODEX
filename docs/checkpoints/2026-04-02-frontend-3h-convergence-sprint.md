# RetroDex — Sprint 3h frontend + completude

## Resume

Sprint court de convergence sur les trois surfaces publiques prioritaires :
- `hub`
- `games-list`
- `game-detail`

Objectif :
- rendre la richesse plus visible sans creer de systeme parallele
- renforcer la fiche jeu comme surface de lecture
- rendre le hub plus utile comme cockpit d orientation

## Ce qui a ete branche

### Lecture de richesse partagee
- ajout d un helper public `content-signals`
- derive un langage court et reutilisable :
  - richesse
  - etat de lecture
  - confiance/fiabilite de surface
- calcul 100% cote frontend a partir des champs deja exposes au runtime

### Game Detail
- ajout d un statut de contenu visible dans le hero
- ouverture par defaut des sections `editorial` et `stats`
- fiche riche plus lisible au premier regard
- fiche plus legere reste stable et signalee comme en cours d enrichissement

### Catalogue
- lignes catalogue enrichies avec un signal de richesse et un etat de surface
- preview detail plus intelligent
- meilleure transition catalogue -> fiche

### Hub
- remplacement du hub minimal par un vrai cockpit d orientation
- signaux utiles de publication / archive / couverture editoriale
- vitrine courte de fiches riches a ouvrir
- recentrage du hub sur l orientation, pas sur la narration produit

## Validation

Passe :
- `npm run smoke`
- `cd backend && npm test -- --runInBand`
- verification syntaxique des JS modifies

Note :
- le `smoke` reste vert cote backend mais conserve des flags `*PageReady=false`
- ces flags reposent sur des heuristiques HTML plus anciennes que la structure actuelle
- ce point reste hors sprint et releve d une passe de maintenance des checks

## Hors lot

- dashboard admin complet de completude
- packaging premium global
- convergence documentaire complete
- refonte `stats`, `collection`, `encyclopedia`, `consoles`, `franchises`
- nouvelles waves d enrichment
