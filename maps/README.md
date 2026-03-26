# RetroDex — Cartes in-game (maps/)

Ce dossier contient les cartes affichées dans le **top screen en Screen 3**.

## Installation

### Option A — Script automatique (macOS / Linux)
```bash
cd RETRODEXseedV0/prototype_v0/maps
bash download_maps.sh
```

### Option B — Téléchargement manuel (Windows)
Télécharger chaque fichier et le placer dans ce dossier `maps/` :

| Fichier local | URL source |
|---|---|
| `alttp-light-world.png` | https://ian-albert.com/games/legend_of_zelda_a_link_to_the_past_maps/light_world-1.png |
| `zelda-nes-overworld.png` | https://ian-albert.com/games/legend_of_zelda_maps/overworld.png |
| `smw-yoshi-island-1.png` | https://ian-albert.com/games/super_mario_world_maps/yoshi_island_1.png |
| `super-metroid-brinstar.png` | https://ian-albert.com/games/super_metroid_maps/brinstar.png |

## Licences
Toutes les images proviennent de **ian-albert.com** — licence explicitement libre :
> "You're free to do whatever you like with these images."

## Ajouter une carte
1. Placer le fichier `.png` dans ce dossier
2. Dans `data/entries.json`, ajouter dans l'entrée du jeu :
   ```json
   "top_visual": { "3": "maps/nom-du-fichier.png" }
   ```
3. Régénérer `data/entries.js` :
   ```bash
   python3 -c "
   import json, pathlib
   E = json.load(open('data/entries.json'))
   pathlib.Path('data/entries.js').write_text(
     'window.ENTRIES_DATA = ' + json.dumps(E, ensure_ascii=False, indent=2) + ';')
   print('✓ entries.js régénéré')
   "
   ```
