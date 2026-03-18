#!/usr/bin/env python3
"""
generate_market_coverage_report.py
==================================
Generates RetroMarket coverage reports in JSON and Markdown.
"""

import json
import os
import re

DATA_DIR = os.path.dirname(os.path.abspath(__file__))


def load_json(filename):
    with open(os.path.join(DATA_DIR, filename), encoding="utf-8") as file:
        return json.load(file)


def load_window_object(filename, var_name):
    with open(os.path.join(DATA_DIR, filename), encoding="utf-8") as file:
        content = file.read().strip()
    match = re.search(rf"window\.{re.escape(var_name)}\s*=\s*(.+?);?\s*$", content, re.DOTALL)
    if not match:
        return {}
    payload = match.group(1).strip()
    if payload.startswith(f"window.{var_name} ||"):
        return {}
    return json.loads(payload)


def write_json(filename, payload):
    path = os.path.join(DATA_DIR, filename)
    with open(path, "w", encoding="utf-8") as file:
        json.dump(payload, file, ensure_ascii=False, indent=2)
        file.write("\n")
    return path


def write_text(filename, content):
    path = os.path.join(DATA_DIR, filename)
    with open(path, "w", encoding="utf-8") as file:
        file.write(content)
    return path


def main():
    catalog = load_json("catalog.json")
    history = load_window_object("market_history.js", "MARKET_HISTORY_DATA")
    sales = load_window_object("market_sales.js", "MARKET_SALES_DATA")
    sources = load_window_object("market_sources.js", "MARKET_SOURCE_DATA")

    console_map = {}
    for game in catalog:
      console = game.get("console", "Unknown")
      current = console_map.get(console, {"console": console, "total": 0, "history": 0, "sales": 0, "sources": 0})
      current["total"] += 1
      if game["id"] in history and history[game["id"]]:
          current["history"] += 1
      if game["id"] in sales and sales[game["id"]]:
          current["sales"] += 1
      if game["id"] in sources and any(str(value).strip() for value in sources[game["id"]].values()):
          current["sources"] += 1
      console_map[console] = current

    report = {
        "tracked_games": len(catalog),
        "history_games": sum(1 for value in history.values() if value),
        "sales_games": sum(1 for value in sales.values() if value),
        "source_games": sum(1 for value in sources.values() if any(str(v).strip() for v in value.values())),
        "console_coverage": sorted(console_map.values(), key=lambda item: (-(item["history"] + item["sales"] + item["sources"]), item["console"]))
    }

    json_path = write_json("market_coverage_report.json", report)

    lines = [
        "# RetroMarket Coverage Report",
        "",
        f"- Tracked games: {report['tracked_games']}",
        f"- History games: {report['history_games']}",
        f"- Sales games: {report['sales_games']}",
        f"- Source games: {report['source_games']}",
        "",
        "## Console Coverage",
        ""
    ]

    for row in report["console_coverage"]:
        lines.append(f"- {row['console']}: total {row['total']} | history {row['history']} | sales {row['sales']} | sources {row['sources']}")

    md_path = write_text("market_coverage_report.md", "\n".join(lines) + "\n")

    print(f"Generated report: {json_path}")
    print(f"Generated report: {md_path}")


if __name__ == "__main__":
    main()
