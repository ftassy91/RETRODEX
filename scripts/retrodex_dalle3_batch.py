"""
retrodex_dalle3_batch.py
------------------------
Lit les prompt packs RetroDex, filtre les packs approuves, appelle DALL-E 3
via l'API OpenAI, sauvegarde les images et ecrit un rapport de batch.

Usage:
    python scripts/retrodex_dalle3_batch.py
    python scripts/retrodex_dalle3_batch.py --retry-failed dalle3_20260322T000000Z

Variables d'environnement:
    OPENAI_API_KEY        requis en production
    RETRODEX_BATCH_DIR    glob vers les packs json
    RETRODEX_OUTPUT_DIR   dossier de sortie de base
    RETRODEX_DRY_RUN      "1" pour simuler sans appel API
"""

from __future__ import annotations

import argparse
import csv
import glob
import hashlib
import json
import logging
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

try:
    import openai
except ImportError:
    openai = None

try:
    import requests
except ImportError:
    requests = None


ROOT = Path(__file__).resolve().parent.parent
BATCH_GLOB = os.environ.get(
    "RETRODEX_BATCH_DIR",
    str(ROOT / "assets" / "retrodex" / "prompt_packs" / "*" / "packs" / "*.json"),
)
OUTPUT_DIR = Path(os.environ.get("RETRODEX_OUTPUT_DIR", str(ROOT / "assets" / "covers")))
REPORT_DIR = ROOT / "assets" / "retrodex" / "generation_reports"
DRY_RUN = os.environ.get("RETRODEX_DRY_RUN", "0") == "1"
API_KEY = os.environ.get("OPENAI_API_KEY", "")

DALLE_MODEL = "dall-e-3"
DALLE_SIZE = "1024x1024"
DALLE_QUALITY = "standard"
DALLE_STYLE = "vivid"

MAX_IMAGES = int(os.environ.get("RETRODEX_MAX_IMAGES", "10"))
RETRY_MAX = 2
RETRY_DELAY = 8

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("retrodex.dalle3")


def parse_args():
    parser = argparse.ArgumentParser(description="RetroDex DALL-E 3 batch generator.")
    parser.add_argument("--retry-failed", type=str, default="", help="Batch id d'un rapport precedent a relancer.")
    parser.add_argument(
        "--include-pending-review",
        action="store_true",
        help="Autorise les packs READY_FOR_REVIEW/PENDING_REVIEW en plus des APPROVED.",
    )
    parser.add_argument("--max-images", type=int, default=MAX_IMAGES, help="Nombre maximum d'images a traiter.")
    return parser.parse_args()


def load_packs(pattern: str) -> list[dict]:
    files = sorted(glob.glob(pattern, recursive=True))
    if not files:
        log.warning("Aucun pack trouve avec : %s", pattern)
        return []
    packs = []
    for fp in files:
        try:
            with open(fp, encoding="utf-8") as handle:
                data = json.load(handle)
            data["_source_file"] = fp
            packs.append(data)
        except Exception as exc:
            log.warning("Impossible de lire %s : %s", fp, exc)
    return packs


def derive_run_id_from_pack(pack: dict) -> str | None:
    source = Path(pack.get("_source_file", ""))
    parts = source.parts
    if "prompt_packs" not in parts:
        return None
    index = parts.index("prompt_packs")
    if index + 1 < len(parts):
        return parts[index + 1]
    return None


