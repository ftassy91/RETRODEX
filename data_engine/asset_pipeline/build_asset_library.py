from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"
JS_DIR = ROOT / "js"
CATALOG_PATH = DATA_DIR / "catalog.json"
ENTRIES_PATH = DATA_DIR / "entries.json"
ARTWORK_DATA_PATH = DATA_DIR / "top_screen_artwork.js"
TOP_SCREEN_JS_PATH = JS_DIR / "top-screen.js"
ASSET_ROOT = ROOT / "retrodeck_assets"
CACHE_DIR = ASSET_ROOT / "_cache"
SOURCE_CACHE_DIR = CACHE_DIR / "source_images"
CHECKPOINT_PATH = ASSET_ROOT / "checkpoint.json"
LOG_PATH = ASSET_ROOT / "asset_pipeline.log"
ARCHIVED_PATH = ASSET_ROOT / "archived_games.json"
SUMMARY_CACHE_PATH = CACHE_DIR / "wikipedia_summary_cache.json"
LIBRARY_JSON_PATH = DATA_DIR / "retrodeck_asset_library.json"
LIBRARY_JS_PATH = DATA_DIR / "retrodeck_asset_library.js"
CONVERTER_PATH = Path(__file__).with_name("convert_to_gb_sprite.ps1")
USER_AGENT = "RetroDexAssetPipeline/1.0"
PALETTE = ["#0F380F", "#306230", "#8BAC0F", "#9BBC0F"]

PRIORITY_ORDER = ["gameSpecificSprite", "mainSprite", "bossSprite", "iconicObject", "symbolLogo", "artwork"]
PRIORITY_SCORE = {
    "gameSpecificSprite": 600,
    "mainSprite": 500,
    "bossSprite": 400,
    "iconicObject": 300,
    "symbolLogo": 200,
    "artwork": 100,
}
TITLE_FONT_RULES = [
    (("metal gear", "wipeout", "ridge racer", "gran turismo", "f-zero", "thunder force"), "Share Tech Mono"),
    (("final fantasy", "dragon", "zelda", "castlevania", "chrono", "suikoden", "breath of fire", "illusion", "terranigma"), "Georgia"),
]


@dataclass
class Candidate:
    type_key: str
    asset_name: str
    source_type: str
    image_reference: str
    selection_reason: str
    local_path: Optional[Path] = None
    wiki_title: Optional[str] = None
    score_bonus: int = 0
    fallback_conditions: Optional[List[str]] = None


def atomic_write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", delete=False, encoding="utf-8", dir=str(path.parent)) as handle:
        handle.write(content)
        temp_name = handle.name
    last_error: Optional[Exception] = None
    for _ in range(5):
        try:
            os.replace(temp_name, path)
            return
        except PermissionError as exc:
            last_error = exc
            time.sleep(0.2)
    if last_error:
        raise last_error


def atomic_write_json(path: Path, payload: Any) -> None:
    atomic_write_text(path, json.dumps(payload, indent=2, ensure_ascii=False) + "\n")


def read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8-sig") as handle:
        return json.load(handle)


def append_log(record: Dict[str, Any]) -> None:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with LOG_PATH.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, ensure_ascii=False) + "\n")


def extract_js_object(source: str, marker: str) -> str:
    start = source.find(marker)
    if start < 0:
        raise ValueError(f"Marker not found: {marker}")
    brace_start = source.find("{", start)
    if brace_start < 0:
        raise ValueError(f"No object found for: {marker}")
    depth = 0
    in_string = False
    quote = ""
    escape = False
    in_line_comment = False
    in_block_comment = False
    for index in range(brace_start, len(source)):
        char = source[index]
        nxt = source[index + 1] if index + 1 < len(source) else ""
        if in_line_comment:
            if char == "\n":
                in_line_comment = False
            continue
        if in_block_comment:
            if char == "*" and nxt == "/":
                in_block_comment = False
            continue
        if in_string:
            if escape:
                escape = False
            elif char == "\\":
                escape = True
            elif char == quote:
                in_string = False
            continue
        if char == "/" and nxt == "/":
            in_line_comment = True
            continue
        if char == "/" and nxt == "*":
            in_block_comment = True
            continue
        if char in ('"', "'"):
            in_string = True
            quote = char
            continue
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return source[brace_start:index + 1]
    raise ValueError(f"Unterminated object for: {marker}")


