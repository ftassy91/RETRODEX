# RetroDex — Audit initial premium convergence

Date: 2026-04-02

## Doctrine de référence
- [AGENTS.md](./AGENTS.md) reste la doctrine produit supérieure.
- Conséquence directe:
  - `RetroDex` est le coeur du produit.
  - la fiche jeu est la surface reine.
  - le hub oriente, il ne concurrence pas.
  - `RetroMarket` et `Collections` restent des couches de support.
  - le frontend doit rester dense, lisible, utilitaire, terminal-like.

## Points très forts
- runtime public/admin déjà stabilisé
- surface canonique claire dans `backend/public`
- complétude et richness déjà pilotables côté admin/runtime
- pipeline data/enrichment crédible
- hiérarchie produit déjà pensée de manière cohérente

## Frictions réelles avant ce lot
- le fond était meilleur que sa perception publique
- plusieurs surfaces gardaient des signaux visuels de chantier
- la fiche jeu était solide mais pas encore assez signature-level
- `hub`, `catalogue` et `search` restaient utiles sans être encore premium
- le vocabulaire `richness / completion / confidence` n'était pas assez homogène
- des artefacts mineurs de copie/encodage et des restes de styles historiques dégradaient la qualité perçue

## Priorités retenues
1. éliminer les défauts visibles qui cassent la crédibilité premium
2. renforcer `game-detail` comme page signature
3. améliorer le noyau d'exploration `hub + games-list + search`
4. garder `completion` comme système de support élégant, pas comme spectacle
5. documenter clairement les arbitrages et le sens du lot

## Risque si non traité
Le projet aurait continué à paraître "très bon en interne, encore partiellement en chantier côté produit", ce qui bloque la montée vers un vrai niveau 9 en perception globale.
