# RetroDex - Franchise Memory Rules

## Objectif

Fournir une couche de direction artistique plus precise que les buckets generiques.
Ces regles servent quand un jeu a besoin d'une memoire visuelle plus specifique pour etre reconnaissable sans copie.

## Principe

Chaque regle doit decrire :
- un sujet principal unique
- un decor lie a une memoire de gameplay ou de monde
- une lecture immediate
- un ou deux signaux d'univers vraiment utiles
- des garde-fous legaux explicites

## Gold Standard

Le cas de reference est `Link's Awakening` sur Game Boy :
- petit personnage vu de dos
- grande mer lisible
- montagne-ile comme destination
- sommet en forme d'oeuf
- forte sensation portable / title-screen
- aucune foule
- tres peu d'elements

Ce n'est pas une copie. C'est une grammaire de representation :
- petit sujet
- grand landmark
- horizon clair
- emotion lisible

## Quand utiliser une franchise memory rule

Il faut une regle dediee si :
- le bucket generique produit des images trop abstraites
- la franchise repose sur un moment de jeu tres specifique
- le jeu a une memoire d'univers forte mais peu d'elements surs juridiquement
- la lisibilite depend d'un cadrage ou d'une hierarchie tres particuliers

## Regles actuellement couvertes

- Zelda handheld / Link's Awakening
- Zelda mainline horizon-driven
- Zelda: A Link to the Past
- Metroid
- Perfect Dark
- Tetris
- Super Mario 64
- Super Mario Bros. 3
- Super Mario World
- Sonic the Hedgehog 2
- Mega Man X
- Contra
- Advance Wars
- Donkey Kong Country
- Kirby's Dream Land
- Final Fantasy VI
- EarthBound
- Secret of Mana
- Super Castlevania IV
- F-Zero
- Ninja Gaiden
- Super Mario Land 2
- Castlevania III
- Donkey Kong
- Kirby's Adventure
- Super Mario Kart
- Street Fighter II
- Soul Calibur
- Tekken
- Pokemon Crystal
- Wario Land
- Mega Man Zero
- Shinobi
- Panzer Dragoon

## Methode

1. Partir d'un souvenir de jeu, pas d'un asset officiel.
2. Decrire un moment lisible en une seconde.
3. Reduire la scene a un sujet, un espace, une tension.
4. Ajouter seulement les marqueurs d'univers indispensables.
5. Bloquer explicitement les derives protegees.

## Format attendu d'une regle

- `keywords`
- `main_subject`
- `environment`
- `action_mood_cue`
- `mood`
- `composition`
- `memory_hook`
- `legal_watchouts`

## Regle produit

Si un jeu ne devient reconnaissable qu'en copiant un personnage, un logo ou une composition officielle,
la bonne solution n'est pas de forcer le prompt.
La bonne solution est de trouver une memoire de jeu plus profonde :
- destination
- geste
- espace
- tension
- structure de niveau