def load_review_maps(packs: list[dict]) -> dict[str, dict[str, dict]]:
    review_maps: dict[str, dict[str, dict]] = {}
    run_ids = {derive_run_id_from_pack(pack) for pack in packs}
    for run_id in sorted(value for value in run_ids if value):
        review_path = ROOT / "assets" / "retrodex" / "review" / run_id / "review_queue.csv"
        if not review_path.exists():
            continue
        review_map: dict[str, dict] = {}
        with review_path.open(encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                review_map[row.get("game_id", "")] = row
        review_maps[run_id] = review_map
    return review_maps


def filter_approved(packs: list[dict], include_pending_review: bool = False) -> list[dict]:
    review_maps = load_review_maps(packs)
    approved = []
    saw_review_queue = False
    for pack in packs:
        run_id = derive_run_id_from_pack(pack)
        row = review_maps.get(run_id, {}).get(game_id(pack), {})
        if row:
            saw_review_queue = True
        selected = str(row.get("selected_for_generation", "")).strip().lower() in {"1", "true", "yes", "y"}
        decision = str(row.get("decision", "")).strip().upper()
        status = str(pack.get("status") or pack.get("review_status") or "").strip().upper()
        if decision == "APPROVED" or selected or status == "APPROVED":
            approved.append(pack)
            continue
        if include_pending_review and (
            decision in {"PENDING_REVIEW", "READY_FOR_REVIEW"}
            or status in {"PENDING_REVIEW", "READY_FOR_REVIEW"}
        ):
            approved.append(pack)
    if approved:
        return approved
    if saw_review_queue:
        if include_pending_review:
            log.warning("Aucune ligne exploitable dans les review_queue.csv detectees")
        else:
            log.warning(
                "Aucune ligne review APPROVED/selected_for_generation detectee. "
                "Marque des packs APPROVED dans review_queue.csv ou relance avec --include-pending-review."
            )
        return []
    log.info("Aucun pack APPROVED — on prend tous les packs disponibles")
    return packs


def extract_prompt(pack: dict) -> tuple[str, str]:
    positive = (
        pack.get("prompt")
        or pack.get("positive_prompt")
        or pack.get("main_prompt")
        or pack.get("generation_prompt")
        or ""
    ).strip()
    negative = (
        pack.get("negative_prompt")
        or pack.get("negative")
        or ""
    ).strip()
    if not positive:
        parts = []
        for key in ["scene_description", "art_direction", "artistic_direction", "platform_style_description"]:
            if pack.get(key):
                parts.append(str(pack[key]).strip())
        positive = ". ".join(parts)
    return normalize_prompt_text(positive), negative


def normalize_prompt_text(prompt: str) -> str:
    text = prompt.strip()
    if not text:
        return text
    text = re.sub(r"\bA\s+(a|an|the)\s+", lambda m: f"{m.group(1).capitalize()} ", text)
    text = re.sub(r"\bAn\s+(a|an|the)\s+", lambda m: f"{m.group(1).capitalize()} ", text)
    return text


def game_id(pack: dict) -> str:
    return (
        pack.get("game_id")
        or pack.get("id")
        or pack.get("slug")
        or hashlib.md5(str(pack.get("title", "unknown")).encode("utf-8")).hexdigest()[:12]
    )


def title_of(pack: dict) -> str:
    return pack.get("title") or pack.get("game_title") or game_id(pack)


def build_dalle_safety_suffix() -> str:
    return (
        "Important safety constraints: create a fully original scene. "
        "No copyrighted characters, no logos, no box art, no screenshots, no UI, "
        "no recognizable branded mascots, and no direct copies of costume, weapon, creature, or symbol designs."
    )


def call_dalle3(client, prompt: str, negative: str) -> dict:
    full_prompt = f"{prompt}\n\n{build_dalle_safety_suffix()}"
    full_prompt = full_prompt[:4000]
    response = client.images.generate(
        model=DALLE_MODEL,
        prompt=full_prompt,
        size=DALLE_SIZE,
        quality=DALLE_QUALITY,
        style=DALLE_STYLE,
        n=1,
    )
    return {
        "url": response.data[0].url,
        "revised_prompt": getattr(response.data[0], "revised_prompt", "") or "",
        "full_prompt": full_prompt,
    }


def download_image(url: str, dest: Path) -> bool:
    if requests is None:
        log.error("requests non installe; impossible de telecharger %s", url)
        return False
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(response.content)
        return True
    except Exception as exc:
        log.error("Telechargement echoue (%s) : %s", url, exc)
        return False


def load_failed_ids(batch_id: str) -> set[str]:
    report_path = REPORT_DIR / f"report_{batch_id}.json"
    if not report_path.exists():
        log.warning("Rapport introuvable pour retry-failed: %s", report_path)
        return set()
    with report_path.open(encoding="utf-8") as handle:
        rows = json.load(handle)
    return {row["game_id"] for row in rows if row.get("status") != "ok"}


def is_fatal_account_error(exc: Exception) -> bool:
    if openai is None or not isinstance(exc, openai.BadRequestError):
        return False
    response = getattr(exc, "response", None)
    data = getattr(response, "json", None)
    payload = data() if callable(data) else {}
    error = payload.get("error", {}) if isinstance(payload, dict) else {}
    code = str(error.get("code") or "").lower()
    message = str(error.get("message") or exc).lower()
    return code in {"billing_hard_limit", "insufficient_quota"} or "billing hard limit" in message


def write_sidecar(output_path: Path, payload: dict):
    output_path.with_suffix(".json").write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


def write_report(results: list[dict], batch_id: str) -> Path:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    report_path = REPORT_DIR / f"report_{batch_id}.json"
    summary_path = REPORT_DIR / f"summary_{batch_id}.md"

    report_path.write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8")

    ok_rows = [row for row in results if row["status"] == "ok"]
    failed_rows = [row for row in results if row["status"] not in {"ok", "dry_run"}]

    lines = [
        f"# Rapport batch DALL-E 3 - {batch_id}",
        "",
        f"**Date :** {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
        f"**Total :** {len(results)} jeux",
        f"**OK :** {len(ok_rows)}",
        f"**Echec :** {len(failed_rows)}",
        f"**Mode :** {'DRY RUN' if DRY_RUN else 'PRODUCTION'}",
        "",
        "## Resultats",
        "",
    ]
    for row in results:
        icon = "OK" if row["status"] == "ok" else ("DRY" if row["status"] == "dry_run" else "KO")
        line = f"- {icon} `{row['game_id']}` - {row['status']}"
        if row.get("output_path"):
            line += f" -> `{row['output_path']}`"
        if row.get("error"):
            line += f" | {row['error']}"
        lines.append(line)
    if failed_rows:
        lines.extend([
            "",
            "## Echecs a relancer",
            "",
            "```bash",
            f"python scripts/retrodex_dalle3_batch.py --retry-failed {batch_id}",
            "```",
        ])
    summary_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return summary_path


def ensure_dependencies():
    if DRY_RUN:
        return
    if not API_KEY:
        sys.exit("OPENAI_API_KEY manquante. Exporte la variable et relance.")
    if openai is None:
        sys.exit("openai non installe. Lance : pip install openai")
    if requests is None:
        sys.exit("requests non installe. Lance : pip install requests")


def main():
    args = parse_args()
    batch_id = datetime.now(timezone.utc).strftime("dalle3_%Y%m%dT%H%M%SZ")
    results = []

    ensure_dependencies()

    log.info("RetroDex - DALL-E 3 batch %s", batch_id)
    log.info("Mode : %s", "DRY RUN" if DRY_RUN else "PRODUCTION")

    all_packs = load_packs(BATCH_GLOB)
    packs = filter_approved(all_packs, include_pending_review=args.include_pending_review)

    if args.retry_failed:
        failed_ids = load_failed_ids(args.retry_failed)
        packs = [pack for pack in packs if game_id(pack) in failed_ids]

    packs = packs[: args.max_images]
    if not packs:
        log.warning("Aucun pack a traiter. Verifie RETRODEX_BATCH_DIR ou la review queue.")
        return

    log.info("%d packs charges (max %d)", len(packs), args.max_images)
    client = openai.OpenAI(api_key=API_KEY) if not DRY_RUN else None
    abort_batch = False

    batch_output_dir = OUTPUT_DIR / batch_id
    batch_output_dir.mkdir(parents=True, exist_ok=True)

    for index, pack in enumerate(packs, 1):
        if abort_batch:
            results.append({
                "game_id": game_id(pack),
                "title": title_of(pack),
                "status": "aborted",
                "error": "batch aborted after fatal account-level API error",
                "output_path": None,
            })
            continue
        gid = game_id(pack)
        title = title_of(pack)
        prompt, negative = extract_prompt(pack)
        output_path = batch_output_dir / f"{gid}.png"

        log.info("[%d/%d] %s", index, len(packs), title)

        if not prompt:
            results.append({
                "game_id": gid,
                "title": title,
                "status": "skipped",
                "error": "no prompt",
                "output_path": None,
            })
            continue

        if DRY_RUN:
            results.append({
                "game_id": gid,
                "title": title,
                "status": "dry_run",
                "error": None,
                "output_path": str(output_path),
                "prompt_preview": prompt[:160],
            })
            continue

        api_result = None
        last_error = None
        for attempt in range(1, RETRY_MAX + 2):
            try:
                api_result = call_dalle3(client, prompt, negative)
                break
            except Exception as exc:
                if openai and isinstance(exc, openai.BadRequestError):
                    if is_fatal_account_error(exc):
                        results.append({
                            "game_id": gid,
                            "title": title,
                            "status": "billing_hard_limit",
                            "error": str(exc)[:240],
                            "output_path": None,
                        })
                        api_result = None
                        last_error = exc
                        abort_batch = True
                        break
                    results.append({
                        "game_id": gid,
                        "title": title,
                        "status": "content_policy",
                        "error": str(exc)[:240],
                        "output_path": None,
                        "prompt": prompt[:300],
                    })
                    api_result = None
                    last_error = exc
                    break
                if openai and isinstance(exc, openai.RateLimitError):
                    last_error = exc
                    log.warning("Rate limit sur %s (tentative %d/%d)", gid, attempt, RETRY_MAX + 1)
                    if attempt <= RETRY_MAX:
                        time.sleep(RETRY_DELAY * attempt)
                        continue
                    results.append({
                        "game_id": gid,
                        "title": title,
                        "status": "rate_limit",
                        "error": "rate limit epuise",
                        "output_path": None,
                    })
                    api_result = None
                    break
                last_error = exc
                results.append({
                    "game_id": gid,
                    "title": title,
                    "status": "error",
                    "error": str(exc)[:240],
                    "output_path": None,
                })
                api_result = None
                break

        if api_result is None:
            if last_error:
                log.warning("  -> echec %s", str(last_error)[:160])
            continue

        ok = download_image(api_result["url"], output_path)
        sidecar = {
            "game_id": gid,
            "title": title,
            "source_pack": pack.get("_source_file"),
            "prompt": api_result["full_prompt"],
            "negative_prompt": negative,
            "revised_prompt": api_result.get("revised_prompt", ""),
            "batch_id": batch_id,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "status": "ok" if ok else "download_failed",
        }
        write_sidecar(output_path, sidecar)

        results.append({
            "game_id": gid,
            "title": title,
            "status": "ok" if ok else "download_failed",
            "error": None if ok else "telechargement echoue",
            "output_path": str(output_path) if ok else None,
            "revised_prompt": api_result.get("revised_prompt", "")[:240],
            "dalle_url": api_result["url"],
        })

        if index < len(packs):
            time.sleep(1.5)

    report = write_report(results, batch_id)
    ok_count = sum(1 for row in results if row["status"] in {"ok", "dry_run"})
    log.info("Batch termine : %d/%d items traites", ok_count, len(packs))
    log.info("Rapport -> %s", report)


if __name__ == "__main__":
    main()
