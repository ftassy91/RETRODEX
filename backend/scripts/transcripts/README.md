# Transcripts — Sources pour anecdotes BAZ

Ce dossier contient des faits extraits de videos retrogaming, formates pour ingestion automatique.

## Format JSON

```json
{
  "source_name": "Did You Know Gaming",
  "source_url": "https://youtube.com/watch?v=VIDEO_ID",
  "episode": "Things You Didn't Know About SNES Games",
  "facts": [
    {
      "slug": "chrono-trigger-super-nintendo",
      "text": "Le projet a reuni Sakaguchi, Horii et Toriyama — le Dream Team.",
      "category": "dev"
    },
    {
      "slug": "super-metroid-super-nintendo",
      "text": "La sequence d ouverture reprend les derniers instants de Metroid II.",
      "category": "dev"
    }
  ]
}
```

## Categories

| Categorie | Usage |
|---|---|
| `dev` | Production, developpement, equipe |
| `trivia` | Faits techniques, mecaniques cachees |
| `cultural` | Impact culturel, reception, memes |
| `market` | Ventes, prix, rarete, distribution |
| `history` | Premières, innovations, dates cles |

## Sources recommandees

| Source | Langue | Type |
|---|---|---|
| Did You Know Gaming | EN | Facts videos |
| GVMERS | EN | Documentaires jeux |
| Retronauts | EN | Podcast retro |
| Gaming Historian | EN | Documentaires hardware |
| Archipel | EN/JP | Interviews developpeurs |
| Fin du Game | FR | Podcast retro FR |
| Le Cast Retro | FR | Podcast retro FR |
| Esquive la Boule de Feu | FR | Podcast jeux FR |
| Canard PC | FR | Presse FR |

## Comment extraire un transcript YouTube

1. Ouvrir la video YouTube
2. Cliquer "..." > "Afficher la transcription"
3. Copier le texte
4. Identifier les faits verifiables (dates, noms, chiffres)
5. Reformuler en voix BAZ (factuel, concis, humour sec)
6. Creer le JSON avec les slugs correspondants aux games.id

## Ingestion

```bash
node backend/scripts/ingest-transcript.js
node backend/scripts/ingest-transcript.js --dry-run
node backend/scripts/ingest-transcript.js --file=transcripts/mon-fichier.json
```
