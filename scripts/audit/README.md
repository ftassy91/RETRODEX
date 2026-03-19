# scripts/audit — Validation et audit SQLite

Scripts de contrôle qualité du catalogue. Tous en lecture seule
sauf fix_missing_genres.js.

validate_all.js       — 4 checks qualité, exit 0/1. Lancer en premier.
audit_games.js        — rapport complet du catalogue SQLite
fix_missing_genres.js — correction genres manquants (modifie SQLite)
validate_all.js doit passer avant tout autre script.
