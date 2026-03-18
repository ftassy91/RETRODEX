#!/usr/bin/env python3
"""
validate.py - RetroDex data validator
=====================================
Checks the integrity of catalog.json, prices.json and consoles.json.
Returns exit code 0 when everything is valid, 1 when anomalies are detected.

Usage:
  python data/validate.py
  python data/validate.py --verbose
"""

import json
import os
import sys

DATA_DIR = os.path.dirname(os.path.abspath(__file__))
VERBOSE = "--verbose" in sys.argv or "-v" in sys.argv

REQUIRED_CATALOG_FIELDS = ["id", "title", "console", "developer", "year", "metascore", "rarity"]
VALID_RARITIES = {"COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY"}
VALID_CONSOLE_TYPES = {"Home", "Handheld"}
VALID_GENS = {3, 4, 5, 6, 7}
YEAR_MIN, YEAR_MAX = 1970, 2030
METASCORE_MIN = 0
METASCORE_MAX = 100
PRICE_MIN = 0
PRICE_MAX = 10_000

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


def load(filename):
    path = os.path.join(DATA_DIR, filename)
    with open(path, encoding="utf-8") as file:
        return json.load(file)


def validate_catalog(catalog):
    print("\n[catalog.json]")
    ids_seen = {}

    for index, game in enumerate(catalog, start=1):
        ref = f"game #{index} ({game.get('id', '?')})"

        for field in REQUIRED_CATALOG_FIELDS:
            if field not in game or game[field] is None or game[field] == "":
                err(f"{ref} - missing or empty field '{field}'")

        game_id = game.get("id")
        if game_id:
            if game_id in ids_seen:
                err(f"duplicate id '{game_id}' (lines {ids_seen[game_id]} and {index})")
            ids_seen[game_id] = index

        rarity = game.get("rarity", "")
        if rarity not in VALID_RARITIES:
            err(f"{ref} - invalid rarity '{rarity}' (expected one of {sorted(VALID_RARITIES)})")

        year = game.get("year")
        if isinstance(year, int) and not (YEAR_MIN <= year <= YEAR_MAX):
            err(f"{ref} - year {year} outside [{YEAR_MIN}-{YEAR_MAX}]")

        meta = game.get("metascore")
        if isinstance(meta, (int, float)):
            if not (METASCORE_MIN <= meta <= METASCORE_MAX):
                err(f"{ref} - metascore {meta} outside [0-100]")
        elif meta is not None:
            err(f"{ref} - metascore is not numeric: {meta!r}")

    ok(f"{len(catalog)} games checked, {len(ids_seen)} unique ids")
    return set(ids_seen.keys())


def validate_prices(prices, valid_game_ids):
    print("\n[prices.json]")
    game_refs_seen = {}

    for index, entry in enumerate(prices, start=1):
        ref = f"entry #{index}"
        game_id = entry.get("game")

        if not game_id:
            err(f"{ref} - missing 'game' field")
            continue

        if game_id not in valid_game_ids:
            err(f"{ref} - game '{game_id}' not found in catalog.json")

        if game_id in game_refs_seen:
            warn(f"game '{game_id}' appears twice in prices (lines {game_refs_seen[game_id]} and {index})")
        game_refs_seen[game_id] = index

        for field in ["loose", "cib", "mint"]:
            value = entry.get(field)
            if value is None:
                err(f"{ref} ({game_id}) - missing field '{field}'")
            elif not isinstance(value, (int, float)):
                err(f"{ref} ({game_id}) - '{field}' is not numeric: {value!r}")
            elif value < PRICE_MIN:
                err(f"{ref} ({game_id}) - '{field}' is negative: {value}")
            elif value > PRICE_MAX:
                warn(f"{ref} ({game_id}) - '{field}' is high ({value}$), please verify")

        loose = entry.get("loose", 0)
        mint = entry.get("mint", 0)
        if isinstance(loose, (int, float)) and isinstance(mint, (int, float)):
            if loose > mint * 2:
                warn(f"{ref} ({game_id}) - loose ({loose}$) is unusually high vs mint ({mint}$)")

    ok(f"{len(prices)} entries checked, {len(game_refs_seen)} referenced games")


