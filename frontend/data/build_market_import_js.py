#!/usr/bin/env python3
"""
build_market_import_js.py
=========================
Builds RetroMarket JS import files from JSON source files.

Source files:
- market_history_template.json
- market_sales_template.json
- market_sources_template.json

Outputs:
- market_history.js
- market_sales.js
- market_sources.js
"""

import json
import os

DATA_DIR = os.path.dirname(os.path.abspath(__file__))


def load_json(filename):
    path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(path):
        return {}
    with open(path, encoding="utf-8") as file:
        return json.load(file)


def write_js(filename, var_name, payload):
    path = os.path.join(DATA_DIR, filename)
    with open(path, "w", encoding="utf-8") as file:
        file.write(f"window.{var_name} = ")
        json.dump(payload, file, ensure_ascii=False, indent=2)
        file.write(";\n")
    return path


def main():
    history = load_json("market_history_template.json")
    sales = load_json("market_sales_template.json")
    sources = load_json("market_sources_template.json")

    history_path = write_js("market_history.js", "MARKET_HISTORY_DATA", history)
    sales_path = write_js("market_sales.js", "MARKET_SALES_DATA", sales)
    sources_path = write_js("market_sources.js", "MARKET_SOURCE_DATA", sources)

    print(f"Built JS file: {history_path}")
    print(f"Built JS file: {sales_path}")
    print(f"Built JS file: {sources_path}")


if __name__ == "__main__":
    main()
