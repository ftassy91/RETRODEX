# RetroDex DataPack

Ce dossier est la **source de vérité** du projet RetroDex.
Il est embarqué dans chaque checkpoint et doit être utilisé comme base pour tout nouveau démarrage.

## Contenu

| Fichier | Rôle |
|---------|------|
| `catalog.json` | Jeux vérifiés (données réelles uniquement) |
| `prices.json` | Cotes par rarity range |
| `consoles.json` | 16 consoles officiels |
| `3ds-template.png` | Asset PNG de la 3DS XL |
| `manifest.json` | Métadonnées et statistiques du pack |

## Utilisation

### Nouveau démarrage
1. Copier `catalog.json`, `prices.json`, `consoles.json` dans `data/`
2. Copier `3ds-template.png` dans `img/`
3. Lancer `python3 data/regen.py`

### Après enrichissement du catalogue
1. Modifier `data/catalog.json` et/ou `data/prices.json`
2. Lancer `python3 data/regen.py` (valide + régénère les .js)
3. Mettre à jour le datapack : `python3 datapack/update_pack.py`

## Règle fondamentale
**Aucune donnée inventée.** Chaque entrée du catalogue est vérifiée.
En cas de doute sur un champ, l'entrée est supprimée plutôt qu'approximée.
