# GUIDE OPERATEUR — RetroDex

Comment piloter RetroDex avec Claude Code sans formuler les prompts soi-meme.

---

## Workflow en 5 etapes

1. **Ouvrir 2 fenetres** : Claude Code CLI (terminal) + navigateur sur le site live.
2. **Demander ici** : decrire ce que tu vois, ce qui ne va pas, ce que tu veux. En langage naturel.
3. **Copier le bloc** : Claude genere un bloc `/plan-lot` ou `/execute-lot` pret a coller.
4. **Attendre le recap** : Claude execute, teste, commit, push, et donne le recap.
5. **Coller le recap** : si tu as besoin de continuer, colle le recap de la session precedente.

---

## Commandes rapides

| Commande | Ce que ca fait |
|---|---|
| `/session-start` | Initialise la session : detecte le mode, le modele, le lot actif. |
| `status` | Affiche l'etat du projet : derniers commits, lot en cours, prochaine action. |
| `audit UX` | Lance l'expert INTERFACE sur les pages demandees. |
| `audit produit` | Lance l'expert COLLECTIONNEUR sur le cockpit et les signaux. |
| `audit technique` | Lance l'expert ARCHITECTE sur le CSS / la structure. |
| `audit complet` | Lance les 4 experts en parallele (INTERFACE + PIXEL + TERMINAL + ARCHITECTE). |
| `on fait quoi` | Propose la prochaine action basee sur le plan actif. |
| `go` | Execute le lot planifie. |
| `recap` | Resume ce qui a ete fait dans la session. |

---

## Routage modele

| Situation | Modele |
|---|---|
| Code, iteration, lots simples | **Sonnet** |
| Audit profond, architecture, cascade CSS | **Opus** |
| Plan multi-fichiers complexe | **Opusplan** (Opus planifie, Sonnet execute) |

Declarer le modele en debut de session avec `/session-start`.

---

## Routage outils externes

| Besoin | Outil |
|---|---|
| Sprites, pixel art, covers | **ChatGPT (DALL-E)** — valider avant integration |
| Lots repetitifs, bulk edits | **Codex** |
| Tout le reste | **Claude Code CLI** |

---

## Fichiers systeme

| Fichier | Role |
|---|---|
| `CLAUDE.md` | Instructions operateur + etat du projet. Lu automatiquement par Claude. |
| `EXPERTS.md` | 8 personas d'experts avec domaine, ton, format de sortie. |
| `GUIDE_OPERATEUR.md` | Ce fichier. Workflow et commandes. |
| `SUPABASE_AUDIT.md` | Audit des 33 tables Supabase avec schema et flags. |

---

## Regle d'or

> **Tu ne formules jamais le prompt toi-meme.**
>
> Tu decris ce que tu vois, ce qui ne va pas, ce que tu veux.
> Claude genere le prompt, le lot, le plan, et execute.
> Toi tu valides, tu refuses, ou tu ajustes.