def strip_js_comments(text: str) -> str:
    out: List[str] = []
    i = 0
    in_string = False
    quote = ""
    escape = False
    while i < len(text):
        char = text[i]
        nxt = text[i + 1] if i + 1 < len(text) else ""
        if in_string:
            out.append(char)
            if escape:
                escape = False
            elif char == "\\":
                escape = True
            elif char == quote:
                in_string = False
            i += 1
            continue
        if char in ('"', "'"):
            in_string = True
            quote = char
            out.append(char)
            i += 1
            continue
        if char == "/" and nxt == "/":
            i += 2
            while i < len(text) and text[i] != "\n":
                i += 1
            continue
        if char == "/" and nxt == "*":
            i += 2
            while i + 1 < len(text) and not (text[i] == "*" and text[i + 1] == "/"):
                i += 1
            i += 2
            continue
        out.append(char)
        i += 1
    return "".join(out)


def normalize_js_object(text: str) -> str:
    cleaned = strip_js_comments(text)
    cleaned = re.sub(r"([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)", r'\1"\2"\3', cleaned)
    cleaned = re.sub(r",(\s*[}\]])", r"\1", cleaned)
    return cleaned


def load_artwork_data() -> Dict[str, Any]:
    source = ARTWORK_DATA_PATH.read_text(encoding="utf-8")
    obj_text = extract_js_object(source, "window.TOP_SCREEN_ARTWORK_DATA")
    return json.loads(normalize_js_object(obj_text))


def load_wiki_map() -> Dict[str, str]:
    source = TOP_SCREEN_JS_PATH.read_text(encoding="utf-8")
    obj_text = extract_js_object(source, "const WIKI =")
    return json.loads(normalize_js_object(obj_text))


def normalize_type(raw: Optional[str]) -> str:
    lowered = (raw or "").strip().lower()
    if lowered in {"gamespecificsprite", "game_specific_sprite"}:
        return "gameSpecificSprite"
    if lowered in {"mainsprite", "main_sprite", "character_sprite"}:
        return "mainSprite"
    if lowered in {"bosssprite", "boss_sprite"}:
        return "bossSprite"
    if lowered in {"iconicobject", "iconic_object", "iconic_item", "item"}:
        return "iconicObject"
    if lowered in {"symbollogo", "symbol_logo", "logo", "game_logo"}:
        return "symbolLogo"
    return "artwork"


def type_to_metadata_asset(type_key: str) -> str:
    return {
        "gameSpecificSprite": "character_sprite",
        "mainSprite": "character_sprite",
        "bossSprite": "boss_sprite",
        "iconicObject": "iconic_item",
        "symbolLogo": "symbol_logo",
        "artwork": "cover_art",
    }.get(type_key, "cover_art")


def selection_reason_for(type_key: str) -> str:
    return {
        "gameSpecificSprite": "Main playable character sprite from this specific game",
        "mainSprite": "Most recognizable character sprite tied to this specific game",
        "bossSprite": "Iconic enemy or boss sprite from this specific game",
        "iconicObject": "Iconic gameplay item strongly associated with this game",
        "symbolLogo": "Game-specific symbol or logo used because no better sprite candidate was available",
        "artwork": "Fallback to official game cover art because no better sprite-grade source was available",
    }.get(type_key, "Fallback to the best available official visual for this game")


def choose_title_font(title: str) -> str:
    lowered = title.lower()
    for keywords, font_name in TITLE_FONT_RULES:
        if any(keyword in lowered for keyword in keywords):
            return font_name
    return "Press Start 2P"


def infer_episode_number(title: str) -> Optional[int]:
    numeric = re.search(r"\b(\d{1,2})\b", title)
    if numeric:
        return int(numeric.group(1))
    roman = re.search(r"\b([IVX]{1,5})\b", title)
    if not roman:
        return None
    values = {"I": 1, "V": 5, "X": 10}
    total = 0
    prev = 0
    for char in reversed(roman.group(1)):
        value = values[char]
        if value < prev:
            total -= value
        else:
            total += value
            prev = value
    return total or None


def resolve_publisher(game: Dict[str, Any], entry: Optional[Dict[str, Any]]) -> str:
    if entry:
        for field in ("publisher", "editor", "publisherName"):
            if entry.get(field):
                return entry[field]
    for field in ("publisher", "editor", "publisherName", "developer"):
        if game.get(field):
            return game[field]
    return game.get("console", "Unknown")


def slugify_game(game_id: str) -> str:
    return game_id.replace("-", "_")


