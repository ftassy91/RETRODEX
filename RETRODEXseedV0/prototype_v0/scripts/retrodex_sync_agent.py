#!/usr/bin/env python3
"""Local-first sync bootstrap for the RETRODEXseedV0 static prototype."""

from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4


ROOT = Path(__file__).resolve().parents[1]
LOG_DIR = ROOT / "logs"
CHECKPOINT_DIR = LOG_DIR / "checkpoints"
EXPORT_DIR = ROOT / "data" / "notion_exports"
STATE_PATH = LOG_DIR / "sync_state.json"
SYNC_LOG_PATH = LOG_DIR / "codex_sync_log.jsonl"
NOTION_QUEUE_PATH = LOG_DIR / "notion_sync_queue.jsonl"
NOTION_ERROR_PATH = LOG_DIR / "notion_sync_errors.jsonl"
AUDIT_REPORT_PATH = LOG_DIR / "latest_audit.json"
READINESS_PATH = LOG_DIR / "vercel_build_readiness.json"
GAMES_EXPORT_PATH = EXPORT_DIR / "retrodex_games_sync_preview.json"
ASSETS_EXPORT_PATH = EXPORT_DIR / "retrodex_assets_sync_preview.json"
MARKET_EXPORT_PATH = EXPORT_DIR / "retrodex_market_sync_preview.json"
SYNC_EXPORT_SUMMARY_PATH = EXPORT_DIR / "retrodex_sync_export_summary.json"
GAMES_BACKLOG_PATH = EXPORT_DIR / "retrodex_games_curation_backlog.json"
ASSET_BACKLOG_PATH = EXPORT_DIR / "retrodex_asset_reconciliation_backlog.json"
CONFIG_PATH = ROOT / "scripts" / "retrodex_sync_config.json"
CONFIG_EXAMPLE_PATH = ROOT / "scripts" / "retrodex_sync_config.example.json"
NOTION_QUEUE_ARCHIVE_PATH = LOG_DIR / "notion_sync_queue_archive.jsonl"

IGNORED_PARTS = {
    ".git",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    "node_modules",
    "logs",
}

ASSET_FOLDERS = [
    "boxart",
    "sprites",
    "top-screen",
    "generated_gb",
    "artwork",
    "screenshots",
    "titlescreens",
]


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def ensure_dirs() -> None:
    CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)


def read_json(path: Path, default: Any = None) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")


def append_jsonl(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(payload, ensure_ascii=True) + "\n")


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        rows.append(json.loads(stripped))
    return rows


def sha1_file(path: Path) -> str:
    digest = hashlib.sha1()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def should_track(path: Path) -> bool:
    if not path.is_file():
        return False
    relative = path.relative_to(ROOT)
    if any(part in IGNORED_PARTS for part in relative.parts):
        return False
    if relative.as_posix().startswith("data/notion_exports/"):
        return False
    return True


def snapshot_files() -> dict[str, dict[str, Any]]:
    snapshot: dict[str, dict[str, Any]] = {}
    for path in sorted(ROOT.rglob("*")):
        if not should_track(path):
            continue
        relative = path.relative_to(ROOT).as_posix()
        stat = path.stat()
        snapshot[relative] = {
            "size": stat.st_size,
            "mtime_ns": stat.st_mtime_ns,
            "sha1": sha1_file(path),
        }
    return snapshot


def classify_path(relative_path: str) -> str:
    if relative_path.startswith(("assets/", "retrodeck_assets/")):
        return "assets"
    if relative_path.startswith(("data/", "datapack/")):
        return "data"
    if relative_path.startswith(("data_engine/", "scripts/")):
        return "automation"
    if relative_path.startswith(("css/", "js/", "modules/")) or relative_path.endswith(".html"):
        return "frontend"
    if relative_path.startswith(("memory/", "docs/", "review/")) or relative_path.endswith(".md"):
        return "docs"
    return "other"


def is_frontend_path(relative_path: str) -> bool:
    return (
        relative_path.startswith(("assets/", "css/", "js/", "modules/"))
        or relative_path.endswith(".html")
    )