def validate_consoles(consoles, catalog_consoles):
    print("\n[consoles.json]")
    names_seen = set()

    for index, console in enumerate(consoles, start=1):
        ref = f"console #{index} ({console.get('name', '?')})"

        for field in ["name", "maker", "release", "gen", "type"]:
            if field not in console or console[field] is None or console[field] == "":
                err(f"{ref} - missing or empty field '{field}'")

        name = console.get("name", "")
        if name in names_seen:
            err(f"duplicate console '{name}'")
        names_seen.add(name)

        gen = console.get("gen")
        if gen not in VALID_GENS:
            warn(f"{ref} - generation {gen} is outside known values {VALID_GENS}")

        console_type = console.get("type", "")
        if console_type not in VALID_CONSOLE_TYPES:
            warn(f"{ref} - unknown type '{console_type}' (expected {VALID_CONSOLE_TYPES})")

        release = console.get("release")
        if isinstance(release, int) and not (YEAR_MIN <= release <= YEAR_MAX):
            err(f"{ref} - release {release} outside [{YEAR_MIN}-{YEAR_MAX}]")

    missing = catalog_consoles - names_seen
    if missing:
        err(f"consoles referenced in catalog but missing from consoles.json: {sorted(missing)}")

    unused = names_seen - catalog_consoles
    if unused:
        warn(f"consoles present without games in catalog: {sorted(unused)}")

    ok(f"{len(consoles)} consoles checked")


def print_stats(catalog, prices, consoles):
    print("\n[Stats]")
    total_price = sum(
        price.get("mint", 0)
        for price in prices
        if isinstance(price.get("mint"), (int, float))
    )
    coverage = (len(prices) / len(catalog) * 100) if catalog else 0
    print(f"  Catalog      : {len(catalog)} games")
    print(f"  Prices       : {len(prices)} ({coverage:.0f}% coverage)")
    print(f"  Consoles     : {len(consoles)} systems")
    print(f"  Total mint   : ${total_price:,.0f}")

    rarities = {}
    for game in catalog:
        rarity = game.get("rarity", "UNKNOWN")
        rarities[rarity] = rarities.get(rarity, 0) + 1

    for rarity, count in sorted(rarities.items()):
        share = (count / len(catalog) * 100) if catalog else 0
        print(f"    {rarity:12} : {count:4} games ({share:.0f}%)")


def main():
    print("=" * 54)
    print(" RetroDex - Data validator")
    print("=" * 54)

    try:
        catalog = load("catalog.json")
        prices = load("prices.json")
        consoles = load("consoles.json")
    except FileNotFoundError as error:
        print(f"\n[ERROR] Missing file: {error}")
        sys.exit(1)
    except json.JSONDecodeError as error:
        print(f"\n[ERROR] Invalid JSON: {error}")
        sys.exit(1)

    catalog_game_ids = validate_catalog(catalog)
    catalog_console_names = {game.get("console", "") for game in catalog}
    validate_prices(prices, catalog_game_ids)
    validate_consoles(consoles, catalog_console_names)

    if VERBOSE:
        print_stats(catalog, prices, consoles)

    print("\n" + "=" * 54)
    if errors:
        print(f" [ERROR] {len(errors)} error(s) detected:")
        for error in errors:
            print(error)
        if warnings:
            print(f"\n [WARN] {len(warnings)} warning(s):")
            for warning in warnings:
                print(warning)
        print("=" * 54)
        print(" Fix the errors before regenerating JS data files.")
        print("=" * 54)
        sys.exit(1)

    if warnings:
        print(f" [WARN] {len(warnings)} warning(s):")
        for warning in warnings:
            print(warning)
        print()

    print(" [OK] Data is valid - safe to regenerate JS data files.")
    print("=" * 54)
    sys.exit(0)


if __name__ == "__main__":
    main()
