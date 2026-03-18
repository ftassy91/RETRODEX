import argparse
import json
import re
import subprocess
import unicodedata
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LIBRARY_PATH = ROOT / "data" / "retrodeck_asset_library.js"
CONVERTER_PATH = ROOT / "data_engine" / "asset_pipeline" / "convert_to_gb_sprite.ps1"
OUTPUT_DIR = ROOT / "assets" / "generated_gb"
OFFICIAL_SOURCE_DIRS = [
    ("boxart", ROOT / "assets" / "boxart"),
    ("titleScreen", ROOT / "assets" / "titlescreens"),
    ("artwork", ROOT / "assets" / "artwork"),
    ("gameplay", ROOT / "assets" / "screenshots"),
]


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value or "")
    ascii_value = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    return re.sub(r"(^-|-$)", "", re.sub(r"[^a-z0-9]+", "-", ascii_value.lower()))


def load_asset_library() -> dict:
    raw = LIBRARY_PATH.read_text(encoding="utf-8")
    match = re.search(r"window\.RETRODECK_ASSET_LIBRARY\s*=\s*(\{.*\})\s*;\s*$", raw, re.S)
    if not match:
        raise RuntimeError(f"Unable to parse asset library: {LIBRARY_PATH}")
    return json.loads(match.group(1))


def select_source_path(entry: dict) -> tuple[Path | None, str]:
    slug = slugify(entry.get("game", ""))

    for source_type, directory in OFFICIAL_SOURCE_DIRS:
        candidate = directory / f"{slug}.png"
        if candidate.exists():
            return candidate, source_type

    sprite_path = entry.get("sprite_path", "")
    if sprite_path:
        candidate = ROOT / sprite_path
        if candidate.exists():
            return candidate, "asset-library"

    return None, "missing"


def build_generated_asset(entry: dict, force: bool = False) -> str:
    source_path, source_type = select_source_path(entry)
    if not source_path:
        return f"missing source: {entry.get('game', 'unknown')}"

    slug = slugify(entry["game"])
    output_path = OUTPUT_DIR / f"{slug}.png"
    report_path = OUTPUT_DIR / f"{slug}.json"

    if output_path.exists() and not force:
        return f"skip existing: {output_path.name}"

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    command = [
        "powershell",
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        str(CONVERTER_PATH),
        "-SourcePath",
        str(source_path),
        "-OutputPath",
        str(output_path),
        "-ReportPath",
        str(report_path),
        "-CanvasSize",
        "180",
        "-WorkSize",
        "72",
    ]
    subprocess.run(command, check=True)
    return f"built: {output_path.name} <- {source_type}"


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate local Top Screen Game Boy fallback images.")
    parser.add_argument("--force", action="store_true", help="Overwrite existing generated images.")
    parser.add_argument("--limit", type=int, default=0, help="Limit the number of processed ready entries.")
    parser.add_argument(
        "--ids-file",
        type=str,
        default="",
        help="Optional JSON file containing an `ids` array used to filter processed games.",
    )
    args = parser.parse_args()

    library = load_asset_library()
    entries = library.get("entries", {})
    ready_entries = [entry for entry in entries.values() if entry.get("status") == "ready" and entry.get("sprite_path")]

    if args.ids_file:
        ids_path = Path(args.ids_file)
        if not ids_path.is_absolute():
            ids_path = ROOT / args.ids_file
        subset_payload = json.loads(ids_path.read_text(encoding="utf-8"))
        subset_ids = set(subset_payload.get("ids", []))
        ready_entries = [
            entry
            for entry in ready_entries
            if (entry.get("game_id") or entry.get("id")) in subset_ids
        ]

    ready_entries.sort(key=lambda item: (item.get("year") or 0, item.get("game") or ""))

    if args.limit > 0:
        ready_entries = ready_entries[: args.limit]

    for entry in ready_entries:
        print(build_generated_asset(entry, force=args.force))

    print(f"processed {len(ready_entries)} ready entries")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
