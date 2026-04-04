# Spec UX/UI RetroDex — Issue des personas
> Généré par le skill `retrodex-personas-ux` · Avril 2026
> Personas : Thomas (Curieux) · Marc (Collectionneur) · Olivier (Savant)

---

## Tensions identifiées

| Point de friction | Thomas veut | Marc veut | Olivier veut |
|---|---|---|---|
| **Densité d'info sur la fiche** | Moins de data, plus d'émotion | Tout d'un seul coup, sans clic | Tout déplié, exhaustif, sourcé |
| **Accordéons par défaut** | Navigation simple, visuelle | Pas d'accordéons — tout visible | Accordéons OK si enrichis |
| **Jargon interne** | Zéro jargon ("Qualification", "Fiche forte") | Jargon OK si = données marché | Jargon OK si = données edito |
| **Score et métriques** | Inutile, même frustrant | Utile si marché (prix trend) | Utile si éditorial (source trust) |
| **Rythme de navigation** | Scroll lent, découverte | Sprint rapide, validé, parti | Plongée longue, exhaustive |

**Conclusion tensions :** Thomas est fondamentalement différent de Marc et Olivier. Le risque est d'optimiser pour Marc/Olivier (déjà bien servis par la structure actuelle) au détriment de Thomas (mal servi). Il faut un **sas d'entrée** différent selon l'intent.

---

## Consensus inter-personas
> Ces irritants sont partagés par 2+ personas — priorité absolue.

### C1 — Absence de visuels/couvertures
- **Thomas** : sans couverture, c'est une feuille de calcul. Il quitte.
- **Olivier** : la cover IGDB est une métadonnée de référence au même titre que le titre.
- **Impact** : perte immédiate du Curieux, signal de fiabilité dégradé pour le Savant.
- **État actuel** : `coverImage` existe dans l'API (`/api/items`), `hub-curated.js` affiche `game.coverImage`. La fiche `game-detail.html` a un `hero-card` mais l'image n'est pas rendue visuellement en premier plan.

### C2 — Pas d'historique/tendance des prix sur la fiche
- **Marc** : décision d'achat impossible sans courbe sur 6-12 mois. Va sur PriceCharting.
- **Olivier** : prix sans contexte temporel = donnée sans valeur analytique.
- **État actuel** : la route `/api/games/:id/price-history` **existe déjà en backend**. Elle n'est pas appelée depuis la fiche. C'est un affichage manquant, pas un manque de données.

### C3 — Friction des accordéons cachés par défaut
- **Marc** : doit cliquer 3 fois pour voir les vraies données. Sur PriceCharting, tout est visible.
- **Olivier** : les sections encyclopédiques (dev-team, OST, archive) cachées = profondeur invisible.
- **État actuel** : design en accordéons fermés par défaut. À discuter : ouvrir certains par défaut, ou offrir un "tout déplier".

### C4 — Doublon "meta" / "metascore" dans les options de tri
- **Olivier** : signal de code non finalisé, détruit la crédibilité.
- **Marc** : confusion dans la liste, perd du temps à choisir.
- **État actuel** : `games-list.html` contient deux options `meta_desc` et `metascore_desc`. Bug confirmé dans le HTML.

### C5 — "Fiches fortes" : terme inexpliqué
- **Thomas** : ne comprend pas ce qu'on lui recommande, ne clique pas.
- **Marc** : OK avec le concept mais veut savoir si c'est "prix vérifié" ou "données complètes".
- **État actuel** : le terme est utilisé sans tooltip ni légende.

---

## Améliorations par persona

### Pour Le Curieux (Thomas)
1. **Cover en héro visuelle** — grande image en tête de fiche, pas juste une mention texte
2. **Renommer/expliquer "Fiches fortes"** — ex. : "Fiches sélectionnées" avec un tooltip "Jeux avec données complètes et bien notés"
3. **Section de découverte au hub** — "Top 10 cette semaine", "Pépites méconnues", "Si vous avez aimé X…" au lieu du flux d'ingest
4. **Synopsis court en premier** — avant les accordéons, afficher 2-3 lignes de contexte éditorial sur le jeu
5. **Signal social minimal** — "X personnes ont ce jeu dans leur collection" sur la fiche

