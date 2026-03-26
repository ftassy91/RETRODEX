#!/usr/bin/env python3
"""
update_pack.py — Met à jour le DataPack depuis les fichiers data/ courants.
À lancer après chaque enrichissement du catalogue validé.

Usage : python3 datapack/update_pack.py
"""
import json, shutil, os, sys
from datetime import datetime
from collections import Counter

ROOT     = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, 'data')
PACK_DIR = os.path.join(ROOT, 'datapack')
IMG_DIR  = os.path.join(ROOT, 'img')

def main():
    print("=" * 48)
    print(" RetroDex — Mise à jour du DataPack")
    print("=" * 48)

    # Valider d'abord
    import subprocess
    r = subprocess.run([sys.executable, os.path.join(DATA_DIR, 'validate.py')],
                       capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stdout)
        print("✗ Validation échouée — DataPack non mis à jour.")
        sys.exit(1)
    print("✓ Données validées")

    # Copier les JSONs
    for f in ['catalog.json', 'prices.json', 'consoles.json']:
        shutil.copy(os.path.join(DATA_DIR, f), os.path.join(PACK_DIR, f))
        size = os.path.getsize(os.path.join(PACK_DIR, f)) / 1024
        print(f"  ✓ {f:20} {size:.0f} KB")

    # Copier l'asset PNG
    src_png = os.path.join(IMG_DIR, '3ds-template.png')
    if os.path.exists(src_png):
        shutil.copy(src_png, os.path.join(PACK_DIR, '3ds-template.png'))
        print(f"  ✓ 3ds-template.png")

    # Mettre à jour le manifest
    catalog  = json.load(open(os.path.join(PACK_DIR, 'catalog.json')))
    prices   = json.load(open(os.path.join(PACK_DIR, 'prices.json')))
    consoles = json.load(open(os.path.join(PACK_DIR, 'consoles.json')))

    manifest_path = os.path.join(PACK_DIR, 'manifest.json')
    old = json.load(open(manifest_path)) if os.path.exists(manifest_path) else {}

    # Incrémenter version
    old_ver = old.get('version', '1.0')
    major, minor = map(int, old_ver.split('.'))
    new_ver = f"{major}.{minor + 1}"

    manifest = {
        "name":        "RetroDex DataPack",
        "version":     new_ver,
        "updated":     datetime.now().strftime('%Y-%m-%d'),
        "description": "Données vérifiées et assets de base pour RetroDex.",
        "contents": {
            "catalog":  {"file": "catalog.json",  "entries": len(catalog)},
            "prices":   {"file": "prices.json",   "entries": len(prices)},
            "consoles": {"file": "consoles.json", "entries": len(consoles)},
            "assets":   ["3ds-template.png"]
        },
        "stats": {
            "total_games":        len(catalog),
            "total_prices":       len(prices),
            "total_consoles":     len(consoles),
            "consoles_covered":   sorted(set(g['console'] for g in catalog)),
            "rarity_breakdown":   dict(Counter(g['rarity'] for g in catalog))
        }
    }

    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    print(f"\n✓ DataPack v{new_ver} — {len(catalog)} jeux, {len(prices)} prix")
    print("=" * 48)

if __name__ == '__main__':
    main()
