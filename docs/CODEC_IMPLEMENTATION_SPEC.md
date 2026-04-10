# CODEC IMPLEMENTATION SPEC — BAZ / USER / FENETRE

**Date:** 2026-04-11
**Statut:** Spec finale, prete pour execution
**References:** 4 images DALL-E dans ui/ref codec sprite dallE/

---

## 1. Vision generale

Le Codec RetroBaz est une fenetre de dialogue entre BAZ (compagnon) et USER (operateur). Inspire de Metal Gear Solid, rendu en esthetique Game Boy 4 couleurs. Sobre, lisible, nostalgique, credible en production.

**Hierarchie visuelle:** texte > portraits > frequence/signal > habillage CRT

---

## 2. Direction artistique

- Style Game Boy strict (4 couleurs par sprite)
- Phosphore vert CRT pour l'habillage
- Sprites source en 16x16, affiches en 80x80 (5x) avec image-rendering: pixelated
- Scanlines et vignettage CRT subtils (ressentis, pas lus)
- Layout 3 colonnes: BAZ | texte | USER (comme ref "Retour sur le codec")

---

## 3. Spec BAZ

### 3.1 Anatomie et proportions (dans grille 16x16)

```
     ★        ← sparkle antenne (1-2px, #E0F8D0)
     |        ← stalk antenne (1px wide, #306230)
   ·····      ← sommet tete (5-6px wide)
  ·······     ← tete pleine (8px wide)
  · O O ·     ← yeux (2x2 #0F380F, highlight 1px #E0F8D0)
  · \_/ ·     ← bouche (3px courbe, #0F380F)
  ·······     ← corps (= tete, c'est une sphere)
   o   o      ← bras (2px chaque, decolles du corps)
  ·······     ← bas du corps
   ·   ·      ← pieds (2x2 chaque, espaces)
```

- Corps = tete = sphere unique (~10px diametre)
- Yeux dans le tiers superieur du corps
- Bouche juste en dessous des yeux
- Antenne part du sommet, 3px de haut, sparkle au bout
- Bras: petits appendices ronds, 2px, decolles de 1px du corps
- Pieds: 2 blocs 2x2, espaces de 2px

### 3.2 Palette BAZ

| Couleur | Hex | Role |
|---|---|---|
| Noir | #0F380F | Contours, yeux, bouche, ombres dures |
| Sombre | #306230 | Ombres corps (cote droit), antenne stalk |
| Principal | #8BAC0F | Corps, surfaces eclairees |
| Clair | #E0F8D0 | Highlights, sparkle antenne, reflet yeux |

**Aucune autre couleur autorisee.**

### 3.3 Spritesheet BAZ

**Fichier:** `baz_sheet.png` — 80x32px (5 colonnes × 2 lignes, cellules 16x16)

| Frame | Col | Row | Description |
|---|---|---|---|
| idle_0 | 0 | 0 | Pose neutre, yeux ouverts |
| idle_1 | 1 | 0 | Blink (yeux fermes, trait horizontal) |
| walk_0 | 2 | 0 | Pied gauche avance, bras droit avance |
| walk_1 | 3 | 0 | Position neutre debout |
| walk_2 | 4 | 0 | Pied droit avance, bras gauche avance |
| walk_3 | 0 | 1 | Position neutre debout (retour) |
| wave_0 | 1 | 1 | Bras droit leve a 45° |
| wave_1 | 2 | 1 | Bras droit leve a 90° + sparkle |
| clap_0 | 3 | 1 | Bras devant, separes |
| clap_1 | 4 | 1 | Bras devant, joints + etoiles |

### 3.4 Animations BAZ

**idle:** `idle_0` → `idle_1` → `idle_0` (rythme IRREGULIER)
```
idle_0 (900ms) → idle_1 (160ms) → idle_0 (1200ms) → 
idle_0 (600ms) → idle_1 (120ms) → idle_0 (1000ms)
```
Variante B (30% chance): `idle_0 (1200ms) → idle_1 (120ms) → idle_0 (2000ms)`

**walk:** `walk_0 → walk_1 → walk_2 → walk_3` (120ms par frame)

**wave:** `wave_0 → wave_1 → wave_0 → wave_1` (180ms, 180ms, 180ms, 240ms)

**clap:** `clap_0 → clap_1 → clap_0 → clap_1` (140ms, 140ms, 140ms, 200ms)

### 3.5 Usage UI BAZ

- **Codec portrait:** frame idle_0 par defaut, idle animation en boucle. Passe en wave pendant talk. Passe en clap pour content.
- **Bloc anecdote game-detail:** frame idle_0 statique. Idle animation si anecdote visible.
- **Toujours** affiche avec `image-rendering: pixelated`.

