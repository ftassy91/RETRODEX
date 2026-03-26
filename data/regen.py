#!/usr/bin/env python3
"""
regen.py — Régénérateur des fichiers JS de données RetroDex
============================================================
Convertit catalog.json, prices.json, consoles.json
en fichiers JS avec window.XXX_DATA = [...] pour usage en file://.

À exécuter APRÈS validate.py, AVANT de tester dans le navigateur.

Usage :
  python3 data/regen.py
"""

import json
import os
import sys
import subprocess
from datetime import datetime

DATA_DIR = os.path.dirname(os.path.abspath(__file__))

FILES = [
    ('catalog.json',  'CATALOG_DATA'),
    ('prices.json',   'PRICES_DATA'),
    ('consoles.json', 'CONSOLES_DATA'),
]

def main():
    print("=" * 54)
    print(" RetroDex — Régénération des fichiers JS de données")
    print("=" * 54)

    # Valider d'abord
    print("\nÉtape 1 : validation des données...")
    result = subprocess.run(
        [sys.executable, os.path.join(DATA_DIR, 'validate.py')],
        capture_output=True, text=True
    )
    print(result.stdout.strip())
    if result.returncode != 0:
        print("\n✗ Validation échouée — fichiers JS non régénérés.")
        print("  Corrigez les erreurs dans les JSON puis relancez.")
        sys.exit(1)

    # Générer les .js
    print("\nÉtape 2 : génération des fichiers JS...")
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M')

    for json_file, var_name in FILES:
        json_path = os.path.join(DATA_DIR, json_file)
        js_path   = os.path.join(DATA_DIR, json_file.replace('.json', '.js'))

        with open(json_path, encoding='utf-8') as f:
            data = json.load(f)

        count = len(data)
        js_content = (
            f"/* AUTO-GENERATED — ne pas modifier manuellement\n"
            f"   Source : {json_file} — {count} entrées\n"
            f"   Généré : {timestamp}\n"
            f"   Pour régénérer : python3 data/regen.py */\n"
            f"window.{var_name} = {json.dumps(data, separators=(',', ':'), ensure_ascii=False)};\n"
        )

        with open(js_path, 'w', encoding='utf-8') as f:
            f.write(js_content)

        size_kb = os.path.getsize(js_path) / 1024
        print(f"  ✓ {json_file.replace('.json','.js'):20} {count:5} entrées  {size_kb:.0f} KB")

    print("\n" + "=" * 54)
    print(" ✓ Tous les fichiers JS sont à jour.")
    print(" → Rechargez index.html dans le navigateur.")
    print("=" * 54)

if __name__ == '__main__':
    main()
