#!/usr/bin/env python3
"""Validate future RetroDex import files without ingesting them."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
LOG_DIR = ROOT / "logs" / "import"
ATTEMPT_LOG_PATH = LOG_DIR / "import_attempts.jsonl"
LATEST_REPORT_PATH = LOG_DIR / "latest_import_report.json"
ALLOWED_ASSET_TYPES = {
    "artwork",
    "boxart",
    "map",
    "other",
    "screenshot",
    "sprite",
    "top_screen",
}


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def append_jsonl(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(payload, ensure_ascii=True) + "\n")


def root_relative(path: Path) -> str:
    try:
        return path.resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return str(path)


def load_records(input_path: Path) -> list[dict]:
    with input_path.open("r", encoding="utf-8-sig") as handle:
        payload = json.load(handle)
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict) and isinstance(payload.get("records"), list):
        return payload["records"]
    raise ValueError("Expected a JSON array or an object with a top-level 'records' array.")


def require_string(record: dict, key: str, errors: list[dict], index: int) -> str | None:
    value = record.get(key)
    if not isinstance(value, str) or not value.strip():
        errors.append({"record": index, "field": key, "message": "Expected a non-empty string."})
        return None
    return value.strip()


def validate_games(records: list[dict]) -> tuple[list[dict], list[dict]]:
    errors: list[dict] = []
    warnings: list[dict] = []
    optional_string_fields = ["genre", "developer", "publisher", "franchise", "episode"]

    for index, record in enumerate(records, start=1):
        if not isinstance(record, dict):
            errors.append({"record": index, "field": None, "message": "Each game record must be an object."})
            continue

        require_string(record, "title", errors, index)
        require_string(record, "platform", errors, index)

        release_year = record.get("release_year")
        if isinstance(release_year, bool) or not isinstance(release_year, int):
            errors.append({"record": index, "field": "release_year", "message": "Expected an integer year."})
        elif release_year < 1970 or release_year > 2100:
            errors.append({"record": index, "field": "release_year", "message": "Year must be between 1970 and 2100."})

        for field in optional_string_fields:
            if field in record and record[field] is not None and not isinstance(record[field], str):
                errors.append({"record": index, "field": field, "message": "Expected a string when provided."})

        if "asset_refs" in record and record["asset_refs"] is not None:
            asset_refs = record["asset_refs"]
            if not isinstance(asset_refs, list) or any(not isinstance(item, str) or not item.strip() for item in asset_refs):
                errors.append({"record": index, "field": "asset_refs", "message": "Expected an array of non-empty strings."})

        if "episode" not in record:
            warnings.append({"record": index, "field": "episode", "message": "Episode is optional but missing."})

    return errors, warnings


def validate_assets(records: list[dict]) -> tuple[list[dict], list[dict]]:
    errors: list[dict] = []
    warnings: list[dict] = []
    optional_string_fields = ["platform", "asset_path", "variant", "notes", "checksum"]

    for index, record in enumerate(records, start=1):
        if not isinstance(record, dict):
            errors.append({"record": index, "field": None, "message": "Each asset record must be an object."})
            continue

        require_string(record, "game_title", errors, index)
        asset_type = require_string(record, "asset_type", errors, index)
        source_path = require_string(record, "source_path", errors, index)

        if asset_type and asset_type not in ALLOWED_ASSET_TYPES:
            errors.append(
                {
                    "record": index,
                    "field": "asset_type",
                    "message": f"Unsupported asset type. Allowed: {sorted(ALLOWED_ASSET_TYPES)}.",
                }
            )

        for field in optional_string_fields:
            if field in record and record[field] is not None and not isinstance(record[field], str):
                errors.append({"record": index, "field": field, "message": "Expected a string when provided."})

        if "tags" in record and record["tags"] is not None:
            tags = record["tags"]
            if not isinstance(tags, list) or any(not isinstance(item, str) or not item.strip() for item in tags):
                errors.append({"record": index, "field": "tags", "message": "Expected an array of non-empty strings."})

        if source_path and not source_path.startswith(("http://", "https://")):
            candidate = Path(source_path)
            if not candidate.is_absolute():
                candidate = ROOT / candidate
            if not candidate.exists():
                warnings.append(
                    {
                        "record": index,
                        "field": "source_path",
                        "message": "Source path does not exist in the local repository yet.",
                    }
                )

    return errors, warnings


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Validate a future RetroDex import file.")
    parser.add_argument("--kind", required=True, choices=["games", "assets"], help="Import type to validate.")
    parser.add_argument("--input", required=True, help="Path to the candidate JSON file.")
    parser.add_argument("--label", help="Optional label to describe this validation attempt.")
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    input_path = Path(args.input).expanduser()
    timestamp = utc_now()
    report: dict = {
        "schema_version": "retrodex.import.validation.v1",
        "timestamp": timestamp,
        "kind": args.kind,
        "label": args.label,
        "input_file": root_relative(input_path),
        "accepted": False,
        "record_count": 0,
        "errors": [],
        "warnings": [],
    }

    try:
        if not input_path.exists():
            raise FileNotFoundError(f"Input file not found: {input_path}")
        if input_path.suffix.lower() != ".json":
            raise ValueError("Only JSON input files are supported by the root import validator.")

        records = load_records(input_path)
        report["record_count"] = len(records)

        if args.kind == "games":
            errors, warnings = validate_games(records)
        else:
            errors, warnings = validate_assets(records)

        report["errors"] = errors
        report["warnings"] = warnings
        report["accepted"] = not errors
    except Exception as exc:  # pragma: no cover - defensive path for CLI use
        report["errors"] = [{"record": None, "field": None, "message": str(exc)}]
        report["accepted"] = False

    attempt_entry = {
        "timestamp": report["timestamp"],
        "kind": report["kind"],
        "label": report["label"],
        "input_file": report["input_file"],
        "record_count": report["record_count"],
        "accepted": report["accepted"],
        "error_count": len(report["errors"]),
        "warning_count": len(report["warnings"]),
    }

    LOG_DIR.mkdir(parents=True, exist_ok=True)
    append_jsonl(ATTEMPT_LOG_PATH, attempt_entry)
    LATEST_REPORT_PATH.write_text(json.dumps(report, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")

    print(json.dumps(report, indent=2, ensure_ascii=True))
    return 0 if report["accepted"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
