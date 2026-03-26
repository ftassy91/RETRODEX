# RetroDex Visual Reset V2 ? Comparison Report

- Previous batch: `visual_batch_20260322T145725Z`
- Current batch: `visual_batch_20260322T154329Z`
- Compared games: `10`
- Comparison basis: prompt/classification checkpoints for the same 10 games, plus batch contact sheets before/after.
- Note: previous global render filenames were not versioned. The reset run now writes renders under a run-specific folder to avoid overwrites.

## System Changes

- Abstraction logic disabled.
- Prompt generator now enforces one central object, one context world, and one explicit genre signal.
- Illustration classes are now constrained to `object` or `environment` only.
- Renderer now places a larger central subject and keeps the background as supporting context.

## Compared Games

### The Legend of Zelda: Ocarina of Time (Nintendo 64)
- Class: `environment` -> `object`
- Bucket: `fantasy_adventure` -> `fantasy_adventure`
- Central object (V2): `sword`
- Context (V2): a windswept fantasy landscape with ruins, a distant landmark, and a traversable path
- Genre signal (V2): heroic fantasy exploration

### Tony Hawk's Pro Skater 2 (PlayStation)
- Class: `hero` -> `object`
- Bucket: `sports` -> `sports`
- Central object (V2): `vehicle`
- Context (V2): a stadium or competition ground with lights, field markers, and focused event framing
- Genre signal (V2): competitive event focus

### Soul Calibur (Dreamcast)
- Class: `object` -> `object`
- Bucket: `fighting` -> `fighting`
- Central object (V2): `weapon`
- Context (V2): an arena or duel space with impact energy, banners, and confrontation framing
- Genre signal (V2): combat readiness and duel pressure

### Castlevania: Rondo of Blood (TurboGrafx-16)
- Class: `environment` -> `object`
- Bucket: `fantasy_adventure` -> `fantasy_adventure`
- Central object (V2): `sword`
- Context (V2): a windswept fantasy landscape with ruins, a distant landmark, and a traversable path
- Genre signal (V2): heroic fantasy exploration

### Perfect Dark (Nintendo 64)
- Class: `object` -> `object`
- Bucket: `shooter_arcade` -> `shooter_arcade`
- Central object (V2): `weapon`
- Context (V2): a deep space lane or combat tunnel with velocity and incoming threat
- Genre signal (V2): arcade velocity and projectile threat

### Tetris (Game Boy)
- Class: `abstract` -> `object`
- Bucket: `puzzle_abstract` -> `puzzle_abstract`
- Central object (V2): `tile_stack`
- Context (V2): a physical puzzle space with stacked pieces, spatial logic, and grounded surfaces
- Genre signal (V2): spatial problem-solving with physical pieces

### Super Mario 64 (Nintendo 64)
- Class: `object` -> `object`
- Bucket: `platformer_cartoon` -> `platformer_cartoon`
- Central object (V2): `artifact`
- Context (V2): a playful platform world with layered terrain, readable obstacles, and bright depth cues
- Genre signal (V2): playful traversal and momentum

### Super Metroid (Super Nintendo)
- Class: `environment` -> `object`
- Bucket: `sci_fi_action` -> `sci_fi_action`
- Central object (V2): `helmet`
- Context (V2): a futuristic industrial skyline or reactor zone with cold light and scale
- Genre signal (V2): futuristic danger and combat technology

### Super Mario Bros. 3 (Nintendo Entertainment System)
- Class: `object` -> `object`
- Bucket: `platformer_cartoon` -> `platformer_cartoon`
- Central object (V2): `artifact`
- Context (V2): a playful platform world with layered terrain, readable obstacles, and bright depth cues
- Genre signal (V2): playful traversal and momentum

### Tekken 3 (PlayStation)
- Class: `object` -> `object`
- Bucket: `fighting` -> `fighting`
- Central object (V2): `weapon`
- Context (V2): an arena or duel space with impact energy, banners, and confrontation framing
- Genre signal (V2): combat readiness and duel pressure

## Artefacts

- Previous contact sheet: `assets/retrodex/logs/visual_batch_20260322T145725Z/validation_contact_sheet_batch_001.png`
- Current contact sheet: `assets/retrodex/logs/visual_batch_20260322T154329Z/validation_contact_sheet_batch_001.png`
- Side-by-side comparison: `assets/retrodex/logs/visual_batch_20260322T154329Z/comparison_contact_sheet.png`

## Review Focus

- Confirm that each image reads as object-first in under two seconds.
- Confirm that the environment clarifies the genre instead of competing with the subject.
- Confirm that platform identity remains visible in palette and rendering mood.
- Confirm that no image drifts toward an official character or logo silhouette.
