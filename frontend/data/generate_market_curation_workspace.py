#!/usr/bin/env python3
"""
generate_market_curation_workspace.py
=====================================
Builds a readable first-batch curation workspace for RetroMarket.

Outputs:
- market_curation_batch_001.json
- market_curation_batch_001.md

The workspace does not fabricate verified prices. It only mirrors:
- priority games from market_import_manifest.json
- current local snapshot prices from prices.json
- empty slots for verified history, sales, and source metadata
"""

import json
import os
from datetime import date


DATA_DIR = os.path.dirname(os.path.abspath(__file__))


def load_json(filename):
    path = os.path.join(DATA_DIR, filename)
    with open(path, encoding="utf-8") as file:
        return json.load(file)


def write_json(filename, payload):
    path = os.path.join(DATA_DIR, filename)
    with open(path, "w", encoding="utf-8") as file:
        json.dump(payload, file, ensure_ascii=False, indent=2)
        file.write("\n")
    return path


def write_text(filename, payload):
    path = os.path.join(DATA_DIR, filename)
    with open(path, "w", encoding="utf-8") as file:
        file.write(payload)
    return path


def format_currency(value):
    if value in (None, ""):
        return "n/a"
    return f"${value}"


def build_workspace():
    manifest = load_json("market_import_manifest.json")
    prices = load_json("prices.json")
    history_template = load_json("market_history_template.json")
    sales_template = load_json("market_sales_template.json")
    sources_template = load_json("market_sources_template.json")

    price_by_game = {entry.get("game"): entry for entry in prices}

    items = []
    for rank, game in enumerate(manifest, start=1):
        game_id = game["id"]
        snapshot = price_by_game.get(game_id, {})
        history_items = history_template.get(game_id, [])
        sales_items = sales_template.get(game_id, [])
        source_item = sources_template.get(game_id, {
            "sourceType": "",
            "sourceName": "",
            "sourceUrl": "",
            "verifiedAt": "",
            "notes": ""
        })

        has_history = len(history_items) > 0
        has_sales = len(sales_items) > 0
        has_source = any(str(value).strip() for value in source_item.values())
        if has_history and has_sales and has_source:
            status = "verified_batch_ready"
        elif has_sales and has_source:
            status = "sales_and_source_captured"
        elif has_source:
            status = "source_captured"
        else:
            status = "pending_verification"

        items.append({
            "rank": rank,
            "id": game_id,
            "title": game.get("title"),
            "console": game.get("console"),
            "year": game.get("year"),
            "metascore": game.get("metascore"),
            "snapshot": {
                "loose": snapshot.get("loose"),
                "cib": snapshot.get("cib"),
                "mint": snapshot.get("mint"),
            },
            "verification": {
                "status": status,
                "history_points": len(history_items),
                "sales_entries": len(sales_items),
                "source": source_item,
            },
            "notes": [
                "Use only verified sources.",
                "Snapshot prices below are local references only; do not treat them as verified sales history."
            ]
        })

    payload = {
        "generatedAt": date.today().isoformat(),
        "batch": "001",
        "purpose": "First verified RetroMarket import batch",
        "items": items
    }
    return payload


def build_markdown(workspace):
    lines = [
        "# RetroMarket Curation Batch 001",
        "",
        "This workspace is a preparation layer for the first verified import batch.",
        "Snapshot prices below come from the local RetroDex price dataset and are only reference points.",
        "Verified history, sales, and source fields must be filled from real checked sources before rebuild.",
        "",
        "## Workflow",
        "1. Fill `market_history_template.json` with verified yearly points",
        "2. Fill `market_sales_template.json` with verified recent sales",
        "3. Fill `market_sources_template.json` with source metadata",
        "4. Run `python prototype_v2/data/refresh_market_imports.py`",
        "",
        "## Priority Games",
        "",
        "| # | Game | Console | Year | Meta | Snapshot Loose | Snapshot CIB | Snapshot Mint | Status |",
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ]

    for item in workspace["items"]:
        lines.append(
            f"| {item['rank']} | {item['title']} | {item['console']} | {item['year']} | {item['metascore']} | "
            f"{format_currency(item['snapshot']['loose'])} | {format_currency(item['snapshot']['cib'])} | "
            f"{format_currency(item['snapshot']['mint'])} | {item['verification']['status']} |"
        )

    lines.extend([
        "",
        "## Source Capture Checklist",
        "",
        "- Record exact source type and source name for every curated game.",
        "- Prefer auction archives, sold listings, or clearly attributable market databases.",
        "- Use ISO dates (`YYYY-MM-DD`) for sales entries.",
        "- Keep values numeric only in JSON templates.",
        ""
    ])

    return "\n".join(lines)


def main():
    workspace = build_workspace()
    json_path = write_json("market_curation_batch_001.json", workspace)
    md_path = write_text("market_curation_batch_001.md", build_markdown(workspace))
    print(f"Generated curation workspace: {json_path}")
    print(f"Generated curation notes: {md_path}")
    print(f"Games included: {len(workspace['items'])}")


if __name__ == "__main__":
    main()
