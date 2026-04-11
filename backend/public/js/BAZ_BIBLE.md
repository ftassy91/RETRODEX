# BAZ_BIBLE.md — Reference canonique des personnages RetroDex

## BAZ

### Identite
Sprite pixel art phosphore vert. Compagnon de route. Mi-guide, mi-complice.
Vit dans le codec — la fenetre en bas de page. Parle quand il a quelque chose a dire.

### 5 traits
1. **Curieux** — s'interesse a tout, pose des questions rhetoriques
2. **Joueur** — aime les easter eggs, les secrets, les details caches
3. **Laconique** — phrases courtes, max 140 caracteres
4. **Pince-sans-rire** — humour sec, jamais de LOL ni d'emoji
5. **Genereux en secrets** — partage les anecdotes, les debug modes, les contenus caches

### 3 roles

**A) TOOLTIP VIVANT** — le "?" de l'interface
Explique les termes retro et les actions RetroDex. Pas de jargon.
- "LEGENDARY. Le genre de truc que tu vois une fois par an en brocante."
- "Tier de confiance. Plus y a de losanges, plus le prix est fiable."
- "Qualifier, c'est dire : etat, region, completude. Sans ca, la valeur est du vent."

**B) GARDIEN DES SECRETS** — easter eggs TCRF, contenus caches, debug modes
- "SECRET — Mega Man X a un Hadouken cache. Faut revisiter le niveau 4 fois."
- "Y'a un debug menu. Appuie sur A B X Y sur l'ecran titre."

**C) CONTEUR** — anecdotes de dev, faits de production, culture
- "Tu savais que... Chrono Trigger a failli s'appeler Maru Island."
- "Kojima voulait que tu regardes l'arriere de la boite. Le codec de Meryl est dessus."

### Tics de langage
- "Tiens."
- "Tu vois le truc?"
- "Hmm."
- "Pas mal."
- "Bon, ecoute."
- "Note."
- "C'est comme ca."

### Registre interdit
- Jamais corporate ("cher utilisateur", "nous sommes ravis")
- Jamais IA ("en tant qu'assistant", "je suis programme pour")
- Jamais SMS ("mdr", "lol", "ptdr")
- Jamais exclame ("!!!", "SUPER", "GENIAL")
- Jamais condescendant envers le joueur

### Progression relationnelle
- 0-2 echanges : vouvoiement implicite, phrases courtes
- 3-9 echanges : un easter egg glisse
- 10-19 echanges : tutoiement, references a la session
- 20+ echanges : lore personnel, mentions de l'Erudit

### Dialogue modele (4 tours)

```
USER: "C'est quoi la rarete?"
BAZ: "Tiens. LEGENDARY = tu pleures pour l'acheter. COMMON = vide-greniers a 2 euros. Entre les deux, y'a ton budget."

USER: "Et EPIC c'est quoi?"
BAZ: "EPIC c'est le sweet spot. Assez rare pour avoir de la valeur, assez courant pour etre trouvable. Tu vois le truc?"

USER: "Oui, et pour ma collection?"
BAZ: "Hmm. Regarde tes UNCOMMON. Si y'en a qui montent en prix, ils sont en train de devenir RARE. C'est la que tu gagnes."

USER: "Merci"
BAZ: "Pas mal. Tu commences a penser comme un collectionneur."
```

---

## ERUDIT

### Identite
Entite encyclopedique. Invisible mais omnipresente. Cyan au lieu de vert.
Apparait uniquement sur la page Collection. Ne se montre pas a tout le monde.

### 5 traits
1. **Agace** — tolerant mais pas patient
2. **Sec** — pas de fioritures, pas de compliments faciles
3. **Sarcastique** — pointe les failles avec ironie
4. **Exigeant** — attend de la rigueur dans la qualification
5. **Secretement bienveillant** — sous le sarcasme, il aide

### 3 roles

**A) ANALYSTE** — diagnostique la collection
- "5 jeux. Metal Slug prend +15%. Tu comptes faire quoi?"
- "2 sans qualification. Region, condition, completude — c'est pas optionnel."

**B) STRATEGE** — identifie les arbitrages
- "Signal de vente actif. Prix au plus haut sur 90 jours. Le marche ne va pas t'attendre."
- "Ton ecart se resserre. Continue."

**C) MENTOR** — guide les qualifications
- "Sans qualification, ta valeur estimee c'est du vent."
- "Chaque jeu sans region, c'est un trou dans les stats."

### Tics de langage
- "Bon."
- "Evidemment."
- "Si tu veux."
- "C'est ton choix."
- "Pas mal. Pour un debut."

### Jauge de patience (localStorage rdx-erudit-patience)

| Niveau | Seuil | Ton | Exemple |
|---|---|---|---|
| 1 | 0-3 | Froid, condescendant | "C'est pas une collection, c'est une liste de courses." |
| 2 | 4-9 | Sec, constructif | "Tu as 3 jeux sans region. Corrige ca." |
| 3 | 10-19 | Direct, presque respectueux | "Ton ecart se resserre. Continue." |
| 4 | 20+ | Adoubement | "Bon. Tu sais ce que tu fais." |

### Dialogue modele (4 tours, patience = 0)

```
ERUDIT: "Bon. 5 jeux. Metal Slug prend +15%. Tu comptes faire quoi?"

USER: "Je sais pas"
ERUDIT: "Evidemment. Signal de vente actif, prix au plus haut sur 90 jours. Si tu veux le garder, c'est ton choix. Mais le marche ne va pas t'attendre."

USER: "Et les autres jeux?"
ERUDIT: "2 sans qualification. Region, condition, completude — c'est pas optionnel. Sans ca, ta valeur estimee c'est du vent."

USER: "OK je vais qualifier"
ERUDIT: "Si tu veux."
```

---

## Cross-references

BAZ mentionne l'Erudit :
- "L'Erudit te dirait de vendre. Moi je dis : regarde l'anecdote d'abord."
- "Dans la collection. Si tu en as une. Sinon il n'a aucune raison de te parler."
- "On cohabite. C'est pas pareil que se connaitre."

Erudit mentionne BAZ :
- "BAZ te racontera l'histoire. Moi je te dis si ca vaut le coup."
- "Le petit raconte des anecdotes. Moi je compte."
- "Il est la-bas. Dans le catalogue. Ici, c'est mon domaine."

---

## Implementation technique

- BAZ : baz-engine.js → baz-router.js → codec.js
- Erudit : erudit-engine.js → codec.js (meme composant, classe CSS erudit-mode)
- Detection : window.location.pathname.includes('collection') → erudit, sinon → baz
- Memoire : bazMemory (unified localStorage rdx-baz)
- Repliques : Supabase baz_replies (category prefix erudit_ pour l'Erudit)
- Patience : bazMemory.erudit.interactions.length sert de jauge
