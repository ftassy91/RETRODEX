import json
import re
import unicodedata
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
ASSET_DIR = ROOT / "assets"
OUTPUT_JSON_PATH = DATA_DIR / "demo_subset_qa.json"
OUTPUT_MD_PATH = DATA_DIR / "demo_subset_qa.md"


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value or "")
    ascii_value = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    return re.sub(r"(^-|-$)", "", re.sub(r"[^a-z0-9]+", "-", ascii_value.lower()))


def load_asset_library_entries():
    raw = (DATA_DIR / "retrodeck_asset_library.js").read_text(encoding="utf-8")
    match = re.search(r"window\.RETRODECK_ASSET_LIBRARY\s*=\s*(\{.*\})\s*;\s*$", raw, re.S)
    if not match:
        return {}
    payload = json.loads(match.group(1))
    return payload.get("entries", {})


def summarize_game(game, entries, prices, library_entries):
    slug = slugify(game["title"])
    top_asset_candidates = [
        ("boxart", ASSET_DIR / "boxart" / f"{slug}.png"),
        ("titleScreen", ASSET_DIR / "titlescreens" / f"{slug}.png"),
        ("artwork", ASSET_DIR / "artwork" / f"{slug}.png"),
        ("gameplay", ASSET_DIR / "screenshots" / f"{slug}.png"),
        ("generated", ASSET_DIR / "generated_gb" / f"{slug}.png"),
        ("placeholder", ASSET_DIR / "placeholders" / "default.png"),
    ]
    available_assets = [label for label, path in top_asset_candidates if path.exists()]
    price = prices.get(game["id"], {})
    entry = entries.get(game["id"], {})
    library_entry = library_entries.get(game["id"], {})
    has_entry = game["id"] in entries
    bottom_card_ready = all([
        game.get("title"),
        game.get("console"),
        game.get("year"),
        game.get("rarity"),
        game["id"] in prices,
    ])
    if has_entry or game.get("developer"):
        bottom_card_ready = bottom_card_ready and True

    return {
        "id": game["id"],
        "title": game["title"],
        "console": game["console"],
        "year": game.get("year"),
        "metascore": game.get("metascore"),
        "rarity": game.get("rarity"),
        "hasEntry": has_entry,
        "hasPrice": game["id"] in prices,
        "priceRange": {
            "loose": price.get("loose"),
            "cib": price.get("cib"),
            "mint": price.get("mint"),
        },
        "localTopAssets": available_assets,
        "assetLibraryStatus": library_entry.get("status", "missing"),
        "assetLibrarySprite": bool(library_entry.get("sprite_path")),
        "bottomCardReady": bottom_card_ready,
        "notes": [
            note
            for note in [
                None if has_entry else "editorial fallback only",
                None if "generated" in available_assets else "no prebuilt generated_gb",
                None if available_assets[:-1] else "local top asset falls back to generated/placeholder path",
            ]
            if note
        ],
    }


def main():
    subset = json.loads((DATA_DIR / "demo_subset.json").read_text(encoding="utf-8"))
    catalog = {game["id"]: game for game in json.loads((DATA_DIR / "catalog.json").read_text(encoding="utf-8"))}
    entries = json.loads((DATA_DIR / "entries.json").read_text(encoding="utf-8"))
    prices = {row["game"]: row for row in json.loads((DATA_DIR / "prices.json").read_text(encoding="utf-8"))}
    library_entries = load_asset_library_entries()

    games = [catalog[game_id] for game_id in subset["ids"]]
    report_games = [summarize_game(game, entries, prices, library_entries) for game in games]
    payload = {
        "subsetId": subset["id"],
        "counts": {
            "games": len(report_games),
            "withEntry": sum(1 for game in report_games if game["hasEntry"]),
            "withPrice": sum(1 for game in report_games if game["hasPrice"]),
            "withGenerated": sum(1 for game in report_games if "generated" in game["localTopAssets"]),
            "withAnyLocalTopAsset": sum(1 for game in report_games if game["localTopAssets"][:-1]),
            "bottomCardReady": sum(1 for game in report_games if game["bottomCardReady"]),
        },
        "watchlist": [
            game["id"]
            for game in report_games
            if (not game["hasEntry"]) or ("generated" not in game["localTopAssets"])
        ],
        "games": report_games,
    }

    OUTPUT_JSON_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    lines = [
        "# RetroDex Demo Subset QA",
        "",
        f"- Games: `{payload['counts']['games']}`",
        f"- With editorial entry: `{payload['counts']['withEntry']}`",
        f"- With price data: `{payload['counts']['withPrice']}`",
        f"- With prebuilt generated GB: `{payload['counts']['withGenerated']}`",
        f"- With any local top asset: `{payload['counts']['withAnyLocalTopAsset']}`",
        f"- Bottom card ready: `{payload['counts']['bottomCardReady']}`",
        "",
        "## Watchlist",
    ]
    if payload["watchlist"]:
        lines.extend([f"- `{game_id}`" for game_id in payload["watchlist"]])
    else:
        lines.append("- none")

    lines.extend(["", "## Per Game"])
    for game in report_games:
        local_assets = ", ".join(game["localTopAssets"]) if game["localTopAssets"] else "none"
        notes = "; ".join(game["notes"]) if game["notes"] else "clean"
        lines.append(
            f"- `{game['id']}` | {game['title']} | local top assets: {local_assets} | entry: {game['hasEntry']} | bottom card: {game['bottomCardReady']} | notes: {notes}"
        )

    OUTPUT_MD_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT_JSON_PATH}")
    print(f"Wrote {OUTPUT_MD_PATH}")


if __name__ == "__main__":
    main()
