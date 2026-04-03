# Quarantine

Ce dossier contient du travail local identifié pendant la Phase 0, mais non retenu comme base d'implémentation du runtime canonique.

## `collection-service.js`

- Statut : `quarantine`
- Raison : le fichier pousse une convergence runtime `Sequelize + services` incompatible avec la cible validée pour la prod, qui reste `db_supabase.js`.
- Décision : ne pas l'intégrer ni le supprimer pour l'instant.
- Révision prévue : Phase 4 `collection`, quand le domaine sera traité explicitement.

## `runtime-db-context.js`

- Statut : `quarantine`
- Raison : sa responsabilité infra a été absorbée par [env.js](./backend/src/config/env.js), mais il reste conservé ici pour garder `collection-service.js` autoporté en quarantaine.
- Décision : ne pas le réintégrer dans `services/`.
- Révision prévue : suppression finale quand la quarantaine `collection` sera tranchée.