def summarize_changes(
    previous: dict[str, dict[str, Any]],
    current: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    previous_keys = set(previous)
    current_keys = set(current)

    added = sorted(current_keys - previous_keys)
    removed = sorted(previous_keys - current_keys)
    modified = sorted(
        path for path in (previous_keys & current_keys) if previous[path]["sha1"] != current[path]["sha1"]
    )

    changed_paths = added + modified + removed
    area_counts = Counter(classify_path(path) for path in changed_paths)

    return {
        "added": added,
        "modified": modified,
        "removed": removed,
        "counts": {
            "added": len(added),
            "modified": len(modified),
            "removed": len(removed),
            "total": len(changed_paths),
        },
        "area_counts": dict(sorted(area_counts.items())),
        "frontend_impact": any(is_frontend_path(path) for path in changed_paths),
    }


def load_catalog_snapshot() -> dict[str, Any]:
    catalog_path = ROOT / "data" / "catalog.json"
    catalog = read_json(catalog_path, default=[])
    years: list[int] = []
    for item in catalog if isinstance(catalog, list) else []:
        try:
            years.append(int(item.get("year")))
        except (TypeError, ValueError):
            continue
    target_count = sum(1 for year in years if 1990 <= year <= 2012)
    return {
        "path": catalog_path.relative_to(ROOT).as_posix(),
        "games": len(catalog) if isinstance(catalog, list) else 0,
        "release_year_min": min(years) if years else None,
        "release_year_max": max(years) if years else None,
        "games_in_target_window_1990_2012": target_count,
    }


def load_catalog_records() -> list[dict[str, Any]]:
    catalog = read_json(ROOT / "data" / "catalog.json", default=[])
    return catalog if isinstance(catalog, list) else []


def load_entries_map() -> dict[str, Any]:
    entries = read_json(ROOT / "data" / "entries.json", default={})
    return entries if isinstance(entries, dict) else {}


def load_prices_map() -> dict[str, dict[str, Any]]:
    prices = read_json(ROOT / "data" / "prices.json", default=[])
    if not isinstance(prices, list):
        return {}
    result: dict[str, dict[str, Any]] = {}
    for item in prices:
        if not isinstance(item, dict):
            continue
        game_id = item.get("game")
        if isinstance(game_id, str):
            result[game_id] = item
    return result


def read_js_assignment(path: Path) -> Any:
    raw = path.read_text(encoding="utf-8-sig").strip()
    _, _, payload = raw.partition("=")
    payload = payload.strip()
    if payload.endswith(";"):
        payload = payload[:-1]
    return json.loads(payload)


def load_market_data() -> dict[str, Any]:
    sales = read_js_assignment(ROOT / "data" / "market_sales.js")
    history = read_js_assignment(ROOT / "data" / "market_history.js")
    sources = read_js_assignment(ROOT / "data" / "market_sources.js")
    manifest = read_json(ROOT / "data" / "market_import_manifest.json", default=[])
    coverage = read_json(ROOT / "data" / "market_coverage_report.json", default={})
    return {
        "sales": sales if isinstance(sales, dict) else {},
        "history": history if isinstance(history, dict) else {},
        "sources": sources if isinstance(sources, dict) else {},
        "manifest": manifest if isinstance(manifest, list) else [],
        "coverage": coverage if isinstance(coverage, dict) else {},
    }


def load_asset_metadata_map() -> dict[str, dict[str, Any]]:
    metadata_map: dict[str, dict[str, Any]] = {}
    for metadata_path in (ROOT / "retrodeck_assets").rglob("metadata.json"):
        if "_cache" in metadata_path.parts:
            continue
        metadata = read_json(metadata_path, default={})
        if not isinstance(metadata, dict):
            continue
        game_id = metadata.get("game_id")
        if isinstance(game_id, str):
            metadata_map[game_id] = metadata
    return metadata_map


def safe_match_catalog_id(stem: str, catalog_ids: set[str]) -> tuple[str | None, str]:
    if stem in catalog_ids:
        return stem, "exact"

    candidates = sorted(
        game_id for game_id in catalog_ids if game_id == stem or game_id.startswith(f"{stem}-")
    )
    if len(candidates) == 1:
        return candidates[0], "unique_prefix"

    normalized = stem.replace("_", "-")
    if normalized in catalog_ids:
        return normalized, "underscore_normalized"

    normalized_candidates = sorted(
        game_id
        for game_id in catalog_ids
        if game_id == normalized or game_id.startswith(f"{normalized}-")
    )
    if len(normalized_candidates) == 1:
        return normalized_candidates[0], "normalized_unique_prefix"

    return None, "unmatched"


def suggest_catalog_ids(stem: str, catalog_by_id: dict[str, dict[str, Any]], limit: int = 5) -> list[dict[str, Any]]:
    normalized = stem.replace("_", "-").lower()
    stem_tokens = [token for token in normalized.split("-") if token]
    if not stem_tokens:
        return []

    scored: list[tuple[float, str]] = []
    for game_id in catalog_by_id:
        game_tokens = set(game_id.split("-"))
        overlap = sum(1 for token in stem_tokens if token in game_tokens)
        if overlap == 0:
            continue
        prefix_bonus = 1.0 if game_id.startswith(normalized) else 0.0
        score = overlap / max(len(stem_tokens), 1) + prefix_bonus
        scored.append((score, game_id))

    scored.sort(key=lambda item: (-item[0], item[1]))
    suggestions: list[dict[str, Any]] = []
    for score, game_id in scored[:limit]:
        catalog_item = catalog_by_id[game_id]
        suggestions.append(
            {
                "game_id": game_id,
                "title": catalog_item.get("title"),
                "platform": catalog_item.get("console"),
                "score": round(score, 3),
            }
        )
    return suggestions


def build_asset_exports(
    catalog_by_id: dict[str, dict[str, Any]],
    asset_metadata_by_game: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    catalog_ids = set(catalog_by_id)
    direct_records: list[dict[str, Any]] = []
    pipeline_records: list[dict[str, Any]] = []
    unmatched_files: list[str] = []

    for folder_name in ASSET_FOLDERS:
        folder = ROOT / "assets" / folder_name
        if not folder.exists():
            continue
        for path in sorted(folder.rglob("*")):
            if not path.is_file() or path.suffix.lower() not in {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}:
                continue
            relative = path.relative_to(ROOT).as_posix()
            stem = path.stem
            sidecar_path = path.with_suffix(".json")
            game_id = None
            matching_method = "unmatched"

            if sidecar_path.exists():
                sidecar = read_json(sidecar_path, default={})
                if isinstance(sidecar, dict):
                    source_value = sidecar.get("source")
                    if isinstance(source_value, str):
                        parts = source_value.replace("\\", "/").split("/")
                        if "retrodeck_assets" in parts:
                            base_index = parts.index("retrodeck_assets")
                            if base_index + 1 < len(parts):
                                inferred = parts[base_index + 1].replace("_", "-")
                                if inferred in catalog_ids:
                                    game_id = inferred
                                    matching_method = "generated_sidecar_source"

            if game_id is None:
                game_id, matching_method = safe_match_catalog_id(stem, catalog_ids)

            catalog_item = catalog_by_id.get(game_id) if game_id else None
            if not catalog_item:
                unmatched_files.append(relative)

            direct_records.append(
                {
                    "asset_path": relative,
                    "asset_folder": folder_name,
                    "asset_file": path.name,
                    "asset_extension": path.suffix.lower(),
                    "asset_bytes": path.stat().st_size,
                    "game_id": game_id,
                    "title": catalog_item.get("title") if catalog_item else None,
                    "platform": catalog_item.get("console") if catalog_item else None,
                    "matching_method": matching_method,
                    "sidecar_path": sidecar_path.relative_to(ROOT).as_posix() if sidecar_path.exists() else None,
                }
            )

    for game_id, metadata in sorted(asset_metadata_by_game.items()):
        catalog_item = catalog_by_id.get(game_id, {})
        pipeline_records.append(
            {
                "game_id": game_id,
                "title": metadata.get("game") or catalog_item.get("title"),
                "platform": metadata.get("console") or catalog_item.get("console"),
                "release_year": metadata.get("year") or catalog_item.get("year"),
                "publisher": metadata.get("publisher"),
                "asset_type": metadata.get("asset_type"),
                "source_type": metadata.get("source_type"),
                "selection_reason": metadata.get("selection_reason"),
                "sprite_path": metadata.get("sprite_path"),
                "asset_dir": metadata.get("asset_dir"),
                "episode": metadata.get("episode_number"),
            }
        )

    return {
        "generated_at": utc_now(),
        "summary": {
            "direct_asset_records": len(direct_records),
            "pipeline_asset_records": len(pipeline_records),
            "matched_direct_assets": sum(1 for record in direct_records if record["game_id"]),
            "unmatched_direct_assets": len(unmatched_files),
        },
        "unmatched_asset_files": unmatched_files,
        "direct_asset_records": direct_records,
        "pipeline_asset_records": pipeline_records,
    }


def build_games_export(
    catalog: list[dict[str, Any]],
    entries: dict[str, Any],
    prices_map: dict[str, dict[str, Any]],
    assets_export: dict[str, Any],
    asset_metadata_by_game: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    core_fields = ["title", "platform", "release_year", "genre", "developer"]
    enrichment_fields = ["publisher", "franchise"]
    asset_refs_by_game: dict[str, list[str]] = {}
    for record in assets_export["direct_asset_records"]:
        game_id = record.get("game_id")
        if not isinstance(game_id, str):
            continue
        asset_refs_by_game.setdefault(game_id, []).append(record["asset_path"])

    records: list[dict[str, Any]] = []
    for item in sorted(catalog, key=lambda current: (int(current.get("year", 0)), str(current.get("title", "")))):
        try:
            year = int(item.get("year"))
        except (TypeError, ValueError):
            year = None
        if year is None or not (1990 <= year <= 2012):
            continue

        game_id = item.get("id")
        if not isinstance(game_id, str):
            continue

        entry = entries.get(game_id, {}) if isinstance(entries.get(game_id), dict) else {}
        price = prices_map.get(game_id, {})
        metadata = asset_metadata_by_game.get(game_id, {})

        record = {
            "game_id": game_id,
            "title": item.get("title"),
            "platform": item.get("console"),
            "release_year": year,
            "genre": entry.get("genre"),
            "developer": item.get("developer"),
            "publisher": metadata.get("publisher"),
            "franchise": None,
            "episode": metadata.get("episode_number"),
            "metascore": item.get("metascore"),
            "rarity": item.get("rarity"),
            "summary_present": bool(entry.get("summary")),
            "price_loose": price.get("loose"),
            "price_cib": price.get("cib"),
            "price_mint": price.get("mint"),
            "asset_references": sorted(asset_refs_by_game.get(game_id, [])),
        }
        record["core_missing_fields"] = [
            field for field in core_fields if record.get(field) in (None, "", [])
        ]
        record["enrichment_missing_fields"] = [
            field for field in enrichment_fields if record.get(field) in (None, "", [])
        ]
        record["missing_fields"] = record["core_missing_fields"] + record["enrichment_missing_fields"]
        records.append(record)

    core_ready_records = [record for record in records if not record["core_missing_fields"]]
    enrichment_ready_records = [record for record in records if not record["enrichment_missing_fields"]]
    return {
        "generated_at": utc_now(),
        "target_dataset_goal": 500,
        "target_window": {"start_year": 1990, "end_year": 2012},
        "summary": {
            "eligible_games": len(records),
            "gap_to_goal": max(0, 500 - len(records)),
            "core_ready_records": len(core_ready_records),
            "records_missing_core_fields": len(records) - len(core_ready_records),
            "records_needing_enrichment": len(records) - len(enrichment_ready_records),
            "records_with_local_assets": sum(1 for record in records if record["asset_references"]),
        },
        "records": records,
    }


def build_games_backlog(games_export: dict[str, Any]) -> dict[str, Any]:
    records = games_export["records"]
    missing_core = [record for record in records if record["core_missing_fields"]]
    missing_core.sort(
        key=lambda record: (
            -int(record.get("metascore") or 0),
            len(record["core_missing_fields"]),
            record.get("title") or "",
        )
    )
    enrichment_candidates = [record for record in records if not record["core_missing_fields"]]
    enrichment_candidates.sort(
        key=lambda record: (
            -int(record.get("metascore") or 0),
            len(record["enrichment_missing_fields"]),
            record.get("title") or "",
        )
    )

    return {
        "generated_at": utc_now(),
        "summary": {
            "records_missing_core_fields": len(missing_core),
            "records_ready_for_enrichment_only": len(enrichment_candidates),
        },
        "priority_missing_core_fields": [
            {
                "game_id": record["game_id"],
                "title": record["title"],
                "platform": record["platform"],
                "release_year": record["release_year"],
                "metascore": record["metascore"],
                "core_missing_fields": record["core_missing_fields"],
                "asset_references": record["asset_references"][:3],
            }
            for record in missing_core[:50]
        ],
        "priority_enrichment_candidates": [
            {
                "game_id": record["game_id"],
                "title": record["title"],
                "platform": record["platform"],
                "release_year": record["release_year"],
                "metascore": record["metascore"],
                "enrichment_missing_fields": record["enrichment_missing_fields"],
                "asset_references": record["asset_references"][:3],
            }
            for record in enrichment_candidates[:50]
        ],
    }


def build_asset_backlog(
    assets_export: dict[str, Any],
    catalog_by_id: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    unmatched_records = [
        record for record in assets_export["direct_asset_records"] if not record.get("game_id")
    ]
    backlog_records = []
    for record in unmatched_records:
        stem = Path(record["asset_file"]).stem
        backlog_records.append(
            {
                "asset_path": record["asset_path"],
                "asset_folder": record["asset_folder"],
                "asset_file": record["asset_file"],
                "matching_method": record["matching_method"],
                "suggested_matches": suggest_catalog_ids(stem, catalog_by_id),
                "needs_manual_review": True,
            }
        )
    return {
        "generated_at": utc_now(),
        "summary": {
            "unmatched_direct_assets": len(backlog_records),
        },
        "records": backlog_records,
    }


def build_market_export(
    catalog_by_id: dict[str, dict[str, Any]],
    market_data: dict[str, Any],
) -> dict[str, Any]:
    sales_map = market_data["sales"]
    history_map = market_data["history"]
    source_map = market_data["sources"]
    manifest = market_data["manifest"]
    coverage = market_data["coverage"]

    sales_records: list[dict[str, Any]] = []
    game_coverage: list[dict[str, Any]] = []
    all_game_ids = set(sales_map) | set(history_map) | set(source_map)

    for game_id in sorted(all_game_ids):
        catalog_item = catalog_by_id.get(game_id, {})
        source = source_map.get(game_id, {}) if isinstance(source_map.get(game_id), dict) else {}
        sales = sales_map.get(game_id, []) if isinstance(sales_map.get(game_id), list) else []
        history = history_map.get(game_id, []) if isinstance(history_map.get(game_id), list) else []

        for sale in sales:
            if not isinstance(sale, dict):
                continue
            sales_records.append(
                {
                    "game_id": game_id,
                    "title": catalog_item.get("title"),
                    "platform": catalog_item.get("console"),
                    "region": None,
                    "condition": sale.get("condition"),
                    "price": sale.get("price"),
                    "marketplace": source.get("sourceName"),
                    "sale_date": sale.get("date"),
                    "source_url": source.get("sourceUrl"),
                    "verified_at": source.get("verifiedAt"),
                }
            )

        latest_sale = None
        latest_sale_date = None
        for sale in sales:
            if not isinstance(sale, dict):
                continue
            sale_date = sale.get("date")
            if not isinstance(sale_date, str):
                continue
            if latest_sale_date is None or sale_date > latest_sale_date:
                latest_sale_date = sale_date
                latest_sale = sale

        game_coverage.append(
            {
                "game_id": game_id,
                "title": catalog_item.get("title"),
                "platform": catalog_item.get("console"),
                "verified_sales_count": len(sales),
                "history_points_count": len(history),
                "has_source_metadata": bool(source),
                "latest_sale_price": latest_sale.get("price") if isinstance(latest_sale, dict) else None,
                "latest_sale_condition": latest_sale.get("condition") if isinstance(latest_sale, dict) else None,
                "latest_sale_date": latest_sale_date,
                "marketplace": source.get("sourceName"),
                "source_url": source.get("sourceUrl"),
                "verified_at": source.get("verifiedAt"),
            }
        )

    return {
        "generated_at": utc_now(),
        "summary": {
            "manifest_priority_games": len(manifest),
            "games_with_sales": len(sales_map),
            "games_with_history": len(history_map),
            "games_with_sources": len(source_map),
            "total_sales_records": len(sales_records),
            "coverage_tracked_games": coverage.get("tracked_games"),
        },
        "sales_records": sales_records,
        "game_coverage": game_coverage,
    }


def write_sync_exports() -> dict[str, Any]:
    catalog = load_catalog_records()
    catalog_by_id = {
        item["id"]: item for item in catalog if isinstance(item, dict) and isinstance(item.get("id"), str)
    }
    entries = load_entries_map()
    prices_map = load_prices_map()
    asset_metadata_by_game = load_asset_metadata_map()
    assets_export = build_asset_exports(catalog_by_id, asset_metadata_by_game)
    games_export = build_games_export(catalog, entries, prices_map, assets_export, asset_metadata_by_game)
    market_export = build_market_export(catalog_by_id, load_market_data())
    games_backlog = build_games_backlog(games_export)
    asset_backlog = build_asset_backlog(assets_export, catalog_by_id)

    write_json(ASSETS_EXPORT_PATH, assets_export)
    write_json(GAMES_EXPORT_PATH, games_export)
    write_json(MARKET_EXPORT_PATH, market_export)
    write_json(GAMES_BACKLOG_PATH, games_backlog)
    write_json(ASSET_BACKLOG_PATH, asset_backlog)

    summary = {
        "generated_at": utc_now(),
        "paths": {
            "games": GAMES_EXPORT_PATH.relative_to(ROOT).as_posix(),
            "assets": ASSETS_EXPORT_PATH.relative_to(ROOT).as_posix(),
            "market": MARKET_EXPORT_PATH.relative_to(ROOT).as_posix(),
            "games_backlog": GAMES_BACKLOG_PATH.relative_to(ROOT).as_posix(),
            "asset_backlog": ASSET_BACKLOG_PATH.relative_to(ROOT).as_posix(),
        },
        "games_summary": games_export["summary"],
        "assets_summary": assets_export["summary"],
        "market_summary": market_export["summary"],
        "games_backlog_summary": games_backlog["summary"],
        "asset_backlog_summary": asset_backlog["summary"],
    }
    write_json(SYNC_EXPORT_SUMMARY_PATH, summary)
    return summary


def load_asset_snapshot() -> dict[str, Any]:
    assets_root = ROOT / "assets"
    folders: dict[str, Any] = {}
    for folder_name in ASSET_FOLDERS:
        folder = assets_root / folder_name
        if not folder.exists():
            folders[folder_name] = {"exists": False, "files": 0, "extensions": {}}
            continue
        files = [path for path in folder.rglob("*") if path.is_file()]
        extensions = Counter(path.suffix.lower() or "<noext>" for path in files)
        folders[folder_name] = {
            "exists": True,
            "files": len(files),
            "extensions": dict(sorted(extensions.items())),
        }

    library_path = ROOT / "data" / "retrodeck_asset_library.json"
    library = read_json(library_path, default={})
    entries = library.get("entries", {}) if isinstance(library, dict) else {}
    archived = library.get("archivedGames", {}) if isinstance(library, dict) else {}
    checkpoint = library.get("checkpoint") if isinstance(library, dict) else None

    return {
        "folders": folders,
        "library": {
            "path": library_path.relative_to(ROOT).as_posix(),
            "entries": len(entries) if isinstance(entries, dict) else len(entries or []),
            "archived_games": len(archived) if isinstance(archived, dict) else len(archived or []),
            "checkpoint": checkpoint,
        },
    }


def load_market_snapshot() -> dict[str, Any]:
    coverage_path = ROOT / "data" / "market_coverage_report.json"
    coverage = read_json(coverage_path, default={})
    manifest_path = ROOT / "data" / "market_import_manifest.json"
    manifest = read_json(manifest_path, default=[])
    template_path = ROOT / "data" / "market_sales_template.json"
    template = read_json(template_path, default={})

    return {
        "coverage_report_path": coverage_path.relative_to(ROOT).as_posix(),
        "tracked_games": coverage.get("tracked_games"),
        "history_games": coverage.get("history_games"),
        "sales_games": coverage.get("sales_games"),
        "source_games": coverage.get("source_games"),
        "console_coverage_entries": len(coverage.get("console_coverage", {}))
        if isinstance(coverage.get("console_coverage"), dict)
        else 0,
        "import_manifest_entries": len(manifest) if isinstance(manifest, list) else 0,
        "template_game_count": len(template) if isinstance(template, dict) else 0,
    }


def detect_git_status() -> dict[str, Any]:
    try:
        root_result = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
    except FileNotFoundError:
        return {"available": False, "status": "git_not_installed"}

    if root_result.returncode != 0:
        return {
            "available": False,
            "status": "git_repository_missing",
            "detail": root_result.stderr.strip() or root_result.stdout.strip(),
        }

    status_result = subprocess.run(
        ["git", "status", "--short", "--branch"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    return {
        "available": True,
        "status": "ok" if status_result.returncode == 0 else "status_failed",
        "root": root_result.stdout.strip(),
        "summary": status_result.stdout.strip(),
    }


def build_commit_suggestion(mode: str, area_counts: dict[str, int]) -> str:
    if mode == "bootstrap":
        return "[RETRODEX] automation: bootstrap local sync agent"
    if not area_counts:
        return "[RETRODEX] maintenance: sync checkpoint refresh"
    primary_area = max(area_counts, key=area_counts.get)
    area_label = {
        "frontend": "frontend",
        "data": "data",
        "assets": "assets",
        "automation": "automation",
        "docs": "docs",
        "other": "maintenance",
    }.get(primary_area, "maintenance")
    return f"[RETRODEX] {area_label}: record incremental sync audit"


def build_deployment_status(change_summary: dict[str, Any], mode: str) -> dict[str, Any]:
    frontend_changed = change_summary["frontend_impact"] or mode == "bootstrap"
    changed_frontend_files = [
        path
        for path in (change_summary["added"] + change_summary["modified"] + change_summary["removed"])
        if is_frontend_path(path)
    ]
    return {
        "status": "build_readiness_review_needed" if frontend_changed else "no_frontend_change_detected",
        "frontend_changed": frontend_changed,
        "changed_frontend_files": changed_frontend_files[:25],
        "vercel_config_present": (ROOT / "vercel.json").exists(),
        "note": (
            "Frontend-impacting files changed; verify static pages under local HTTP before any deployment step."
            if frontend_changed
            else "No frontend-impacting file changes detected in the current sync pass."
        ),
    }


def build_summary_text(
    mode: str,
    change_summary: dict[str, Any],
    catalog: dict[str, Any],
    assets: dict[str, Any],
    market: dict[str, Any],
    git_status: dict[str, Any],
) -> str:
    parts = [
        f"mode={mode}",
        f"changed={change_summary['counts']['total']}",
        f"catalog_games={catalog['games']}",
        f"target_window_games={catalog['games_in_target_window_1990_2012']}",
        f"generated_gb_assets={assets['folders']['generated_gb']['files']}",
        f"market_sales_games={market.get('sales_games')}",
        f"git={git_status['status']}",
    ]
    return "; ".join(str(part) for part in parts)


def build_notion_operations(
    batch_id: str,
    timestamp: str,
    mode: str,
    change_summary: dict[str, Any],
    catalog: dict[str, Any],
    assets: dict[str, Any],
    market: dict[str, Any],
) -> list[dict[str, Any]]:
    summary_text = (
        f"Sync batch {batch_id} captured {change_summary['counts']['total']} file changes. "
        f"Catalog: {catalog['games']} games with {catalog['games_in_target_window_1990_2012']} titles in the 1990-2012 window. "
        f"Assets: generated_gb={assets['folders']['generated_gb']['files']}, boxart={assets['folders']['boxart']['files']}, "
        f"top-screen={assets['folders']['top-screen']['files']}. "
        f"Market: sales_games={market.get('sales_games')}, history_games={market.get('history_games')}."
    )

    operations = [
        {
            "id": str(uuid4()),
            "batch_id": batch_id,
            "timestamp": timestamp,
            "target": "Codex Sync Log",
            "kind": "create_entry",
            "payload": {
                "title": f"Sync audit {timestamp}",
                "notes": summary_text,
            },
        },
        {
            "id": str(uuid4()),
            "batch_id": batch_id,
            "timestamp": timestamp,
            "target": "RetroDex Dev Tasks",
            "kind": "create_entry",
            "payload": {
                "title": (
                    "Bootstrap local sync agent for prototype_v0"
                    if mode == "bootstrap"
                    else f"Review sync batch {batch_id}"
                ),
                "notes": (
                    "Safe local-first sync utility created for this static seed. "
                    "Notion updates are queued until valid credentials and database mappings are available."
                    if mode == "bootstrap"
                    else summary_text
                ),
            },
        },
        {
            "id": str(uuid4()),
            "batch_id": batch_id,
            "timestamp": timestamp,
            "target": "RetroDex Roadmap",
            "kind": "create_entry",
            "payload": {
                "title": "Sync automation checkpoint",
                "notes": (
                    f"Latest sync batch is {batch_id}. Area counts: {json.dumps(change_summary['area_counts'], ensure_ascii=True)}."
                ),
            },
        },
    ]

    if mode == "bootstrap" or change_summary["area_counts"].get("data"):
        operations.append(
            {
                "id": str(uuid4()),
                "batch_id": batch_id,
                "timestamp": timestamp,
                "target": "RetroDex Games",
                "kind": "create_entry",
                "payload": {
                    "title": "Catalog baseline snapshot",
                    "notes": (
                        f"Local catalog currently exposes {catalog['games']} games. "
                        f"{catalog['games_in_target_window_1990_2012']} fall within the 1990-2012 target window."
                    ),
                },
            }
        )
        operations.append(
            {
                "id": str(uuid4()),
                "batch_id": batch_id,
                "timestamp": timestamp,
                "target": "RetroDex Market",
                "kind": "create_entry",
                "payload": {
                    "title": "Market baseline snapshot",
                    "notes": (
                        f"Coverage report shows sales_games={market.get('sales_games')}, "
                        f"history_games={market.get('history_games')}, source_games={market.get('source_games')}."
                    ),
                },
            }
        )

    if mode == "bootstrap" or change_summary["area_counts"].get("assets"):
        operations.append(
            {
                "id": str(uuid4()),
                "batch_id": batch_id,
                "timestamp": timestamp,
                "target": "RetroDex Assets",
                "kind": "create_entry",
                "payload": {
                    "title": "Asset baseline snapshot",
                    "notes": (
                        f"Local asset folders: generated_gb={assets['folders']['generated_gb']['files']}, "
                        f"boxart={assets['folders']['boxart']['files']}, "
                        f"top-screen={assets['folders']['top-screen']['files']}."
                    ),
                },
            }
        )

    return operations


def load_config() -> dict[str, Any]:
    if CONFIG_PATH.exists():
        return read_json(CONFIG_PATH, default={}) or {}
    if CONFIG_EXAMPLE_PATH.exists():
        return read_json(CONFIG_EXAMPLE_PATH, default={}) or {}
    return {}


def build_notion_page_payload(operation: dict[str, Any], database_config: dict[str, Any]) -> dict[str, Any]:
    title_property = database_config["title_property"]
    properties: dict[str, Any] = {
        title_property: {
            "title": [
                {
                    "text": {
                        "content": operation["payload"]["title"][:2000],
                    }
                }
            ]
        }
    }

    notes_property = database_config.get("notes_property")
    notes_value = operation["payload"].get("notes")
    if notes_property and notes_value:
        properties[notes_property] = {
            "rich_text": [
                {
                    "text": {
                        "content": notes_value[:2000],
                    }
                }
            ]
        }

    return {
        "parent": {"database_id": database_config["database_id"]},
        "properties": properties,
    }


def queue_operations(operations: list[dict[str, Any]], reason: str) -> dict[str, Any]:
    for operation in operations:
        queued = dict(operation)
        queued["status"] = "queued"
        queued["queue_reason"] = reason
        append_jsonl(NOTION_QUEUE_PATH, queued)
    return {
        "status": "queued",
        "reason": reason,
        "queued": len(operations),
        "synced": 0,
    }


def sync_notion(operations: list[dict[str, Any]]) -> dict[str, Any]:
    config = load_config()
    notion_config = config.get("notion", {}) if isinstance(config, dict) else {}
    if not notion_config.get("enabled", False):
        return queue_operations(operations, "notion_disabled_in_config")

    token_env_var = notion_config.get("token_env_var", "RETRODEX_NOTION_TOKEN")
    token = os.getenv(token_env_var) or os.getenv("NOTION_ACCESS_TOKEN") or os.getenv("NOTION_TOKEN")
    if not token:
        return queue_operations(operations, f"missing_token_env:{token_env_var}")

    api_version = notion_config.get("api_version", "2022-06-28")
    databases = notion_config.get("databases", {})
    synced = 0
    queued = 0
    failed = 0

    for operation in operations:
        database_config = databases.get(operation["target"], {})
        if not database_config.get("database_id") or not database_config.get("title_property"):
            append_jsonl(
                NOTION_QUEUE_PATH,
                {
                    **operation,
                    "status": "queued",
                    "queue_reason": "missing_database_mapping",
                },
            )
            queued += 1
            continue

        payload = build_notion_page_payload(operation, database_config)
        request = urllib.request.Request(
            "https://api.notion.com/v1/pages",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "Notion-Version": api_version,
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                response.read()
            synced += 1
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            append_jsonl(
                NOTION_ERROR_PATH,
                {
                    "operation_id": operation["id"],
                    "batch_id": operation["batch_id"],
                    "target": operation["target"],
                    "status": exc.code,
                    "body": body[:2000],
                    "timestamp": utc_now(),
                },
            )
            append_jsonl(
                NOTION_QUEUE_PATH,
                {
                    **operation,
                    "status": "queued",
                    "queue_reason": f"http_error:{exc.code}",
                },
            )
            failed += 1
            queued += 1
        except urllib.error.URLError as exc:
            append_jsonl(
                NOTION_ERROR_PATH,
                {
                    "operation_id": operation["id"],
                    "batch_id": operation["batch_id"],
                    "target": operation["target"],
                    "status": "url_error",
                    "body": str(exc.reason),
                    "timestamp": utc_now(),
                },
            )
            append_jsonl(
                NOTION_QUEUE_PATH,
                {
                    **operation,
                    "status": "queued",
                    "queue_reason": "network_error",
                },
            )
            failed += 1
            queued += 1

    status = "synced" if queued == 0 and failed == 0 else "partial"
    return {
        "status": status,
        "synced": synced,
        "queued": queued,
        "failed": failed,
    }


def replay_notion_queue() -> int:
    ensure_dirs()
    pending = read_jsonl(NOTION_QUEUE_PATH)
    if not pending:
        print(
            json.dumps(
                {
                    "mode": "replay_queue",
                    "pending_operations": 0,
                    "status": "nothing_to_replay",
                },
                ensure_ascii=True,
                indent=2,
            )
        )
        return 0

    replay_started_at = utc_now()
    queue_backup = pending[:]
    NOTION_QUEUE_PATH.unlink(missing_ok=True)
    result = sync_notion(queue_backup)

    archive_entry = {
        "replay_started_at": replay_started_at,
        "pending_operations": len(queue_backup),
        "result": result,
    }
    append_jsonl(NOTION_QUEUE_ARCHIVE_PATH, archive_entry)

    print(
        json.dumps(
            {
                "mode": "replay_queue",
                "pending_operations": len(queue_backup),
                "result": result,
                "queue_file": NOTION_QUEUE_PATH.relative_to(ROOT).as_posix(),
                "archive_file": NOTION_QUEUE_ARCHIVE_PATH.relative_to(ROOT).as_posix(),
            },
            ensure_ascii=True,
            indent=2,
        )
    )
    return 0


def build_checkpoint(
    timestamp: str,
    mode: str,
    change_summary: dict[str, Any],
    operations: list[dict[str, Any]],
    notion_status: dict[str, Any],
) -> dict[str, Any]:
    if mode == "bootstrap":
        files_modified = [
            "scripts/retrodex_sync_agent.py",
            "scripts/retrodex_sync_config.example.json",
            "scripts/README.md",
            "logs/latest_audit.json",
            "logs/codex_sync_log.jsonl",
            "logs/notion_sync_queue.jsonl",
            "logs/vercel_build_readiness.json",
            "logs/sync_state.json",
        ]
        stage_completed = "bootstrap_sync_agent_initialized"
    else:
        files_modified = (
            change_summary["added"] + change_summary["modified"] + change_summary["removed"]
        )[:25]
        stage_completed = "incremental_sync_scan_completed"

    next_step = (
        "Restore a valid Notion token and fill scripts/retrodex_sync_config.json so queued operations can be replayed."
        if notion_status["status"] != "synced"
        else "Review git status and front-end readiness, then decide whether the batch is ready for commit/deployment."
    )

    return {
        "timestamp": timestamp,
        "stage_completed": stage_completed,
        "files_modified": files_modified,
        "tasks_created": [operation["payload"]["title"] for operation in operations],
        "next_recommended_step": next_step,
    }


def main() -> int:
    if "--replay-queue" in sys.argv:
        return replay_notion_queue()

    ensure_dirs()
    timestamp = utc_now()
    previous_state = read_json(STATE_PATH, default={}) or {}
    previous_snapshot = previous_state.get("snapshot", {})
    current_snapshot = snapshot_files()
    mode = "bootstrap" if not previous_snapshot else "incremental"
    has_meaningful_changes = mode == "bootstrap"

    change_summary = summarize_changes(previous_snapshot, current_snapshot)
    if change_summary["counts"]["total"] > 0:
        has_meaningful_changes = True
    catalog_snapshot = load_catalog_snapshot()
    asset_snapshot = load_asset_snapshot()
    market_snapshot = load_market_snapshot()
    export_summary = write_sync_exports()
    git_status = detect_git_status()
    commit_message = build_commit_suggestion(mode, change_summary["area_counts"])
    deployment_status = build_deployment_status(change_summary, mode)
    batch_id = f"sync-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}"
    notion_operations: list[dict[str, Any]] = []
    notion_status: dict[str, Any]

    if has_meaningful_changes:
        notion_operations = build_notion_operations(
            batch_id=batch_id,
            timestamp=timestamp,
            mode=mode,
            change_summary=change_summary,
            catalog=catalog_snapshot,
            assets=asset_snapshot,
            market=market_snapshot,
        )
        notion_status = sync_notion(notion_operations)
    else:
        notion_status = {
            "status": "skipped",
            "reason": "no_meaningful_changes",
            "queued": 0,
            "synced": 0,
        }

    audit_report = {
        "timestamp": timestamp,
        "mode": mode,
        "has_meaningful_changes": has_meaningful_changes,
        "root": str(ROOT),
        "tracked_files": len(current_snapshot),
        "change_summary": change_summary,
        "catalog_snapshot": catalog_snapshot,
        "asset_snapshot": asset_snapshot,
        "market_snapshot": market_snapshot,
        "sync_export_summary": export_summary,
        "git_status": git_status,
        "notion_status": notion_status,
        "deployment_status": deployment_status,
        "commit_message_suggestion": commit_message,
        "summary_text": build_summary_text(
            mode=mode,
            change_summary=change_summary,
            catalog=catalog_snapshot,
            assets=asset_snapshot,
            market=market_snapshot,
            git_status=git_status,
        ),
    }

    write_json(AUDIT_REPORT_PATH, audit_report)
    write_json(READINESS_PATH, deployment_status)
    write_json(
        STATE_PATH,
        {
            "timestamp": timestamp,
            "root": str(ROOT),
            "snapshot": current_snapshot,
        },
    )

    checkpoint_path: Path | None = None
    if has_meaningful_changes:
        sync_log_entry = {
            "id": str(uuid4()),
            "batch_id": batch_id,
            "timestamp": timestamp,
            "mode": mode,
            "summary": audit_report["summary_text"],
            "change_counts": change_summary["counts"],
            "notion_status": notion_status["status"],
            "git_status": git_status["status"],
            "commit_message_suggestion": commit_message,
        }
        append_jsonl(SYNC_LOG_PATH, sync_log_entry)

        checkpoint = build_checkpoint(
            timestamp=timestamp,
            mode=mode,
            change_summary=change_summary,
            operations=notion_operations,
            notion_status=notion_status,
        )
        checkpoint_path = CHECKPOINT_DIR / f"{timestamp.replace(':', '').replace('-', '')}_checkpoint.json"
        write_json(checkpoint_path, checkpoint)

    print(json.dumps(
        {
            "timestamp": timestamp,
            "mode": mode,
            "has_meaningful_changes": has_meaningful_changes,
            "tracked_files": len(current_snapshot),
            "change_counts": change_summary["counts"],
            "notion_status": notion_status,
            "git_status": git_status["status"],
            "checkpoint": checkpoint_path.relative_to(ROOT).as_posix() if checkpoint_path else None,
            "commit_message_suggestion": commit_message,
        },
        ensure_ascii=True,
        indent=2,
    ))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