### Pour Le Collectionneur (Marc)
1. **Graphique prix historique** — courbe loose/CIB/mint sur 12 mois, depuis `/api/games/:id/price-history` déjà disponible
2. **Colonnes CIB + MINT dans la Collection** — la vue étagère actuelle manque ces deux colonnes
3. **Tooltip confiance des prix dans la liste** — au survol du prix : "42 ventes | T2 fiable | dernière : 2026-04-01"
4. **Filtre région/variante** — US / JP / PAL comme filtre dans la liste
5. **Timestamp "données mises à jour le"** sur la fiche — date de dernière MAJ des prix

### Pour Le Savant (Olivier)
1. **Ligne de provenance sous le héro** — "Indexé le XX/XX | X sources | Rareté calculée par algorithme Y"
2. **Filtre "niveau de complétude encyclopédique"** — Basique / Développé / Complet dans la liste
3. **Fix doublon tri** — supprimer "meta_asc/desc", garder uniquement "metascore_asc/desc"
4. **Export CSV enrichi** — ajouter métascore, rareté, prix marché à l'export collection
5. **Ouverture par défaut de "Archive/Encyclopédie"** pour les fiches à haute complétude

---

## Matrice de priorisation

| # | Amélioration | Thomas | Marc | Olivier | Effort | Priorité |
|---|---|---|---|---|---|---|
| C1 | Afficher cover en héro visuel | ★★★ | ★ | ★★ | Faible | **P0** |
| C2 | Graphique prix historique (API existe) | ○ | ★★★ | ★★ | Faible | **P0** |
| C4 | Fix doublon tri meta/metascore | ★ | ★★ | ★★★ | Très faible | **P0** |
| C5 | Renommer/expliquer "Fiches fortes" | ★★★ | ★★ | ★ | Très faible | **P0** |
| C3 | Certains accordéons ouverts par défaut | ★★ | ★★★ | ★★ | Faible | **P1** |
| M1 | Tooltip confiance prix dans la liste | ○ | ★★★ | ★★ | Faible | **P1** |
| T1 | Synopsis court visible avant accordéons | ★★★ | ○ | ★★ | Faible | **P1** |
| O1 | Ligne de provenance sous héro | ★ | ★ | ★★★ | Faible | **P1** |
| M2 | Colonnes CIB/MINT dans Collection | ○ | ★★★ | ○ | Très faible | **P1** |
| T2 | Section découverte au hub | ★★★ | ○ | ○ | Moyen | **P2** |
| M3 | Filtre région/variante | ○ | ★★★ | ★★ | Moyen | **P2** |
| O2 | Filtre complétude encyclopédique | ○ | ★ | ★★★ | Moyen | **P2** |
| M4 | Timestamp MAJ des prix | ○ | ★★★ | ★★ | Très faible | **P2** |
| O3 | Export CSV enrichi | ○ | ★★ | ★★★ | Moyen | **P3** |
| T3 | Signal social (X personnes l'ont) | ★★★ | ○ | ○ | Moyen | **P3** |

---

## Recommandations structurelles

### Navigation par intent
Aujourd'hui : Hub → RetroDex → Collection. Structure fonctionnelle, mais pas orientée intention.
**Recommandation** : ajouter un sous-titre ou un routing implicite par persona au hub :
- "Je découvre" → vue covers + curation éditoriale
- "Je cherche un jeu précis" → recherche directe (existant)
- "Je gère ma collection" → Collection (existant)

### Architecture de la fiche jeu
Aujourd'hui : Hero → [accordéons]. Correct mais plat.
**Recommandation** : hero enrichi (cover grande + synopsis 2 lignes + badges rareté/tendance prix), puis accordéons. La couverture et le synopsis doivent être visibles **sans clic**.

### Hiérarchie des données marché
Aujourd'hui : prix affiché sans contexte temporel ni confiance.
**Recommandation** : chaque prix doit être accompagné de : (a) tendance fléchée, (b) date de dernière observation, (c) niveau de confiance T1/T2/T3.

---

## Recommandations visuelles

| Élément | État actuel | Recommandation |
|---|---|---|
| Cover jeu | Absente ou non prioritaire | En-tête de fiche, 100% largeur ou 40% à gauche |
| Typographie fiches | Monospace uniforme | Conserver monospace pour données, introduire une hiérarchie taille (titre plus gros) |
| Couleur tendance prix | Non codée | Vert ↑ / Rouge ↓ / Gris stable — convention universelle |
| Badge rareté | Texte seul | Conserver texte + ajouter couleur LEGENDARY/EPIC/RARE/UNCOMMON/COMMON |
| Accordéons fermés | Tous cachés | Ouvrir "Collection" + "Archive" par défaut sur fiches Developed/Complete |
| Flux ingest au hub | Canvas full-width | Réduire à une bande ou déplacer en bas de page — remplacer par curation éditoriale |

---

## Périmètre exclu

- **Variantes régionales** : nécessite une refonte du modèle de données (un jeu = N versions). Hors scope sprint.
- **Recommandations personnalisées** ("si vous avez aimé X…") : nécessite un moteur de recommandation. Hors scope court terme.
- **Pages accessories, consoles, franchises** : non auditées dans ce cycle.
- **Mobile/responsive** : non testé dans cet audit (seul le HTML statique a été analysé).

---

## Plan d'amélioration (draft)

### Sprint A — Quick wins, effort < 4h chacun (P0)
> Objectif : réduire les irritants universels sans refonte

| Tâche | Effort est. | Persona(s) |
|---|---|---|
| A1 · Fix doublon tri meta/metascore dans games-list.html | 30 min | Olivier, Marc |
| A2 · Renommer "Fiches fortes" + tooltip explicatif | 30 min | Thomas, Marc |
| A3 · Afficher couverture du jeu en position héro sur la fiche | 2h | Thomas, Olivier |
| A4 · Graphique prix historique sur la fiche (API `/price-history` existe) | 3h | Marc, Olivier |
| A5 · Timestamp "Prix mis à jour le" sur la fiche | 1h | Marc |

### Sprint B — Améliorations medium, effort < 1 jour chacun (P1)
> Objectif : débloquer les besoins prioritaires par persona

| Tâche | Effort est. | Persona(s) |
|---|---|---|
| B1 · Synopsis court visible avant les accordéons | 2h | Thomas, Olivier |
| B2 · Ouvrir "Collection" + "Archive" par défaut sur fiches bien documentées | 2h | Marc, Olivier |
| B3 · Tooltip confiance prix dans la liste (sources + date) | 2h | Marc, Olivier |
| B4 · Ligne de provenance/métadonnées sous le héro | 1h | Olivier |
| B5 · Colonnes CIB + MINT dans la vue Collection | 1h | Marc |

### Sprint C — Améliorations structurelles (P2-P3)
> Objectif : différencier les audiences, enrichir la profondeur

| Tâche | Effort est. | Persona(s) |
|---|---|---|
| C1 · Section découverte/curation au hub (remplace ou complète le flux ingest) | 1-2j | Thomas |
| C2 · Filtre "niveau de complétude encyclopédique" dans la liste | 1j | Olivier |
| C3 · Filtre région/variante (US/JP/PAL) dans la liste | 1-2j | Marc |
| C4 · Export CSV enrichi (métascore, rareté, prix marché) | 1j | Marc, Olivier |
| C5 · Signal social minimal ("X personnes l'ont") sur la fiche | 1j | Thomas |

---

> **Ce plan est un draft.** Les questions de la section suivante permettront de l'affiner avant exécution.
