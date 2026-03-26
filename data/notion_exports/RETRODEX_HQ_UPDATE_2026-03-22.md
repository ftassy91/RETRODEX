# RETRODEX - HQ - Mise a jour globale - 2026-03-22

## 1. Resume executif

RetroDex a franchi une etape de stabilisation utile sur le prototype local `prototype_v0`.

Points saillants:
- la collection locale a ete rationalisee autour d'une source de verite unique
- la logique metier la plus recente a ete sortie de `index.html`
- la presentation marche a ete centralisee pour eviter les divergences de wording
- les fallbacks assets ont ete nettoyes pour supprimer les `404` visibles sur les parcours testes
- le pipeline visuel a ete reset en version V2 pour sortir des rendus abstraits et decoratifs

Etat global:
- produit: plus lisible et plus coherent
- architecture: meilleure separation entre stockage local, wiring UI et presentation marche
- visuel: pipeline de generation plus exploitable, mais validation humaine toujours requise
- Notion: integration directe toujours non connectee dans ce workspace

---

## 2. Etat reel du prototype

Workspace observe:
- `C:\\Users\\ftass\\OneDrive\\Bureau\\RETRODEXseed\\RETRODEXseedV0\\prototype_v0`

Nature du workspace:
- prototype frontend local
- pas de backend actif dans ce workspace
- donnees lues depuis des fichiers JSON locaux
- collection persistee localement dans le navigateur

Point d'entree principal:
- `index.html`

Modules visibles:
- ecran principal RetroDex / GameDetail
- module RetroMarket
- pipeline visuel autonome pour illustrations safe
- scripts de sync/export locaux

Limite importante:
- la collection reste locale a ce prototype
- la sync Notion n'est pas active

---

## 3. Livraisons recentes confirmees

### 3.1 Rationalisation collection / UI

Corrige:
- source de verite collection centralisee dans `js/collection-store.js`
- wiring DOM collection sorti vers `js/collection-panel.js`
- persistance utilisateur conservee via la cle existante `retrodex_owned_v1`
- export CSV collection expose dans l'UI

Impact:
- moins de logique inline dans `index.html`
- moins de divergence entre etat visuel et etat persiste
- comportement collection conserve

### 3.2 Rationalisation data marche

Corrige:
- presentation marche centralisee dans `modules/retromarket/market_presenter.js`
- wording coverage / source aligne entre la fiche principale et RetroMarket

Impact:
- meilleure coherence produit
- moins de divergence entre vues
- meilleure lisibilite de la provenance marche

### 3.3 Fallbacks assets

Corrige:
- suppression des probes automatiques vers des dossiers absents:
  - `assets/boxart/`
  - `assets/titlescreens/`
  - `assets/artwork/`
  - `assets/screenshots/`
- fallback conserve vers:
  - chemins explicites si presents
  - `assets/generated_gb/`
  - `assets/placeholders/default.png`

Impact:
- plus de `404` bruyants sur les parcours verifies
- plus d'images cassees visibles dans les ecrans testes

### 3.4 Onboarding technique

Document pret:
- `STACK TECHNIQUE - Onboarding developpeur - RetroDex`

Fichier source local:
- `STACK_TECHNIQUE_ONBOARDING_RETRODEX.md`

Usage:
- reference d'onboarding pour un nouveau developpeur
- base importable manuellement dans Notion

---

## 4. Visual system reset V2

### 4.1 Probleme corrige

Le premier pipeline visuel produisait des sorties trop abstraites, decoratives et trop peu rattachees au jeu.

Ce n'etait pas acceptable pour un hero visuel de fiche jeu.

### 4.2 Nouvelle regle systeme

Le pipeline V2 impose:
- un objet central lisible
- un contexte visible
- un signal de genre immediat
- une signature plateforme
- une composition plus sobre et plus lisible

Classes autorisees:
- `object`
- `environment`

Classes retirees de la logique active:
- `hero`
- `abstract`

### 4.3 Changements techniques appliques

Scripts modifies:
- `scripts/retrodex_visual_pipeline.py`
- `scripts/retrodex_visual_renderer.py`

Changements principaux:
- generateur de prompts reconstruit en logique `object + context + genre signal`
- downgrade automatique sans abstraction decorative
- renderer recentre sur un gros sujet lisible
- sorties de rendu versionnees par `run_id` pour eviter l'ecrasement inter-run

### 4.4 Batch V2 execute

Run final:
- `visual_batch_20260322T154329Z`

Perimetre:
- batch de `10` jeux seulement
- meme famille d'items que dans le batch precedent pour comparaison directe

Resultat automatique:
- `10/10` rendus generes
- `0` image flaggee
- `100.0` QA moyenne automate

Attention:
- cette QA reste technique
- elle ne remplace pas une validation humaine de lisibilite, adequation au jeu et risque perceptuel

