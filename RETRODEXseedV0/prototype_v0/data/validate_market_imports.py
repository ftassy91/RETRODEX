#!/usr/bin/env python3
"""
validate_market_imports.py - RetroMarket import validator
=========================================================
Checks the integrity of market_history.js, market_sales.js and market_sources.js.
Returns exit code 0 when everything is valid, 1 when anomalies are detected.

Usage:
  python data/validate_market_imports.py
  python data/validate_market_imports.py --verbose
"""

import json
import os
import re
import sys
from datetime import datetime

DATA_DIR = os.path.dirname(os.path.abspath(__file__))
VERBOSE = "--verbose" in sys.argv or "-v" in sys.argv

errors = []
warnings = []

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def err(msg):
    errors.append(f"  [ERROR] {msg}")


def warn(msg):
    warnings.append(f"  [WARN]  {msg}")


def ok(msg):
    if VERBOSE:
        print(f"  [OK]    {msg}")


def load_json(filename):
    path = os.path.join(DATA_DIR, filename)
    with open(path, encoding="utf-8") as file:
        return json.load(file)


def load_window_object(filename, var_name):
    path = os.path.join(DATA_DIR, filename)
    with open(path, encoding="utf-8") as file:
        content = file.read().strip()

    pattern = rf"window\.{re.escape(var_name)}\s*=\s*(.+?);?\s*$"
    match = re.search(pattern, content, re.DOTALL)
    if not match:
        raise ValueError(f"{filename} does not assign window.{var_name}")

    payload = match.group(1).strip()
    if payload.startswith(f"window.{var_name} ||"):
        return {}
    return json.loads(payload)


def validate_history(history_data, valid_ids):
    print("\n[market_history.js]")
    game_count = 0
    point_count = 0

    if not isinstance(history_data, dict):
        err("market_history.js must contain an object keyed by game id")
        return 0, 0

    for game_id, items in history_data.items():
        if game_id not in valid_ids:
            err(f"history import references unknown game id '{game_id}'")

        if not isinstance(items, list):
            err(f"history import for '{game_id}' must be an array")
            continue

        if items:
            game_count += 1

        seen_years = set()
        last_year = None
        for index, entry in enumerate(items, start=1):
            ref = f"{game_id} history #{index}"
            point_count += 1
            if not isinstance(entry, dict):
                err(f"{ref} must be an object")
                continue

            year = entry.get("year")
            value = entry.get("value")

            if not isinstance(year, int):
                err(f"{ref} - year must be an integer")
            elif year < 1970 or year > 2035:
                err(f"{ref} - year {year} outside [1970-2035]")
            else:
                if year in seen_years:
                    warn(f"{ref} - duplicate year {year}")
                seen_years.add(year)
                if last_year is not None and year < last_year:
                    warn(f"{ref} - history is not sorted by year")
                last_year = year

            if not isinstance(value, (int, float)):
                err(f"{ref} - value must be numeric")
            elif value < 0:
                err(f"{ref} - value cannot be negative")

    ok(f"{game_count} games with imported history, {point_count} total points")
    return game_count, point_count


def validate_sales(sales_data, valid_ids):
    print("\n[market_sales.js]")
    game_count = 0
    sale_count = 0
    valid_conditions = {"Loose", "CIB", "Sealed", "Incomplete", "Unknown"}

    if not isinstance(sales_data, dict):
        err("market_sales.js must contain an object keyed by game id")
        return 0, 0

    for game_id, items in sales_data.items():
        if game_id not in valid_ids:
            err(f"sales import references unknown game id '{game_id}'")

        if not isinstance(items, list):
            err(f"sales import for '{game_id}' must be an array")
            continue

        if items:
            game_count += 1

        for index, entry in enumerate(items, start=1):
            ref = f"{game_id} sale #{index}"
            sale_count += 1
            if not isinstance(entry, dict):
                err(f"{ref} must be an object")
                continue

            date = entry.get("date")
            price = entry.get("price")
            condition = entry.get("condition", "Unknown")

            if not isinstance(date, str):
                err(f"{ref} - date must be a string")
            else:
                try:
                    datetime.strptime(date, "%Y-%m-%d")
                except ValueError:
                    warn(f"{ref} - date should follow YYYY-MM-DD")

            if not isinstance(price, (int, float)):
                err(f"{ref} - price must be numeric")
            elif price < 0:
                err(f"{ref} - price cannot be negative")

            if not isinstance(condition, str):
                err(f"{ref} - condition must be a string")
            elif condition not in valid_conditions:
                warn(f"{ref} - condition '{condition}' is outside known values {sorted(valid_conditions)}")

    ok(f"{game_count} games with imported sales, {sale_count} total sales")
    return game_count, sale_count


