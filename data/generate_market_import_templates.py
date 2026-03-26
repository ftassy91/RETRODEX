#!/usr/bin/env python3
"""
generate_market_import_templates.py
===================================
Generates empty JSON templates for RetroMarket verified imports.

Usage:
  python data/generate_market_import_templates.py
  python data/generate_market_import_templates.py --top 12
  python data/generate_market_import_templates.py --ids super-mario-bros,the-legend-of-zelda
"""

import argparse
import json
import os

DATA_DIR = os.path.dirname(os.path.abspath(__file__))


def load_json(filename):
    path = os.path.join(DATA_DIR, filename)
    with open(path, encoding="utf-8") as file:
        return json.load(file)


def top_games(catalog, limit):
    return sorted(catalog, key=lambda game: (game.get("metascore") or 0, game.get("year") or 0), reverse=True)[:limit]


def pick_games(catalog, ids, limit):
    if ids:
      wanted = set(ids)
      return [game for game in catalog if game.get("id") in wanted]
    return top_games(catalog, limit)


def write_json(filename, payload):
    path = os.path.join(DATA_DIR, filename)
    with open(path, "w", encoding="utf-8") as file:
        json.dump(payload, file, ensure_ascii=False, indent=2)
        file.write("\n")
    return path


def main():
    parser = argparse.ArgumentParser(description="Generate RetroMarket import templates")
    parser.add_argument("--top", type=int, default=10, help="number of top games to include when --ids is not used")
    parser.add_argument("--ids", type=str, default="", help="comma-separated catalog ids")
    args = parser.parse_args()

    catalog = load_json("catalog.json")
    ids = [value.strip() for value in args.ids.split(",") if value.strip()]
    games = pick_games(catalog, ids, args.top)

    history_template = {}
    sales_template = {}
    sources_template = {}
    manifest = []

    for game in games:
        game_id = game["id"]
        history_template[game_id] = []
        sales_template[game_id] = []
        sources_template[game_id] = {
            "sourceType": "",
            "sourceName": "",
            "sourceUrl": "",
            "verifiedAt": "",
            "notes": ""
        }
        manifest.append({
            "id": game_id,
            "title": game.get("title"),
            "console": game.get("console"),
            "year": game.get("year"),
            "metascore": game.get("metascore")
        })

    history_path = write_json("market_history_template.json", history_template)
    sales_path = write_json("market_sales_template.json", sales_template)
    sources_path = write_json("market_sources_template.json", sources_template)
    manifest_path = write_json("market_import_manifest.json", manifest)

    print(f"Generated history template: {history_path}")
    print(f"Generated sales template: {sales_path}")
    print(f"Generated sources template: {sources_path}")
    print(f"Generated manifest: {manifest_path}")
    print(f"Games included: {len(games)}")


if __name__ == "__main__":
    main()
