# RETRODEXseedV0 - package status

Updated: 2026-03-18
Current location:
`C:\Users\ftass\OneDrive\Bureau\RETRODEXseed\RETRODEXseedV0`

## What this folder is

`RETRODEXseedV0` is not the whole RetroDex repository.
It is the frontend seed package centered on:

- `prototype_v0/launcher.html`
- `prototype_v0/index.html`
- `prototype_v0/modules/retromarket/market.html`

It also includes:

- frontend datasets (`data/`, `datapack/`)
- generated assets (`assets/generated_gb/`, `retrodeck_assets/`)
- working memory files (`memory/`)
- debug and review artifacts

## Canonical workspace

The canonical development workspace is the repository root:

`C:\Users\ftass\OneDrive\Bureau\RETRODEXseed`

That root contains the additional repository-level pieces used for active development:

- `backend/`
- `docs/`
- `scripts/`
- `logs/`
- `.git/`

## How to read this package correctly

- `RETRODEXseedV0` = canonical frontend package inside the repository
- it is not the backend workspace by itself
- it does not require any external `prototype_v2` directory

## Known ambiguous entries

These entries are legacy artifacts and should not be treated as real source folders:

- `prototype_v0\{css,js,data,img,memory}`
- `prototype_v0\assets\{source`

## Correct launch pattern

Serve `prototype_v0/` over local HTTP and open:

- `http://localhost:8080/launcher.html`
- `http://localhost:8080/index.html`
- `http://localhost:8080/modules/retromarket/market.html`

Do not use `file://`.