### 4.5 Artefacts a importer ou consulter

Rapport de comparaison:
- `assets/retrodex/logs/visual_batch_20260322T154329Z/comparison_report.md`

Contact sheet V2:
- `assets/retrodex/logs/visual_batch_20260322T154329Z/validation_contact_sheet_batch_001.png`

Comparaison avant/apres:
- `assets/retrodex/logs/visual_batch_20260322T154329Z/comparison_contact_sheet.png`

Validation package:
- `assets/retrodex/logs/visual_batch_20260322T154329Z/validation_package.json`

Checkpoints:
- `assets/retrodex/logs/visual_batch_20260322T154329Z/checkpoint_01_normalized_games.json`
- `assets/retrodex/logs/visual_batch_20260322T154329Z/checkpoint_02_classification.json`
- `assets/retrodex/logs/visual_batch_20260322T154329Z/checkpoint_03_prompts.json`
- `assets/retrodex/logs/visual_batch_20260322T154329Z/checkpoint_04_render_queue.json`
- `assets/retrodex/logs/visual_batch_20260322T154329Z/checkpoint_05_tracking.csv`

---

## 5. Fichiers modifies dans cette phase recente

Frontend / prototype:
- `index.html`
- `js/collection-store.js`
- `js/collection-panel.js`
- `js/top-screen-loader.js`
- `modules/retromarket/market_presenter.js`
- `modules/retromarket/market_ui.js`
- `modules/retromarket/market.html`

Visual pipeline:
- `scripts/retrodex_visual_pipeline.py`
- `scripts/retrodex_visual_renderer.py`

Docs / export:
- `STACK_TECHNIQUE_ONBOARDING_RETRODEX.md`
- `data/notion_exports/stack_technique_onboarding_retrodex_payload.json`

---

## 6. Ce qui est maintenant plus propre

- une seule source de verite collection cote prototype
- moins de logique metier inline dans `index.html`
- presentation marche plus coherente
- moins d'erreurs assets visibles
- pipeline visuel plus directif et moins decoratif
- rendus versionnes par run

---

## 7. Ce qui reste limite ou a verifier

### Confirme

- le workspace actuel n'a pas de backend collection actif
- la sync Notion n'est pas configuree
- certains assets historiques sont absents du depot

### A verifier manuellement

- qualite percue des rendus V2 en hero visuel sur de vraies fiches
- niveau de reconnaissance "jeu evoque" sur les 10 sorties
- risque perceptuel sur les franchises les plus iconiques
- adequation mobile / overlay UI des rendus finaux

### Toujours en dette

- `index.html` reste un gros point d'entree
- il reste du legacy inert volontairement laisse en place
- la structure prototype n'est pas encore alignee sur une app modulaire de production

---

## 8. Priorites recommandees apres import HQ

### Priorite 1

Faire une revue humaine du batch visuel V2:
- valider
- rejeter
- ou ajuster les prompts par famille

### Priorite 2

Introduire un manifest d'assets approuves:
- mapping `game_id -> hero_visual_path`
- statut `approved / retry / rejected`

### Priorite 3

Continuer la sortie de logique hors de `index.html`:
- sans refonte globale
- par extraction sure de blocs deja stabilises

### Priorite 4

Reconnecter Notion proprement:
- pour remettre la sync projet dans le flux normal
- et rattacher les docs d'onboarding / pipeline visuel a HQ

---

## 9. Bloc a coller dans HQ si besoin

### Mise a jour projet - 2026-03-22

- Collection prototype rationalisee autour d'un store local unique
- Wiring DOM sorti de `index.html`
- Presentation marche centralisee
- Fallbacks assets nettoyes
- Onboarding technique pret a l'import
- Pipeline visuel reset en V2 avec logique objet central + contexte + signal de genre
- Batch V2 de 10 jeux execute, package de comparaison disponible

---

## 10. Pieces jointes recommandees dans Notion

Pages / docs:
- `STACK_TECHNIQUE_ONBOARDING_RETRODEX.md`
- `RETRODEX_HQ_UPDATE_2026-03-22.md`

Artefacts visuels:
- `assets/retrodex/logs/visual_batch_20260322T154329Z/comparison_report.md`
- `assets/retrodex/logs/visual_batch_20260322T154329Z/validation_contact_sheet_batch_001.png`
- `assets/retrodex/logs/visual_batch_20260322T154329Z/comparison_contact_sheet.png`

---

## 11. Resume ultra-court

RetroDex est plus propre structurellement, plus stable sur son prototype local, et le pipeline visuel a enfin une direction exploitable.

Le prochain goulet n'est plus la plomberie frontend immediate.
Le prochain goulet est la validation humaine des visuels et la re-connexion du systeme de pilotage Notion.