def infer_wiki_titles(game: Dict[str, Any]) -> List[str]:
    title = game["title"]
    year = game.get("year")
    inferred = [title]
    inferred.append(f"{title} (video game)")
    if year:
        inferred.append(f"{title} ({year} video game)")
    deduped: List[str] = []
    for item in inferred:
        if item not in deduped:
            deduped.append(item)
    return deduped


def build_candidates(game: Dict[str, Any], artwork_data: Dict[str, Any], wiki_map: Dict[str, str]) -> List[Candidate]:
    manual = artwork_data.get("manual", {}).get(game["id"], {})
    identity = artwork_data.get("identity", {}).get(game["id"], [])
    overrides = artwork_data.get("overrides", {}).get(game["id"], [])
    candidates: List[Candidate] = []
    for type_key in PRIORITY_ORDER:
        snake = re.sub(r"([A-Z])", lambda match: "_" + match.group(1).lower(), type_key)
        asset = manual.get(type_key) or manual.get(snake)
        if not asset:
            continue
        if isinstance(asset, str):
            candidates.append(Candidate(type_key, Path(asset).stem, "manual_local_asset", asset, selection_reason_for(type_key), ROOT / asset, None, 220, []))
            continue
        if isinstance(asset, dict):
            src = asset.get("src") or asset.get("url") or asset.get("image")
            if not src:
                continue
            item_type = normalize_type(asset.get("type") or type_key)
            local_path = None if str(src).startswith(("http://", "https://")) else ROOT / str(src)
            candidates.append(Candidate(item_type, asset.get("asset_name") or Path(str(src)).stem, "manual_local_asset", str(src), selection_reason_for(item_type), local_path, None, 220, []))
    for item in identity:
        title = item.get("wikiTitle")
        if not title:
            continue
        item_type = normalize_type(item.get("type") or "mainSprite")
        candidates.append(Candidate(item_type, title.replace("_", " "), "wikipedia_identity_override", title, selection_reason_for(item_type), None, title, 140, []))
    for title in overrides:
        candidates.append(Candidate("artwork", title.replace("_", " "), "wikipedia_title_override", title, selection_reason_for("artwork"), None, title, 60, ["override_fallback"]))
    title = wiki_map.get(game["id"])
    if title:
        conditions = [] if candidates else ["no_specific_sprite_candidate"]
        candidates.append(Candidate("artwork", title.replace("_", " "), "wikipedia_curated_reference", title, selection_reason_for("artwork"), None, title, 20, conditions))
    if not candidates:
        for inferred_title in infer_wiki_titles(game):
            candidates.append(
                Candidate(
                    "artwork",
                    inferred_title,
                    "wikipedia_inferred",
                    inferred_title,
                    selection_reason_for("artwork"),
                    None,
                    inferred_title,
                    0,
                    ["inferred_title_fallback"],
                )
            )
    unique: Dict[Tuple[str, str, str], Candidate] = {}
    for candidate in candidates:
        unique.setdefault((candidate.type_key, candidate.source_type, candidate.image_reference), candidate)
    return sorted(unique.values(), key=lambda candidate: -(PRIORITY_SCORE.get(candidate.type_key, 0) + candidate.score_bonus))


def get_checkpoint(default_start: int = 0) -> Dict[str, Any]:
    checkpoint = read_json(CHECKPOINT_PATH, {})
    checkpoint.setdefault("last_processed_game_index", default_start - 1)
    return checkpoint


