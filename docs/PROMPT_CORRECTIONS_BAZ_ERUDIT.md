# PROMPT : Corrections LOT-BAZ — Vision finale

## Contexte
Les 8 lots BAZ/Erudit ont ete livres (commit 7f9021d) mais ne correspondent pas a la vision finale. Ce prompt corrige et complete l'implementation. Lire le plan complet : `/root/.claude/plans/memoized-marinating-canyon.md`

**Mode : BUILD | Modele : Sonnet | Branche : main**

## Fichiers existants a modifier

### 1. `backend/public/js/codec.js`
**Supprimer tout auto-trigger.** Le codec ne doit JAMAIS s'ouvrir tout seul.
- Supprimer la fonction `autoTrigger()` et son `setTimeout(autoTrigger, 500)`
- Le codec s'ouvre UNIQUEMENT quand l'utilisateur :
  - Tape une question dans une barre de recherche (detection auto)
  - Presse la touche `C` (raccourci non documente)
  - Clique sur le micro-sprite (voir point 3)

**Ajouter le support de fermeture brutale :**
- Nouvelle fonction `slamClose()` : fermeture en 150ms (au lieu de 300ms), pas d'animation douce, son sec si possible
- Exposer dans `window.BAZ` : `{ say, close, slamClose, input, setCharacter, resetCharacter }`

### 2. `backend/public/js/erudit-engine.js` — REFONTE MAJEURE

**Supprimer l'auto-trigger au chargement.** "..." ne parle pas en premier.

**Ajouter la jauge de patience :**
```js
var _patience = 15 // Reset a chaque session
var PATIENCE_COST = {
  precise: -1,     // question precise (qualification, prix, jeu specifique)
  vague: -3,       // question vague (salut, ca va, quoi de neuf sans contexte)
  repeat: -5,      // question repetee
  name_ask: -5,    // redemander son nom
  unknown: -3,     // intent non compris
  good_action: +2  // qualification sauvegardee
}
```

Quand `_patience <= 0` :
1. Afficher une hang-up line aleatoire :
   - "J'ai mieux a faire."
   - "Cette conversation est terminee."
   - "..." (3s silence puis fermeture)
   - "Revenez quand vous aurez une vraie question."
   - (rien du tout — fermeture sans un mot)
2. Appeler `window.BAZ.slamClose()` (fermeture 150ms)
3. Activer un cooldown de 30-60s (random) : stocker `_cooldownUntil = Date.now() + cooldown`
4. Pendant le cooldown, toute tentative d'invocation est ignoree silencieusement
5. Le micro-sprite disparait pendant le cooldown
6. `_patience` reset a 15 apres le cooldown

**Ajouter la memoire localStorage :**
```js
var MEMORY_KEY = 'rdx-erudit-memory'
// Structure :
{
  interactions: [{user, erudit, intent, ts}],  // 20 derniers
  collectionSnapshot: { count, value, qualified, lastChange },
  firstVisit: "2026-04-10T...",
  visitCount: 12,
  lastVisit: "2026-04-10T..."
}
```
- Au chargement de collection.html : incrementer `visitCount`, updater `lastVisit`
- Comparer `collectionSnapshot` actuel vs stocke pour detecter les changements
- Utiliser la memoire dans les reponses :
  - "Douzieme visite. Vous commencez a meriter mon attention."
  - "Trois jeux de plus depuis votre derniere visite. Sans qualification. Previsible."
  - "La derniere fois, X jeux. Maintenant Y. Z sans confiance."

**Ajouter les intents strategiques :**
- `daily_plan` : keywords ["on fait quoi", "aujourd'hui", "quoi faire", "par ou", "commencer", "priorite"]
  → Fetch cockpit signals, analyser, repondre : "X corrections. Y qualifications. Commencez par les corrections. Si vous en etes capable."
- `whats_new` : keywords ["quoi de neuf", "nouvelles", "news", "change", "evolue"]
  → Comparer collectionSnapshot vs actuel, repondre sur les deltas
- `opinion` : keywords ["tu penses quoi", "ton avis", "qu'est-ce que tu en penses", "verdict"]
  → Analyser la collection globalement, donner un avis acide

**Contexte complet :** Fetch AUSSI `/api/games?limit=5` (top games) et `/api/collection/stats` en plus de `/api/baz/context/collection` pour avoir une vue complete.

**Sarcasme renforce dans le corpus** (`erudit-corpus.json`) — ajouter ces categories :
```json
{
  "agitated": [
    "Vous posez la question comme si la reponse allait changer votre vie.",
    "On a deja couvert ca. Ma memoire fonctionne. La votre, apparemment non.",
    "Je ne suis pas un moteur de recherche. Quoique. Meme un moteur de recherche meriterait mieux."
  ],
  "hangup": [
    "J'ai mieux a faire.",
    "Cette conversation est terminee.",
    "...",
    "Revenez quand vous aurez une vraie question.",
    ""
  ],
  "grudging_respect": [
    "... Acceptable.",
    "Hmm. Vous progressez. Ne laissez pas ca vous monter a la tete.",
    "Fort bien. Je n'ai rien a redire. Ca ne m'arrive pas souvent."
  ],
  "daily_plan": [
    "Voyons. X corrections, Y qualifications, Z a vendre. Commencez par les corrections. Si vous en etes capable.",
    "Votre etagere a besoin d'attention. X entrees sans confiance. Le reste peut attendre.",
    "Rien d'urgent. Votre collection est... stable. Ne vous reposez pas pour autant."
  ],
  "whats_new": [
    "X jeux de plus depuis votre derniere visite. Y sans qualification. Previsible.",
    "Votre valeur a bouge de Z depuis la derniere fois. Le marche ne dort pas. Vous, apparemment, si.",
    "Rien n'a change. Votre inactivite est remarquable."
  ],
  "opinion": [
    "Votre collection est... fonctionnelle. C'est le mieux que je puisse dire.",
    "X jeux, Y qualifies, Z a corriger. Mediocre mais pas desespere.",
    "Hmm. J'ai vu pire. J'ai aussi vu mieux. Beaucoup mieux."
  ]
}
```

