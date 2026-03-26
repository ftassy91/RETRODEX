# RetroDex Illustration System Reset - Comparison Report

- Previous visual system: `visual_batch_20260322T162158Z`
- Current visual system: `visual_batch_20260322T192445Z`
- Previous system issue: scenes were still too synthetic, diagrammatic, and symbol-driven.
- Current system direction: pixel tableau renderer with subject, playable world, depth, and controlled light.

## What changed

- Rendering now happens on a small pixel canvas upscaled with nearest-neighbor.
- Backgrounds are scene-based rather than symbolic overlays.
- Subjects are rendered as sprite-like archetypes or readable gameplay objects.
- Depth, horizon, shadow, and backlight are now part of the base composition.
- Platform identity still comes from palette and overall rendering mood.

## Batch status

- Current batch: `10/10` generated
- Current batch: `0` flagged
- Current QA score average: `100.0`

## Compared games

### The Legend of Zelda: Ocarina of Time (Nintendo 64)
- Subject: `small heroic adventurer with a sword`
- Context: a windswept fantasy landscape with ruins, a distant landmark, and a traversable path
- Action / mood cue: standing on a windswept path with quiet resolve
- Platform style: `n64_color_volume`

### Tony Hawk's Pro Skater 2 (PlayStation)
- Subject: `single skateboarder silhouette`
- Context: a stadium or competition ground with lights, field markers, and focused event framing
- Action / mood cue: balancing into motion on a board in a clean skate scene
- Platform style: `ps1_lowpoly_editorial`

### Soul Calibur (Dreamcast)
- Subject: `lone martial artist silhouette`
- Context: an arena or duel space with impact energy, banners, and confrontation framing
- Action / mood cue: holding a focused pre-fight stance in a charged arena
- Platform style: `dreamcast_futurist`

### Castlevania: Rondo of Blood (TurboGrafx-16)
- Subject: `small heroic adventurer with a sword`
- Context: a windswept fantasy landscape with ruins, a distant landmark, and a traversable path
- Action / mood cue: standing on a windswept path with quiet resolve
- Platform style: `turbografx_arcade_poster`

### Perfect Dark (Nintendo 64)
- Subject: `lone covert operative silhouette`
- Context: a deep space lane or combat tunnel with velocity and incoming threat
- Action / mood cue: moving carefully through a tense high-tech space
- Platform style: `n64_color_volume`

### Tetris (Game Boy)
- Subject: `stacked falling blocks`
- Context: a physical puzzle space with stacked pieces, spatial logic, and grounded surfaces
- Action / mood cue: captured in a precise descending arrangement above a grounded puzzle surface
- Platform style: `gameboy_monochrome_story`

### Super Mario 64 (Nintendo 64)
- Subject: `small agile explorer`
- Context: a playful platform world with layered terrain, readable obstacles, and bright depth cues
- Action / mood cue: caught in a forward-moving leap through layered terrain
- Platform style: `n64_color_volume`

### Super Metroid (Super Nintendo)
- Subject: `lone armored explorer`
- Context: a futuristic industrial skyline or reactor zone with cold light and scale
- Action / mood cue: standing in a hostile alien cavern under atmospheric light
- Platform style: `snes_storybook_16bit`

### Super Mario Bros. 3 (Nintendo Entertainment System)
- Subject: `small agile explorer`
- Context: a playful platform world with layered terrain, readable obstacles, and bright depth cues
- Action / mood cue: caught in a forward-moving leap through layered terrain
- Platform style: `nes_restrained_poster`

### Tekken 3 (PlayStation)
- Subject: `lone martial artist silhouette`
- Context: an arena or duel space with impact energy, banners, and confrontation framing
- Action / mood cue: holding a focused pre-fight stance in a charged arena
- Platform style: `ps1_lowpoly_editorial`

## Review reminder

- Automated QA is clean, but human review is still required for desirability and franchise-level evocation.
- The current renderer is intentionally more illustrative than the previous procedural symbol system.

## Artefacts

- Previous contact sheet: `assets/retrodex/logs/visual_batch_20260322T162158Z/validation_contact_sheet_batch_001.png`
- Current contact sheet: `assets/retrodex/logs/visual_batch_20260322T192445Z/validation_contact_sheet_batch_001.png`
- Side-by-side comparison: `assets/retrodex/logs/visual_batch_20260322T192445Z/comparison_contact_sheet.png`
