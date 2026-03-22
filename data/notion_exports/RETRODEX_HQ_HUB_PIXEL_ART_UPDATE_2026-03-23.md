# RETRODEX HQ — Hub Pixel Art Rollout — 2026-03-23

## Résumé

Les 40 titres affichés dans le hub utilisent maintenant un lot dédié d'illustrations pixel art générées puis intégrées directement dans le flux local du top screen.

Objectif atteint :
- générer un visuel par titre du hub
- brancher ces visuels sans toucher au système principal de covers
- garder une intégration locale simple et prioritaire dans l'UI

## Périmètre livré

### 1. Génération d'images hub

- Source des titres : `data/demo_subset.json`
- Volume : `40` titres
- Prompt packs : `prompt_pack_batch_20260322T231453Z`
- Batch images : `dalle3_20260322T231504Z`

### 2. Intégration frontend

Nouveau root local :
- `assets/hub_pixel_art/`

Intégration :
- `js/top-screen-loader.js`
  - priorité donnée à `assets/hub_pixel_art/`
  - fallback existant conservé sur `assets/generated_gb/`
- `index.html`
  - bump de version du loader pour forcer le refresh client

### 3. Traçabilité

- manifeste local : `assets/hub_pixel_art/_manifest.json`
- sync locale enregistrée : `logs/checkpoints/20260322T233150Z_checkpoint.json`
- audit local : `logs/latest_audit.json`

## Fichiers principaux modifiés

- `index.html`
- `js/top-screen-loader.js`
- `scripts/retrodex_prompt_pack_pipeline.py`
- `scripts/retrodex_dalle3_batch.py`
- `data/retrodex_franchise_memory_rules.json`
- `data/retrodex_franchise_memory_rules.md`
- `assets/hub_pixel_art/*`

## Impact produit

- Le hub n'utilise plus uniquement les anciens visuels générés Game Boy pour ces 40 titres.
- Le top screen peut maintenant afficher un lot dédié plus cohérent avec la direction pixel art actuelle.
- L'intégration reste locale et isolée : aucun refactor global du pipeline covers n'a été fait.

## Limites connues

- La qualité reste dépendante du rendu batch par titre. Certains visuels restent susceptibles d'être remplacés après revue.
- La synchronisation Notion distante n'a pas été exécutée : la config locale est toujours désactivée (`scripts/retrodex_sync_config.example.json` -> `enabled: false`).
- Le dépôt git local n'a pas de remote configuré. Un commit local est possible, pas un push distant sans configuration supplémentaire.

## Recommandation HQ

Ajouter cette mise à jour dans :
- la page active RetroDex HQ
- ou une sous-section `Visual System / Hub Pixel Art`

Bloc court recommandé pour HQ :

> Hub pixel art rollout terminé pour les 40 titres showcase. Nouveau root local `assets/hub_pixel_art/`, loader prioritaire branché, batch source `dalle3_20260322T231504Z`. Sync Notion distante encore bloquée par la config locale.
