import json
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
CATALOG_PATH = BASE_DIR / "catalog.json"
ENTRIES_PATH = BASE_DIR / "entries.json"
OUTPUT_JSON_PATH = BASE_DIR / "demo_subset.json"
OUTPUT_JS_PATH = BASE_DIR / "demo_subset.js"


DEMO_SELECTION = {
    "Game Boy": [
        "tetris-game-boy",
        "pokemon-gold-game-boy",
        "pokemon-silver-game-boy",
        "oracle-of-ages-game-boy",
        "oracle-of-seasons-game-boy",
        "tetris-dx-game-boy",
        "the-legend-of-zelda-links-awakening-game-boy",
        "pokemon-red-game-boy",
        "metal-gear-ghost-babel-game-boy",
        "super-mario-land-2-game-boy",
    ],
    "Nintendo Entertainment System": [
        "super-mario-bros-3-nintendo-entertainment-system",
        "kirby-adventure-nintendo-entertainment-system",
        "the-legend-of-zelda-nintendo-entertainment-system",
        "mike-tysons-punch-out-nintendo-entertainment-system",
        "mega-man-2-nintendo-entertainment-system",
        "super-mario-bros-nintendo-entertainment-system",
        "contra-nintendo-entertainment-system",
        "castlevania-nintendo-entertainment-system",
        "duck-tales-nintendo-entertainment-system",
        "metroid-nintendo-entertainment-system",
    ],
    "Super Nintendo": [
        "yoshi-island-super-nintendo",
        "super-metroid-super-nintendo",
        "the-legend-of-zelda-a-link-to-the-past-super-nintendo",
        "super-mario-world-super-nintendo",
        "earthbound-super-nintendo",
        "final-fantasy-vi-super-nintendo",
        "donkey-kong-country-2-super-nintendo",
        "donkey-kong-country-super-nintendo",
        "secret-of-mana-super-nintendo",
        "super-mario-kart-super-nintendo",
    ],
    "PlayStation": [
        "tekken-3-playstation",
        "metal-gear-solid-playstation",
        "castlevania-symphony-of-the-night-playstation",
        "final-fantasy-vii-playstation",
        "vagrant-story-playstation",
        "resident-evil-2-playstation",
        "crash-bandicoot-playstation",
        "silent-hill-playstation",
        "final-fantasy-viii-playstation",
        "final-fantasy-tactics-playstation",
    ],
}


def main():
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    entries = json.loads(ENTRIES_PATH.read_text(encoding="utf-8"))
    games_by_id = {game["id"]: game for game in catalog}

    ordered_ids = []
    for console_name, ids in DEMO_SELECTION.items():
        for game_id in ids:
            game = games_by_id.get(game_id)
            if not game:
                raise SystemExit(f"Missing demo game id: {game_id}")
            if game.get("console") != console_name:
                raise SystemExit(
                    f"Console mismatch for {game_id}: expected {console_name}, got {game.get('console')}"
                )
            ordered_ids.append(game_id)

    entry_count = sum(1 for game_id in ordered_ids if game_id in entries)
    payload = {
        "id": "retrodex-demo-001",
        "label": "RetroDex Demo Set",
        "enabled": True,
        "minimumGames": 40,
        "requiredConsoles": {console_name: len(ids) for console_name, ids in DEMO_SELECTION.items()},
        "counts": {
            "games": len(ordered_ids),
            "consoles": len(DEMO_SELECTION),
            "entries": entry_count,
        },
        "ids": ordered_ids,
        "byConsole": DEMO_SELECTION,
    }

    OUTPUT_JSON_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    OUTPUT_JS_PATH.write_text(
        "window.RETRODEX_DEMO_SUBSET = "
        + json.dumps(payload, ensure_ascii=False, indent=2)
        + ";\n",
        encoding="utf-8",
    )

    print(f"Wrote {OUTPUT_JSON_PATH}")
    print(f"Wrote {OUTPUT_JS_PATH}")


if __name__ == "__main__":
    main()
