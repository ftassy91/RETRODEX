# RetroDex Prompt Formula v1 - Comparison Report

- Previous batch: `visual_batch_20260322T154329Z`
- Current batch: `visual_batch_20260322T162158Z`
- Compared games: `10`
- Comparison basis: same 10 games, same local renderer, new prompt formula and subject system.

## What changed

- Prompt generator rebuilt around `subject + environment + mood + platform style`.
- Decorative and abstract prompt logic removed from the active system.
- Subject archetypes added for adventure, horror, sci-fi, fighting, sports, puzzle, and mystery cases.
- Renderer aligned to draw readable subjects instead of mostly symbolic objects.

## Compared games

### The Legend of Zelda: Ocarina of Time (Nintendo 64)
- Class: `object` -> `object`
- Subject: `sword` -> `small heroic adventurer with a sword`
- Subject key (current): `heroic_adventurer`
- Context: a windswept fantasy landscape with ruins, a distant landmark, and a traversable path
- Action / mood cue: standing on a windswept path with quiet resolve

### Tony Hawk's Pro Skater 2 (PlayStation)
- Class: `object` -> `object`
- Subject: `vehicle` -> `single skateboarder silhouette`
- Subject key (current): `skateboarder`
- Context: a stadium or competition ground with lights, field markers, and focused event framing
- Action / mood cue: balancing into motion on a board in a clean skate scene

### Soul Calibur (Dreamcast)
- Class: `object` -> `object`
- Subject: `weapon` -> `lone martial artist silhouette`
- Subject key (current): `duelist`
- Context: an arena or duel space with impact energy, banners, and confrontation framing
- Action / mood cue: holding a focused pre-fight stance in a charged arena

### Castlevania: Rondo of Blood (TurboGrafx-16)
- Class: `object` -> `object`
- Subject: `sword` -> `small heroic adventurer with a sword`
- Subject key (current): `heroic_adventurer`
- Context: a windswept fantasy landscape with ruins, a distant landmark, and a traversable path
- Action / mood cue: standing on a windswept path with quiet resolve

### Perfect Dark (Nintendo 64)
- Class: `object` -> `object`
- Subject: `weapon` -> `lone covert operative silhouette`
- Subject key (current): `covert_operative`
- Context: a deep space lane or combat tunnel with velocity and incoming threat
- Action / mood cue: moving carefully through a tense high-tech space

### Tetris (Game Boy)
- Class: `object` -> `object`
- Subject: `tile_stack` -> `stacked falling blocks`
- Subject key (current): `tile_stack`
- Context: a physical puzzle space with stacked pieces, spatial logic, and grounded surfaces
- Action / mood cue: captured in a precise descending arrangement above a grounded puzzle surface

### Super Mario 64 (Nintendo 64)
- Class: `object` -> `object`
- Subject: `artifact` -> `small agile explorer`
- Subject key (current): `agile_explorer`
- Context: a playful platform world with layered terrain, readable obstacles, and bright depth cues
- Action / mood cue: caught in a forward-moving leap through layered terrain

### Super Metroid (Super Nintendo)
- Class: `object` -> `object`
- Subject: `helmet` -> `lone armored explorer`
- Subject key (current): `armored_explorer`
- Context: a futuristic industrial skyline or reactor zone with cold light and scale
- Action / mood cue: standing in a hostile alien cavern under atmospheric light

### Super Mario Bros. 3 (Nintendo Entertainment System)
- Class: `object` -> `object`
- Subject: `artifact` -> `small agile explorer`
- Subject key (current): `agile_explorer`
- Context: a playful platform world with layered terrain, readable obstacles, and bright depth cues
- Action / mood cue: caught in a forward-moving leap through layered terrain

### Tekken 3 (PlayStation)
- Class: `object` -> `object`
- Subject: `weapon` -> `lone martial artist silhouette`
- Subject key (current): `duelist`
- Context: an arena or duel space with impact energy, banners, and confrontation framing
- Action / mood cue: holding a focused pre-fight stance in a charged arena

## Artefacts

- Previous contact sheet: `assets/retrodex/logs/visual_batch_20260322T154329Z/validation_contact_sheet_batch_001.png`
- Current contact sheet: `assets/retrodex/logs/visual_batch_20260322T162158Z/validation_contact_sheet_batch_001.png`
- Side-by-side comparison: `assets/retrodex/logs/visual_batch_20260322T162158Z/comparison_contact_sheet.png`

## Human review checklist

- Do I understand the image in 1 second?
- Do I guess the game type immediately?
- Do I feel the platform identity?
- Is there no obvious copy of a protected character or design?
