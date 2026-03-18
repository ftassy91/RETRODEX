#!/usr/bin/env bash
# RETRODEX - Download game maps
# Sources: ian-albert.com, VGMaps.com (public domain / personal use)
# Run from the maps directory: cd RETRODEXseedV0/prototype_v0/maps && bash download_maps.sh

set -e
cd "$(dirname "$0")"
echo "RETRODEX - downloading maps..."

download() {
  local file="$1" url="$2"
  if [ -f "$file" ]; then echo "  OK $file (already present)"; return; fi
  echo "  DOWN $file"
  curl -L -s -o "$file" "$url" || wget -q -O "$file" "$url" || echo "  FAIL $url"
}

# Zelda ALttP - Light World
download "alttp-light-world.png" \
  "https://ian-albert.com/games/legend_of_zelda_a_link_to_the_past/light-world-clean.png"

# Zelda NES - Overworld
download "zelda-nes-overworld.png" \
  "https://ian-albert.com/games/legend_of_zelda/overworld.png"

# Super Mario World - Yoshi's Island 1
download "smw-yoshi-island-1.png" \
  "https://ian-albert.com/games/super_mario_world/yoshi-island-1.png"

# Super Metroid - Brinstar
download "super-metroid-brinstar.png" \
  "https://ian-albert.com/games/super_metroid/brinstar.png"

# Metroid NES - Brinstar
download "metroid-brinstar.png" \
  "https://ian-albert.com/games/metroid/brinstar.png"

# Super Mario Bros 3 - World 1
download "smb3-world1.png" \
  "https://ian-albert.com/games/super_mario_bros_3/world-1.png"

# Castlevania NES
download "castlevania-nes.png" \
  "https://ian-albert.com/games/castlevania/castlevania.png"

# Sonic 2 - Emerald Hill
download "sonic2-emerald-hill.png" \
  "https://ian-albert.com/games/sonic_the_hedgehog_2/emerald-hill-zone-act-1.png"

# Zelda Link's Awakening - Koholint
download "links-awakening-koholint.png" \
  "https://ian-albert.com/games/legend_of_zelda_links_awakening/overworld.png"

echo ""
echo "Maps present:"
ls -1 *.png 2>/dev/null | while read f; do echo "  $f ($(du -sh "$f" 2>/dev/null | cut -f1))"; done
echo ""
echo "Note: FF6, FF7, SotN, OoT, SM64, Panzer Dragoon, and Neutopia"
echo "are not available on ian-albert.com."
echo "Add those files manually in maps/ if you have them."
