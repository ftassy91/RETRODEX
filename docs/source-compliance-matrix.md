# Source Compliance Matrix

## Status model

- `approved`: source officielle ou dataset officiellement reutilisable, exploitable dans le produit selon les contraintes documentees.
- `approved_with_review`: source exploitable seulement dans un perimetre restreint et sous revue complementaire avant extension.
- `reference_only`: usage limite a des pointeurs externes ou references ; aucun stockage local d'asset ou de contenu protege.
- `blocked`: aucune ingestion ni exploitation produit tant qu'une base contractuelle claire n'est pas documentee.

## Approved

### eBay Developer APIs

- Status: `approved`
- Allowed use:
  - metadata de listing strictement utile au signal produit
  - observations de prix normalisees
  - liens externes vers listings
- Restrictions:
  - pas de stockage de PII
  - pas de contenu utilisateur hors metadata strictement necessaire
  - garder la source, la date d'observation et l'identifiant de listing
- Product scope:
  - RetroMarket
  - `price_observations`
  - `market_snapshots`

## Approved with review

### IGDB / Twitch

- Status: `approved_with_review`
- Allowed use:
  - metadata produit
  - relations de base jeux / plateformes / compagnies
  - URLs externes vers covers ou images conformes
- Restrictions:
  - aucun stockage local d'asset protege
  - conserver la provenance de chaque champ fort impacte
  - extension commerciale ou enrichment massif soumis a revue supplementaire
- Product scope:
  - identity metadata
  - media references via URLs uniquement

### PriceCharting API

- Status: `approved_with_review`
- Allowed use:
  - prix courants par etat si licence/API payante active
  - reference de source visible cote produit si le champ est expose
- Restrictions:
  - pas d'historique natif suppose
  - pas d'usage sans licence valide
  - toujours marquer la source et la date d'ingestion
- Product scope:
  - `market_snapshots`
  - verification / corroboration de prix

## Reference only

### Internet Archive

- Status: `reference_only`
- Allowed use:
  - `manual_url`
  - pointeur externe vers une page de manuel
- Restrictions:
  - aucun telechargement ni stockage local des manuels
  - aucun retraitement massif de contenu
  - tous les enregistrements doivent etre marques `rights_uncertain` tant qu'une revue juridique plus forte n'est pas faite
- Product scope:
  - `media_references`

## Blocked by default

### Unofficial scraping and undocumented sources

- Status: `blocked`
- Includes:
  - scraping HTML sans accord clair
  - sources sans ToS/API/licence documentee
  - assets proteges copies localement
- Rule:
  - aucune integration tant qu'un dossier de conformite n'existe pas

## Field-level requirements

- Tout champ fort impact produit doit avoir:
  - `source_name`
  - `source_type`
  - `ingested_at`
  - `confidence_level`
  - `compliance_status`
- Toute valeur inferee doit avoir:
  - `is_inferred = true`
  - justification courte
  - score de confiance degrade