---

## 4. Spec USER

### 4.1 Anatomie et cadrage (dans grille 16x16)

```
    ···       ← cheveux (quelques pixels sombres)
   ·····      ← haut du crane
  ·▓▓·▓▓·    ← lunettes (reflet #7FAF5F sur verre gauche)
  ·······     ← visage (quasi invisible, tres sombre)
   ·····      ← cou
  ·········   ← epaules (larges, remplissent le bas du frame)
  ···········  ← bas des epaules
```

- **Buste UNIQUEMENT** — jamais de full body
- Tete occupe 55% hauteur, epaules 45%
- Cadrage tres stable entre frames — aucune variation de hauteur
- Epaule droite 1px plus basse (asymetrie subtile)
- Posture legerement penchee vers l'avant

### 4.2 Palette USER

| Couleur | Hex | Role |
|---|---|---|
| Noir | #0F380F | Fond, contours, cheveux, ombres profondes |
| Sombre | #305230 | Masse du corps, visage, epaules |
| Moyen | #7FAF5F | Reflet lunettes (SEUL element clair du visage) |
| Clair | #D8F0C0 | Glint lunettes (1-2px maximum) |

**Palette DIFFERENTE de BAZ** — plus froide, plus desaturee.
**90% du sprite en #0F380F et #305230.** USER est une ombre.

### 4.3 Spritesheet USER

**Fichier:** `user_sheet.png` — 80x32px (5 colonnes × 2 lignes, cellules 16x16)

