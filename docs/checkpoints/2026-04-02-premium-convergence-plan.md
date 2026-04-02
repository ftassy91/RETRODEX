# RetroDex — Plan révisé premium convergence

Date: 2026-04-02

## Arbitrage directeur
Le repo n'avait pas besoin d'un grand refactor backend/runtime.  
Le bon levier était une convergence visible et cohérente:

1. assainir tout ce qui dégrade la perception
2. faire de la fiche jeu la page signature
3. élever `hub`, `catalogue` et `search` au niveau du socle
4. stabiliser le langage public de richesse / état / confiance
5. laisser une trace documentaire propre et relisible

## Périmètre exécuté
- surfaces publiques coeur:
  - `hub`
  - `games-list`
  - `game-detail`
  - `search`
  - `stats`
- helpers et composants publics:
  - `content-signals`
  - `renderGameRow`
  - CSS partagé
- documentation:
  - audit initial
  - plan révisé
  - rapport final

## Ce qui a été explicitement évité
- pas de nouvelle feature lourde
- pas de nouveau score opaque
- pas de refonte décorative déconnectée de l'usage
- pas de remise en cause de la hiérarchie AGENTS
- pas de nouvelle wave data comme moteur principal du lot

## Cible produit
- meilleure lecture immédiate
- meilleure hiérarchie
- meilleure valeur perçue
- meilleure cohérence de langage
- meilleure défense du produit comme actif sérieux