### 3. Decouverte mystere — NOUVEAU

**Placeholder dynamique sur les barres de recherche :**
- Fichier : `backend/public/js/glossary.js` ou nouveau `backend/public/js/search-hint.js`
- Sur hub/games-list/game-detail : apres 30s d'inactivite, le placeholder change 1x/session :
  `"Rechercher un jeu..."` → `"Rechercher... ou poser une question"` (revient apres 5s)
- Sur collection : `"Filtrer par titre, note, variante"` → `"Filtrer... ou demander conseil"` (revient apres 5s)
- Stocker dans sessionStorage pour ne le faire qu'une fois

**Micro-sprite :**
- Un IMG 16x16 du sprite BAZ (ou "..." sur collection) insere en position absolute dans le coin droit de la barre de recherche
- Apparait avec un bref clignotement (300ms opacity pulse) une seule fois par session
- Click dessus = ouvre le codec directement (premiere rencontre si jamais invoque avant)
- Pendant le cooldown de "..." : le sprite disparait

### 4. Premiere rencontre scriptee — NOUVEAU

Ajouter dans `codec.js` (ou `baz-engine.js` / `erudit-engine.js`) :

**BAZ (premiere invocation JAMAIS, localStorage `rdx-baz-met` absent) :**
```
Message 1 (apres 1.5s idle) : "Hmm. Tu m'as trouve."
Message 2 (apres pause 1.5s) : "Je suis BAZ. Je vis dans le catalogue. Terme obscur, prix, fiche — pose ta question ici. Je fais le reste."
```
Puis set `localStorage.rdx-baz-met = 1`. Plus jamais rejoue.

**"..." (premiere invocation JAMAIS, localStorage `rdx-erudit-met` absent) :**
```
Message 1 (silence 3s, label "..." pulse) : "..."
Message 2 (apres pause 2s) : "On m'a derange. Je veille sur les etageres. Si votre collection merite mon attention, posez votre question. Sinon, partez."
```
Puis set `localStorage.rdx-erudit-met = 1`. Plus jamais rejoue.

### 5. Detection automatique dans les barres de recherche

**Intercepter l'input des barres de recherche existantes.**
Fichier : nouveau `backend/public/js/search-detect.js` ou integre dans `glossary.js`

Logique :
1. Ecouter `keydown` (Enter) sur les barres de recherche (selectors a trouver dans chaque page)
2. Classifier l'input :
   - Contient `?` ou mots-cles conversationnels (quoi, comment, pourquoi, qu'est-ce, aide, pense, nouvelle, aujourd'hui, explique, c'est quoi, qui est) → **conversation**
   - Matche un titre de jeu (fuzzy vs catalogue) → **recherche normale**
   - Ambigu → **recherche normale** (default safe)
3. Si conversation : `event.preventDefault()`, ouvrir le codec, envoyer le texte a `window.BAZ._askEngine(text)`
4. L'input de la barre de recherche est vide apres envoi au codec

### 6. `backend/public/js/baz-engine.js`

**Ajouter anti-repetition renforcee pour le lore :**
- Stocker les fragments lore dits dans `sessionStorage.rdx-lore-said`
- Un fragment lore dit une fois n'est jamais repete dans la session
- Si tous les fragments sont epuises : "J'ai deja dit ce que j'avais a dire."

## Fichiers a creer

| Fichier | Contenu |
|---|---|
| `backend/public/js/search-detect.js` | Detection question vs recherche + dispatch vers codec |

## Fichiers a modifier

| Fichier | Changements |
|---|---|
| `backend/public/js/codec.js` | Supprimer autoTrigger, ajouter slamClose, premiere rencontre |
| `backend/public/js/erudit-engine.js` | Jauge patience, memoire, intents strategiques, supprimer auto-trigger |
| `backend/public/assets/erudit/erudit-corpus.json` | Ajouter agitated, hangup, grudging_respect, daily_plan, whats_new, opinion |
| `backend/public/js/baz-engine.js` | Anti-repetition lore renforcee |
| `backend/public/js/glossary.js` | Placeholder dynamique + micro-sprite |
| Les 16 HTML | Ajouter `<script src="/js/search-detect.js" defer>` |

## Verification

1. Ouvrir hub.html → aucun codec visible. Attendre 30s → placeholder change brievement. Taper "c'est quoi CIB?" dans la recherche → codec s'ouvre avec BAZ.
2. Premiere fois → intro scriptee BAZ joue. Deuxieme fois → pas d'intro.
3. Ouvrir collection.html → aucun codec. Taper une question dans le filtre → codec amber s'ouvre avec "...".
4. Premiere fois → intro "..." avec silence 3s.
5. Poser 5-6 questions vagues d'affilee → "..." raccroche brutalement (codec claque).
6. Essayer de reinvoquer → rien pendant 30-60s.
7. Taper "on fait quoi aujourd'hui?" → "..." analyse le cockpit et repond.
8. Revenir le lendemain → "..." se souvient du nombre de visites.
9. Hover "CIB" → tooltip. Click → BAZ explique.
10. Taper "qui d'autre" dans le codec BAZ → fragment lore (une seule fois).
