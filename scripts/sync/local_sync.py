#!/usr/bin/env python3
"""Record local RetroDex sync events without enabling live automation."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
LOG_DIR = ROOT / "logs" / "sync"
SYNC_LOG_PATH = LOG_DIR / "local_sync_log.jsonl"
TASK_PROGRESS_PATH = LOG_DIR / "task_progress_events.jsonl"
LATEST_EVENT_PATH = LOG_DIR / "latest_sync_event.json"
NOTION_TARGETS = [
    "RetroDex Dev Tasks",
    "RetroDex Roadmap",
    "Codex Sync Log",
]


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def append_jsonl(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(payload, ensure_ascii=True) + "\n")


def root_relative(path_value: str) -> str:
    path = Path(path_value)
    if path.is_absolute():
        try:
            return path.relative_to(ROOT).as_posix()
        except ValueError:
            return str(path)
    return path.as_posix()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Write a local RetroDex sync event.")
    parser.add_argument(
        "--event-kind",
        choices=["sync", "task", "progress"],
        default="sync",
        help="Type of event to record.",
    )
    parser.add_argument("--area", required=True, help="Project area, such as backend, frontend, docs, or automation.")
    parser.add_argument("--summary", required=True, help="Human-readable event summary.")
    parser.add_argument(
        "--status",
        choices=["planned", "in_progress", "blocked", "completed", "info"],
        default="info",
        help="Status value for the event.",
    )
    parser.add_argument("--task-id", help="Optional task or milestone identifier.")
    parser.add_argument("--milestone", help="Optional milestone label.")
    parser.add_argument("--source", default="codex", help="Event source label.")
    parser.add_argument("--notes", help="Optional extra notes.")
    parser.add_argument("--files", nargs="*", default=[], help="Repository files touched by the event.")
    parser.add_argument("--dry-run", action="store_true", help="Print the event without writing logs.")
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    payload = {
        "schema_version": "retrodex.sync.event.v1",
        "timestamp": utc_now(),
        "event_kind": args.event_kind,
        "area": args.area,
        "summary": args.summary,
        "status": args.status,
        "task_id": args.task_id,
        "milestone": args.milestone,
        "source": args.source,
        "notes": args.notes,
        "files_modified": [root_relative(item) for item in args.files],
        "notion_sync": {
            "enabled": False,
            "mode": "manual_gate",
            "planned_targets": NOTION_TARGETS,
            "activation_requirements": [
                "root sync/import modules validated locally",
                "schemas documented and agreed",
                "Notion database IDs configured explicitly",
                "manual review gate kept in place",
            ],
            "state": "not_configured",
        },
    }

    if not args.dry_run:
        append_jsonl(SYNC_LOG_PATH, payload)
        if args.event_kind in {"task", "progress"}:
            append_jsonl(TASK_PROGRESS_PATH, payload)
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        LATEST_EVENT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")

    print(json.dumps(payload, indent=2, ensure_ascii=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
