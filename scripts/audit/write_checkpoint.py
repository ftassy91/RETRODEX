#!/usr/bin/env python3
"""Write a RetroDex checkpoint and append it to the audit log."""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
AUDIT_DIR = ROOT / "logs" / "audit"
CHECKPOINT_DIR = ROOT / "logs" / "checkpoints"
AUDIT_LOG_PATH = AUDIT_DIR / "change_log.jsonl"


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "checkpoint"


def append_jsonl(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(payload, ensure_ascii=True) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser(description="Write a checkpoint for RetroDex work.")
    parser.add_argument("--operation", required=True, help="Operation performed.")
    parser.add_argument("--next-step", required=True, help="Next recommended step.")
    parser.add_argument("--files", nargs="*", default=[], help="Files modified during the operation.")
    args = parser.parse_args()

    timestamp = utc_now()
    CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)
    AUDIT_DIR.mkdir(parents=True, exist_ok=True)

    payload = {
        "timestamp": timestamp,
        "operation_performed": args.operation,
        "files_modified": args.files,
        "next_recommended_step": args.next_step,
    }

    checkpoint_name = f"{timestamp.replace(':', '').replace('-', '')}_{slugify(args.operation)[:64]}.json"
    checkpoint_path = CHECKPOINT_DIR / checkpoint_name
    checkpoint_path.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")

    audit_entry = {
        **payload,
        "checkpoint_file": checkpoint_path.relative_to(ROOT).as_posix(),
    }
    append_jsonl(AUDIT_LOG_PATH, audit_entry)

    print(json.dumps(audit_entry, indent=2, ensure_ascii=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