def validate_sources(source_data, valid_ids):
    print("\n[market_sources.js]")
    game_count = 0

    if not isinstance(source_data, dict):
        err("market_sources.js must contain an object keyed by game id")
        return 0

    for game_id, entry in source_data.items():
        if game_id not in valid_ids:
            err(f"source import references unknown game id '{game_id}'")

        if not isinstance(entry, dict):
            err(f"source import for '{game_id}' must be an object")
            continue

        if any(str(value).strip() for value in entry.values()):
            game_count += 1

        for field in ["sourceType", "sourceName", "sourceUrl", "verifiedAt", "notes"]:
            if field in entry and entry[field] not in ("", None) and not isinstance(entry[field], str):
                err(f"{game_id} source - field '{field}' must be a string")

        source_url = entry.get("sourceUrl", "")
        if source_url and not source_url.startswith(("http://", "https://")):
            warn(f"{game_id} source - sourceUrl should start with http:// or https://")

        verified_at = entry.get("verifiedAt", "")
        if verified_at:
            try:
                datetime.strptime(verified_at, "%Y-%m-%d")
            except ValueError:
                warn(f"{game_id} source - verifiedAt should follow YYYY-MM-DD")

    ok(f"{game_count} games with source metadata")
    return game_count


def print_stats(history_games, history_points, sales_games, sales_count, source_games):
    print("\n[Stats]")
    print(f"  History games : {history_games}")
    print(f"  History points: {history_points}")
    print(f"  Sales games   : {sales_games}")
    print(f"  Sales entries : {sales_count}")
    print(f"  Source games  : {source_games}")


def main():
    print("=" * 58)
    print(" RetroMarket - Import validator")
    print("=" * 58)

    try:
        catalog = load_json("catalog.json")
        history_data = load_window_object("market_history.js", "MARKET_HISTORY_DATA")
        sales_data = load_window_object("market_sales.js", "MARKET_SALES_DATA")
        source_data = load_window_object("market_sources.js", "MARKET_SOURCE_DATA")
    except FileNotFoundError as error:
        print(f"\n[ERROR] Missing file: {error}")
        sys.exit(1)
    except (json.JSONDecodeError, ValueError) as error:
        print(f"\n[ERROR] Invalid import format: {error}")
        sys.exit(1)

    valid_ids = {game.get("id") for game in catalog if game.get("id")}
    history_games, history_points = validate_history(history_data, valid_ids)
    sales_games, sales_count = validate_sales(sales_data, valid_ids)
    source_games = validate_sources(source_data, valid_ids)

    if VERBOSE:
        print_stats(history_games, history_points, sales_games, sales_count, source_games)

    print("\n" + "=" * 58)
    if errors:
        print(f" [ERROR] {len(errors)} error(s) detected:")
        for error in errors:
            print(error)
        if warnings:
            print(f"\n [WARN] {len(warnings)} warning(s):")
            for warning in warnings:
                print(warning)
        print("=" * 58)
        print(" Fix the errors before using imported market data.")
        print("=" * 58)
        sys.exit(1)

    if warnings:
        print(f" [WARN] {len(warnings)} warning(s):")
        for warning in warnings:
            print(warning)
        print()

    print(" [OK] Market imports are valid.")
    print("=" * 58)
    sys.exit(0)


if __name__ == "__main__":
    main()
