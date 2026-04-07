# RetroDex — Inventaire de couverture réelle

**Date :** 2026-04-07
**Total catalogue :** 1491 jeux

---

| Champ | Table source | Rôle métier | Requis fiche canonique | Visible produit | État actuel | N / 1491 |
|-------|-------------|-------------|----------------------|-----------------|-------------|----------|
| id | games | Identifiant unique | oui | non (slug) | plein | 1491 |
| title | games | Titre affiché | oui | oui | plein | 1491 |
| console | games | Plateforme | oui | oui | plein | 1491 |
| year | games | Année de sortie | oui | oui | plein | 1491 |
| slug | games | URL canonique | oui | oui | plein | 1491 |
| developer | games | Studio principal | non (game_companies) | oui | 92% | 1368 |
| genre | games | Genre | non | oui | partiel | ~1100 |
| metascore | games | Score critique | non | oui | partiel | ~680 |
| summary | games / game_editorial | Résumé court | oui | oui | 100% | 1491 |
| synopsis | games / game_editorial | Synopsis narratif | oui | oui | 100% | 1491 |
| lore | games / game_editorial | Contexte narratif | oui | oui | 95% | 1418 |
| gameplay_description | game_editorial | Description gameplay | non | oui | 95% | 1417 |
| characters | games / game_editorial | Personnages | non | oui | 79% | 1184 |
| dev_anecdotes | games / game_editorial | Anecdotes dev | non | oui | <1% | 10 |
| cheat_codes | games / game_editorial | Codes triche | non | oui | 1% | 15 |
| versions | games / game_editorial | Variantes / versions | non | oui | 0% | 0 |
| cover_url / coverImage | games / media_references | Visuel fiche | oui | oui | 98% | 1467 |
| tagline | games | Accroche | non | oui | 5% | 77 |
| youtube_id | games | Vidéo gameplay | non | oui | 0% | 0 |
| archive_id | games | Archive.org ref | non | oui | partiel | ~50 |
| manual_url | games | Lien manuel | non | oui | partiel | 113 |
| loose_price / cib_price / mint_price | games | Prix marché inline | non (price_history) | oui | partiel | ~700 |
| price_last_updated | games | Date dernier prix | non | oui | partiel | ~700 |
| source_names | games | Sources prix | non | oui | partiel | ~700 |
| ost_composers | games | Compositeurs OST | non | oui | 84% | 1258 |
| ost_notable_tracks | games | Pistes notables | non | oui | partiel | ~200 |
| avg_duration_main | games / game_editorial | Durée principale | non | oui | 6% | 89 |
| avg_duration_complete | games / game_editorial | Durée 100% | non | oui | 6% | ~80 |
| speedrun_wr | games / game_editorial | Record speedrun | non | oui | <1% | 12 |
| dev_team | games | Équipe dev (JSON) | non | oui | partiel | ~1100 |
| people (table) | people | Entités personnes | non | via API | 1229 entrées | — |
| game_people | game_people | Credits individuels | non | via API | 3848 lignes | — |
| media_references | media_references | Tous médias | non | oui | 1800 entrées | — |
| price_history | price_history | Historique prix | non | via API | 136895 lignes | — |
| ost (table canonique) | ost | Albums OST | non | via API | 0 (jamais peuplé) | — |
| game_curation_states | game_curation_states | Lifecycle publication | oui | non | 351 published | — |

---

## Champs absents ou structurellement vides

Les champs suivants sont soit à zéro soit en couverture négligeable au 2026-04-07 :

| Champ | État | N / 1491 |
|-------|------|----------|
| versions | 0% | 0 |
| youtube_id | 0% | 0 |
| dev_anecdotes | <1% | 10 |
| cheat_codes | 1% | 15 |
| tagline | 5% | 77 |
| speedrun_wr | <1% | 12 |
| avg_duration_main | 6% | 89 |
