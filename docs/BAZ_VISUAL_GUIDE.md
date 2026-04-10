# BAZ — Visual Guide

## Sprite
- **Format**: SVG, 16x16 pixel grid, monochrome (uses `currentColor`)
- **Location**: `/assets/baz/baz.svg`
- **Size in codec**: 28x28px
- **Color**: inherits `var(--accent)` — adapts to zone (green/cyan/amber/gray)

## Design
- La Linea inspired: minimal pixel face
- Round head with antenna
- Two square eyes (2x2 px each)
- Asymmetric nose (La Linea signature)
- Slight smile

## Usage
- Codec banner: left of text, 28x28
- Never used as decoration — only where BAZ speaks
- Always paired with text (BAZ doesn't appear silently)

## States (future)
- idle: current default sprite
- talk: slight mouth animation (CSS or frame swap)
- surprised: wider eyes
- happy: upturned mouth

Current: idle only. Other states for Vision A v2.