def update_checkpoint(index: int, game_id: str) -> Dict[str, Any]:
    checkpoint = {
        "last_processed_game_index": index,
        "last_processed_game_id": game_id,
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    atomic_write_json(CHECKPOINT_PATH, checkpoint)
    return checkpoint


def resolve_wikipedia_image(title: str, cache: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if title in cache:
        return cache[title]
    normalized_title = urllib.parse.unquote(title).replace("_", " ")
    url = "https://en.wikipedia.org/api/rest_v1/page/summary/" + urllib.parse.quote(normalized_title)
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            data = json.loads(response.read().decode("utf-8"))
    except Exception as exc:  # noqa: BLE001
        cache[title] = {"status": "error", "error": str(exc)}
        atomic_write_json(SUMMARY_CACHE_PATH, cache)
        return None
    image_url = ((data.get("thumbnail") or {}).get("source")) or ((data.get("originalimage") or {}).get("source"))
    if not image_url:
        cache[title] = {"status": "missing_image"}
        atomic_write_json(SUMMARY_CACHE_PATH, cache)
        return None
    record = {"status": "ok", "title": title, "source_url": image_url, "page_title": data.get("title")}
    cache[title] = record
    atomic_write_json(SUMMARY_CACHE_PATH, cache)
    return record


def download_source_image(url: str) -> Path:
    SOURCE_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    parsed = urllib.parse.urlparse(url)
    ext = Path(parsed.path).suffix.lower() if Path(parsed.path).suffix else ".img"
    cache_name = "src_" + hashlib.sha1(url.encode("utf-8")).hexdigest()[:20]
    cache_path = SOURCE_CACHE_DIR / f"{cache_name}{ext}"
    if cache_path.exists():
        return cache_path
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=20) as response, cache_path.open("wb") as handle:
        shutil.copyfileobj(response, handle)
    return cache_path


def run_converter(source_path: Path, output_path: Path, report_path: Path) -> Dict[str, Any]:
    subprocess.run(
        [
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
            "128",
            "-WorkSize",
            "48",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return read_json(report_path, {})


def validate_report(report: Dict[str, Any]) -> Dict[str, Any]:
    opaque_ratio = float(report.get("opaque_ratio", 0))
    bbox = report.get("bbox") or {}
    bbox_ok = bool(bbox) and bbox.get("width", 0) >= 6 and bbox.get("height", 0) >= 6
    return {
        "specific_game_reference": True,
        "low_res_readable": 0.03 <= opaque_ratio <= 0.9 and bbox_ok,
        "gb_palette_ready": True,
        "opaque_ratio": opaque_ratio,
        "bbox": bbox,
    }


def build_metadata(game: Dict[str, Any], entry: Optional[Dict[str, Any]], asset_dir: Path, sprite_path: Path, source_path: Path, candidate: Candidate, validation: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "game": game["title"],
        "game_id": game["id"],
        "console": game["console"],
        "year": game.get("year"),
        "asset_type": type_to_metadata_asset(candidate.type_key),
        "asset_name": candidate.asset_name,
        "source_type": candidate.source_type,
        "image_reference": candidate.image_reference,
        "selection_reason": candidate.selection_reason,
        "episode_number": infer_episode_number(game["title"]),
        "publisher": resolve_publisher(game, entry),
        "title_font": choose_title_font(game["title"]),
        "display_layout": "sprite_identity_card",
        "sprite_path": str(sprite_path.relative_to(ROOT)).replace("\\", "/"),
        "source_path": str(source_path.relative_to(ROOT)).replace("\\", "/"),
        "asset_dir": str(asset_dir.relative_to(ROOT)).replace("\\", "/"),
        "palette": PALETTE,
        "validation": validation,
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


def build_library_entry(metadata: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "game_id": metadata["game_id"],
        "game": metadata["game"],
        "year": metadata["year"],
        "publisher": metadata["publisher"],
        "episode_number": metadata["episode_number"],
        "asset_type": metadata["asset_type"],
        "asset_name": metadata["asset_name"],
        "source_type": metadata["source_type"],
        "image_reference": metadata["image_reference"],
        "selection_reason": metadata["selection_reason"],
        "title_font": metadata["title_font"],
        "display_layout": metadata["display_layout"],
        "sprite_path": metadata["sprite_path"],
        "status": "ready",
    }


def write_library(entries: Dict[str, Any], archived_games: List[Dict[str, Any]], checkpoint: Dict[str, Any]) -> None:
    payload = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "version": "1.0",
        "checkpoint": checkpoint,
        "stats": {"ready": len(entries), "archived": len(archived_games)},
        "entries": entries,
        "archivedGames": archived_games,
    }
    atomic_write_json(LIBRARY_JSON_PATH, payload)
    atomic_write_text(LIBRARY_JS_PATH, "window.RETRODECK_ASSET_LIBRARY = " + json.dumps(payload, indent=2, ensure_ascii=False) + ";\n")


def archive_game(game: Dict[str, Any], reason: str, archived_games: List[Dict[str, Any]]) -> None:
    archived_games[:] = [item for item in archived_games if item.get("game_id") != game["id"]]
    archived_games.append({
        "game_id": game["id"],
        "game": game["title"],
        "console": game["console"],
        "year": game.get("year"),
        "reason": reason,
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    })
    atomic_write_json(ARCHIVED_PATH, archived_games)


def main() -> int:
    parser = argparse.ArgumentParser(description="Build the RetroDex asset library with checkpoint-safe writes.")
    parser.add_argument("--limit", type=int, default=0, help="Process at most N games in this run.")
    parser.add_argument("--force", action="store_true", help="Rebuild completed entries.")
    parser.add_argument("--start-index", type=int, default=None, help="Override the automatic resume position.")
    args = parser.parse_args()

    catalog = read_json(CATALOG_PATH, [])
    entries = read_json(ENTRIES_PATH, {})
    artwork_data = load_artwork_data()
    wiki_map = load_wiki_map()
    summary_cache = read_json(SUMMARY_CACHE_PATH, {})
    library_payload = read_json(LIBRARY_JSON_PATH, {})
    library_entries = library_payload.get("entries", {})
    archived_games = read_json(ARCHIVED_PATH, library_payload.get("archivedGames", []))

    ASSET_ROOT.mkdir(parents=True, exist_ok=True)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    SOURCE_CACHE_DIR.mkdir(parents=True, exist_ok=True)

    checkpoint = get_checkpoint(args.start_index or 0)
    start_index = args.start_index if args.start_index is not None else int(checkpoint.get("last_processed_game_index", -1)) + 1
    processed = 0

    for index, game in enumerate(catalog):
        if index < start_index:
            continue
        if args.limit and processed >= args.limit:
            break

        entry = entries.get(game["id"])
        asset_dir = ASSET_ROOT / slugify_game(game["id"])
        metadata_path = asset_dir / "metadata.json"
        sprite_path = asset_dir / "sprite.png"
        report_path = asset_dir / "conversion_report.json"

        if metadata_path.exists() and sprite_path.exists() and not args.force:
            metadata = read_json(metadata_path, {})
            if metadata:
                library_entries[game["id"]] = build_library_entry(metadata)
                checkpoint = update_checkpoint(index, game["id"])
                write_library(library_entries, archived_games, checkpoint)
                processed += 1
                continue

        candidates = build_candidates(game, artwork_data, wiki_map)
        if not candidates:
            archive_game(game, "no_asset_candidate", archived_games)
            checkpoint = update_checkpoint(index, game["id"])
            append_log({"timestamp": checkpoint["updated_at"], "game_id": game["id"], "status": "archived", "reason": "no_asset_candidate"})
            write_library(library_entries, archived_games, checkpoint)
            processed += 1
            continue

        candidate = candidates[0]
        fallback_conditions = list(candidate.fallback_conditions or [])
        try:
            if candidate.local_path:
                if not candidate.local_path.exists():
                    raise FileNotFoundError(f"Local asset not found: {candidate.local_path}")
                source_path = candidate.local_path
            else:
                resolved = resolve_wikipedia_image(candidate.wiki_title or candidate.image_reference, summary_cache)
                if not resolved or not resolved.get("source_url"):
                    raise RuntimeError(f"Could not resolve image for {candidate.image_reference}")
                source_path = download_source_image(resolved["source_url"])

            asset_dir.mkdir(parents=True, exist_ok=True)
            report = run_converter(source_path, sprite_path, report_path)
            validation = validate_report(report)
            if not validation["low_res_readable"]:
                fallback_conditions.append("low_res_validation_warning")

            metadata = build_metadata(game, entry, asset_dir, sprite_path, source_path, candidate, validation)
            metadata["fallback_conditions"] = fallback_conditions
            atomic_write_json(metadata_path, metadata)

            library_entries[game["id"]] = build_library_entry(metadata)
            archived_games[:] = [item for item in archived_games if item.get("game_id") != game["id"]]
            atomic_write_json(ARCHIVED_PATH, archived_games)
            checkpoint = update_checkpoint(index, game["id"])
            append_log({
                "timestamp": checkpoint["updated_at"],
                "game_id": game["id"],
                "status": "ready",
                "asset_name": metadata["asset_name"],
                "asset_type": metadata["asset_type"],
                "selection_reason": metadata["selection_reason"],
                "fallback_conditions": fallback_conditions,
            })
            write_library(library_entries, archived_games, checkpoint)
        except Exception as exc:  # noqa: BLE001
            archive_game(game, f"pipeline_error: {exc}", archived_games)
            checkpoint = update_checkpoint(index, game["id"])
            append_log({"timestamp": checkpoint["updated_at"], "game_id": game["id"], "status": "archived", "reason": str(exc), "fallback_conditions": fallback_conditions})
            write_library(library_entries, archived_games, checkpoint)

        processed += 1

    checkpoint = get_checkpoint()
    write_library(library_entries, archived_games, checkpoint)
    print(f"Processed {processed} game(s). Ready entries: {len(library_entries)}. Archived: {len(archived_games)}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
