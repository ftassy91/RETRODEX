# Guide d'implementation manuelle - Mise a jour RETRODEX HQ - 2026-03-22

## But

Mettre a jour manuellement:
- la page principale `RETRODEX - HQ`
- la page active de travail

en utilisant les fichiers Markdown prepares localement.

---

## 1. Fichiers a utiliser

### Page principale HQ

Importer ou copier:
- `data/notion_exports/RETRODEX_HQ_MAIN_PAGE_UPDATE_2026-03-22.md`

### Page active

Importer ou copier:
- `data/notion_exports/RETRODEX_HQ_ACTIVE_PAGE_UPDATE_2026-03-22.md`

### Synthese globale annexe

Conserver en reference:
- `data/notion_exports/RETRODEX_HQ_UPDATE_2026-03-22.md`

### Documentation technique

Lier ou importer:
- `STACK_TECHNIQUE_ONBOARDING_RETRODEX.md`

### Artefacts visuels a joindre si utile

- `assets/retrodex/logs/visual_batch_20260322T154329Z/comparison_report.md`
- `assets/retrodex/logs/visual_batch_20260322T154329Z/validation_contact_sheet_batch_001.png`
- `assets/retrodex/logs/visual_batch_20260322T154329Z/comparison_contact_sheet.png`

---

## 2. Marche a suivre recommandee dans Notion

### Etape A - Sauvegarder l'etat actuel

Avant de modifier HQ:
- dupliquer la page principale `RETRODEX - HQ`
- dupliquer la page active

But:
- garder un point de retour simple

### Etape B - Mettre a jour la page principale HQ

1. Ouvrir `RETRODEX - HQ`
2. Ne pas supprimer la structure existante
3. Ajouter ou mettre a jour une section visible type:
   - `Etat actuel`
   - `Mise a jour 2026-03-22`
4. Copier le contenu utile depuis:
   - `RETRODEX_HQ_MAIN_PAGE_UPDATE_2026-03-22.md`
5. Ajouter des liens visibles vers:
   - l'onboarding technique
   - la synthese globale HQ
   - le rapport visuel V2

### Etape C - Mettre a jour la page active

1. Ouvrir la page active de pilotage
2. Remplacer le bloc de statut si necessaire
3. Inserer le contenu depuis:
   - `RETRODEX_HQ_ACTIVE_PAGE_UPDATE_2026-03-22.md`
4. Verifier que les sections suivantes sont presentes:
   - etat courant
   - livrables recents
   - risques ouverts
   - prochaines etapes
   - checklist active

### Etape D - Joindre les artefacts

Si tu veux un pilotage plus complet:
- joindre `comparison_report.md`
- joindre `comparison_contact_sheet.png`
- joindre `validation_contact_sheet_batch_001.png`

Tu peux:
- soit les uploader dans Notion
- soit creer une sous-page `Visual Reset V2`

### Etape E - Ajouter les liens croises

Depuis la page principale HQ, ajouter:
- un lien vers la page active
- un lien vers l'onboarding technique
- un lien vers la page / sous-page du visual reset V2

Depuis la page active, ajouter:
- un lien retour vers `RETRODEX - HQ`
- un lien vers la synthese globale HQ

---

## 3. Ordre concret recommande

1. Importer / copier `RETRODEX_HQ_UPDATE_2026-03-22.md` en page annexe ou page de reference
2. Mettre a jour la page principale avec `RETRODEX_HQ_MAIN_PAGE_UPDATE_2026-03-22.md`
3. Mettre a jour la page active avec `RETRODEX_HQ_ACTIVE_PAGE_UPDATE_2026-03-22.md`
4. Ajouter le document d'onboarding technique
5. Ajouter les artefacts visuels du reset V2
6. Verifier les liens croises

---

## 4. Ce qu'il ne faut pas faire

- ne pas remplacer toute la page HQ par un gros bloc unique
- ne pas supprimer l'historique ou les sections encore utiles
- ne pas presenter le prototype local comme une stack de production
- ne pas presenter le batch visuel V2 comme "valide" sans revue humaine
- ne pas cacher que Notion n'est pas connecte dans ce workspace

---

## 5. Checklist finale d'implementation

- [ ] page principale HQ mise a jour
- [ ] page active mise a jour
- [ ] liens visibles ajoutes
- [ ] onboarding technique rattache
- [ ] artefacts visuels attaches
- [ ] resume projet coherent
- [ ] risques ouverts toujours visibles

---

## 6. Resultat attendu

Apres mise a jour manuelle, un lecteur doit comprendre en moins de 5 minutes:
- ou en est RetroDex
- ce qui a ete reellement livre
- ce qui reste limite
- quelle est la prochaine priorite
- ou trouver la doc technique et les preuves de la passe visuelle V2