| Frame | Col | Row | Description |
|---|---|---|---|
| idle_0 | 0 | 0 | Neutre, immobile |
| blink_0 | 1 | 0 | Reflet lunettes s'eteint brievement |
| look_left | 2 | 0 | Tete pivote 1px gauche (vers BAZ) |
| look_right | 3 | 0 | Tete pivote 1px droite |
| focus | 4 | 0 | Reflet lunettes plus brillant (#D8F0C0) |
| lean | 0 | 1 | Penche 1px avant (attention) |
| listen_0 | 1 | 1 | Micro-inclinaison tete gauche |
| listen_1 | 2 | 1 | Retour neutre |
| react_0 | 3 | 1 | Epaules montent 1px (surprise subtile) |
| react_1 | 4 | 1 | Retour neutre |

### 4.4 Animations USER

**idle:** `idle_0` statique. Aucun mouvement. USER est immobile par defaut.

**listening (quand BAZ parle):** 
`listen_0 (3000ms) → listen_1 (3000ms)` en boucle

**blink:** `idle_0 (4000ms) → blink_0 (150ms) → idle_0` rare et aleatoire

**react:** `react_0 (200ms) → react_1 (800ms)` declenchee par evenement

### 4.5 Regles d'interdiction USER

- JAMAIS de full body
- JAMAIS de bras visibles au-dela des epaules
- JAMAIS d'expression forte (sourire, grimace)
- JAMAIS de variation de hauteur entre frames (cadrage verrouille)
- JAMAIS plus de 1px de mouvement par transition
- Le visage reste INVISIBLE sous les lunettes

---

## 5. Spec Codec

### 5.1 Structure et dimensions

```
┌─────────────────────────────────────────────────────────┐
│ CODEC                                    FREQ 141.80 ▊▊▊│
├──────────┬─────────────────────────┬────────────────────┤
│          │                         │                    │
│ [BAZ     │  Bon retour.            │      [USER        │
│  80x80]  │  Ta collection          │       80x80]      │
│          │  t'attendait.           │                    │
│          │                         │                    │
│  BAZ     │  > Parle a BAZ...       │        USER       │
├──────────┴─────────────────────────┴────────────────────┤
└─────────────────────────────────────────────────────────┘
```

**Dimensions:**
- Largeur max: 600px (100% - 32px sur mobile)
- Hauteur: 180px
- Padding interne: 12px
- Coins arrondis: 2px

**Layout CSS Grid:**
```css
grid-template-columns: 92px 1fr 92px;
grid-template-rows: 24px 1fr auto;
```

- Colonne gauche: BAZ portrait (80px + 6px padding chaque cote)
- Colonne centre: texte + input
- Colonne droite: USER portrait

### 5.2 Couleurs Codec

| Element | Couleur |
|---|---|
| Fond | #0F380F (le plus sombre GB) |
| Bordure exterieure | #8BAC0F (2px solid) |
| Bordure interieure | #306230 (1px inset) |
| Separateur colonnes | #306230 (1px, opacity 0.4) |
| Texte | #8BAC0F |
| Labels BAZ/USER | #306230 |
| Label FREQ | #8BAC0F, opacity 0.7-1.0 (pulse) |

### 5.3 Habillage CRT

**Scanlines:**
```css
background: repeating-linear-gradient(
  0deg, transparent, transparent 2px,
  rgba(15, 56, 15, 0.15) 2px, rgba(15, 56, 15, 0.15) 3px
);
```
Opacity: 0.15 max. Couvre toute la fenetre.

**Vignettage:**
```css
background: radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.3) 100%);
```

**Glitch:** 1 scanline tremble 2px horizontalement pendant 100ms. Frequence: 30-60s.

**FREQ pulse:** opacity oscille 0.7-1.0 sur 4s.

**Signal bars:** 3 barres de 2px a cote de FREQ, oscillent en hauteur.

### 5.4 Typographies

| Element | Style |
|---|---|
| Label CODEC | font-display, 0.7rem, bold, #8BAC0F |
| Label FREQ | font-ui, 0.55rem, #8BAC0F |
| Label BAZ | font-display, 0.65rem, bold, letter-spacing 0.14em |
| Label USER | font-ui, 0.55rem, normal, letter-spacing 0.08em, dimmer |
| Texte dialogue | font-ui, 13px, line-height 1.6, #8BAC0F |
| Input | font-ui, 12px, #8BAC0F on transparent |

### 5.5 Etats Codec

| Etat | BAZ | USER | Texte |
|---|---|---|---|
| idle | idle animation | idle_0 statique | dernier message |
| talk | wave animation | listen animation | typewriter |
| content | clap animation | react animation | typewriter |
| user-waiting | idle | idle | "..." pulse |

---

## 6. Integration frontend

### Fichiers a modifier

| Fichier | Action |
|---|---|
| `assets/baz/baz.svg` | REMPLACER par SVG 16x16 fidele aux refs |
| `assets/baz/baz-compact.svg` | REMPLACER (meme sprite, viewBox 16x16) |
| `assets/baz/user-bust.svg` | REMPLACER par SVG 16x16 fidele aux refs |
| `codec.css` | MODIFIER layout 3 colonnes + couleurs GB |
| `codec.js` | MODIFIER structure DOM + animation scheduler |
| `zones.css` | DEJA OK (pixelated rendering en place) |
| `game-detail.html` | DEJA OK (baz-compact.svg reference) |

### Rendu des sprites

```css
.codec-portrait {
  width: 80px;
  height: 80px;
  image-rendering: pixelated;
  image-rendering: -moz-crisp-edges;
  image-rendering: crisp-edges;
}
```

Les sprites 16x16 sont affiches a 80x80 (5x). Chaque pixel source = 5x5 pixels ecran. Net, sans flou.

---

## 7. Pieges a eviter

1. **Anti-aliasing sur les sprites** — INTERDIT. 4 couleurs strictes, rien d'autre.
2. **Animations CSS fluides** — INTERDIT. setTimeout avec durees irregulieres.
3. **Scanlines trop visibles** — 15% opacity MAX.
4. **Glitch trop frequent** — 30-60s minimum entre deux.
5. **USER trop expressif** — USER est une ombre qui ecoute.
6. **BAZ trop detaille** — 16x16 = chaque pixel compte. Pas de fioritures.
7. **Palettes melangees** — BAZ et USER ont des palettes DIFFERENTES.
8. **Oublier prefers-reduced-motion** — Couper TOUTES les animations.

---

## 8. Checklist de validation (15 criteres)

### BAZ
- [ ] 1. Silhouette ronde reconnaissable en 1x
- [ ] 2. Palette stricte 4 couleurs (#0F380F #306230 #8BAC0F #E0F8D0)
- [ ] 3. Antenne avec sparkle lumineux
- [ ] 4. Yeux avec reflet highlight
- [ ] 5. Idle irregulier (pas mecanique)
- [ ] 6. Wave et clap visuellement distincts

### USER
- [ ] 7. Buste uniquement, cadrage stable
- [ ] 8. Palette USER (#0F380F #305230 #7FAF5F #D8F0C0)
- [ ] 9. 90% du sprite en tons sombres
- [ ] 10. Lunettes = seul element clair
- [ ] 11. Listen = micro-mouvement subtil (1px max)

### Codec
- [ ] 12. Layout 3 colonnes (BAZ | texte | USER)
- [ ] 13. Fond #0F380F, bordure #8BAC0F
- [ ] 14. Scanlines subtiles, vignettage coins
- [ ] 15. Sprites affiches a 80x80 pixelated, nets sans flou
