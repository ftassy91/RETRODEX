from __future__ import annotations

import argparse
import os
import sqlite3
from pathlib import Path
from random import Random
from typing import Iterable

from PIL import Image, ImageColor, ImageDraw, ImageFont


WIDTH = 320
HEIGHT = 180
TITLE_BAR_HEIGHT = 16
BATCH_SIZE = 50

PALETTES = {
    "Atari Lynx": ["#0a0a1a", "#1a1a3d", "#3a3a8b", "#8888dd"],
    "Dreamcast": ["#05101a", "#0f2535", "#1a558b", "#55aae8"],
    "Game Boy": ["#0f380f", "#306230", "#8bac0f", "#9bbc0f"],
    "Game Boy Advance": ["#05051a", "#0f1a3d", "#1a3d8b", "#44aadd"],
    "Game Gear": ["#051a05", "#0f3d0f", "#1a8b1a", "#55e855"],
    "Neo Geo": ["#1a0505", "#3d1010", "#8b2020", "#e86060"],
    "Nintendo 64": ["#1a1a05", "#3d3d0f", "#8b7a00", "#ddc420"],
    "Nintendo DS": ["#05051a", "#0f1a3d", "#2a5a9b", "#7ab4e8"],
    "Nintendo Entertainment System": ["#1a1a2e", "#16213e", "#0f3460", "#e94560"],
    "PlayStation": ["#050520", "#0f0f45", "#1a1a8b", "#4444dd"],
    "Sega Genesis": ["#1a0a2e", "#2d1654", "#6a3fa0", "#c48be8"],
    "Sega Master System": ["#1a0a05", "#3d1a0f", "#8b3d1a", "#e8885a"],
    "Sega Saturn": ["#1a0505", "#3d0f0f", "#8b1a1a", "#e85555"],
    "Super Nintendo": ["#0d0d0d", "#1a3a1a", "#2d6a2d", "#7abf7a"],
    "TurboGrafx-16": ["#05051a", "#10103d", "#20208b", "#6060dd"],
    "WonderSwan": ["#1a1a0a", "#3d3d1a", "#8b8b2a", "#dddd6a"],
}
DEFAULT_PALETTE = PALETTES["Game Boy"]


def hash_str(value: str) -> int:
    result = 0
    for char in value:
        result = ((31 * result) + ord(char)) & 0xFFFFFFFF
    return abs(result) % (2 ** 31)


def load_repo_env(repo_root: Path) -> None:
    env_path = repo_root / ".env"
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if key and value and key not in os.environ:
            os.environ[key] = value


def resolve_paths() -> tuple[Path, Path]:
    script_path = Path(__file__).resolve()
    repo_root = script_path.parents[2]
    load_repo_env(repo_root)

    db_value = os.environ.get("RETRODEX_SQLITE_PATH", "./backend/storage/retrodex.sqlite")
    sqlite_path = (repo_root / db_value).resolve()
    output_dir = repo_root / "assets" / "generated_gb"
    output_dir.mkdir(parents=True, exist_ok=True)
    return sqlite_path, output_dir


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        Path("C:/Windows/Fonts/consola.ttf"),
        Path("C:/Windows/Fonts/lucon.ttf"),
        Path("C:/Windows/Fonts/cour.ttf"),
    ]

    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)

    return ImageFont.load_default()


def palette_for(console_name: str | None) -> list[tuple[int, int, int]]:
    colors = PALETTES.get(str(console_name or "").strip(), DEFAULT_PALETTE)
    return [ImageColor.getrgb(color) for color in colors]


def draw_title_card(draw: ImageDraw.ImageDraw, rng: Random, colors: list[tuple[int, int, int]]) -> None:
    darkest, dark, light, lightest = colors
    frame_w = int(WIDTH * 0.6)
    frame_h = int((HEIGHT - TITLE_BAR_HEIGHT) * 0.4)
    frame_x = (WIDTH - frame_w) // 2
    frame_y = max(12, ((HEIGHT - TITLE_BAR_HEIGHT) - frame_h) // 2 - 6)

    draw.rectangle((0, 0, WIDTH, HEIGHT), fill=darkest)
    draw.rectangle((frame_x, frame_y, frame_x + frame_w, frame_y + frame_h), fill=dark)

    corners = [
        (10, 10),
        (WIDTH - 16, 10),
        (10, HEIGHT - TITLE_BAR_HEIGHT - 16),
        (WIDTH - 16, HEIGHT - TITLE_BAR_HEIGHT - 16),
    ]
    for x, y in corners:
        draw.rectangle((x, y, x + 4, y + 4), fill=lightest)
        draw.rectangle((x - 6, y, x - 2, y + 4), fill=lightest)
        draw.rectangle((x, y + 6, x + 4, y + 10), fill=lightest)

    for row in range(3):
        blocks = rng.randint(6, 11)
        start_x = frame_x + 18 + rng.randint(0, 16)
        start_y = frame_y + 16 + (row * 16)
        for col in range(blocks):
            if rng.randint(0, 4) == 0:
                continue
            x = start_x + (col * 10)
            draw.rectangle((x, start_y, x + 6, start_y + 4), fill=light)


def draw_scanline_grid(draw: ImageDraw.ImageDraw, rng: Random, colors: list[tuple[int, int, int]]) -> None:
    darkest, dark, light, _ = colors
    usable_height = HEIGHT - TITLE_BAR_HEIGHT
    center_x = WIDTH // 2
    center_y = usable_height // 2
    radius = int(usable_height * 0.3)

    draw.rectangle((0, 0, WIDTH, HEIGHT), fill=darkest)
    for y in range(0, usable_height, 4):
        draw.line((0, y, WIDTH, y), fill=dark, width=1)

    draw.ellipse(
        (center_x - radius, center_y - radius, center_x + radius, center_y + radius),
        fill=light,
    )
    inner = max(6, radius - 12)
    draw.ellipse(
        (center_x - inner, center_y - inner, center_x + inner, center_y + inner),
        fill=dark,
    )


def draw_pixel_terrain(draw: ImageDraw.ImageDraw, rng: Random, colors: list[tuple[int, int, int]]) -> None:
    darkest, dark, light, lightest = colors
    usable_height = HEIGHT - TITLE_BAR_HEIGHT
    horizon = int(usable_height * 0.4)

    draw.rectangle((0, 0, WIDTH, horizon), fill=dark)
    draw.rectangle((0, horizon, WIDTH, usable_height), fill=darkest)

    for _ in range(rng.randint(5, 8)):
        bump_w = rng.randint(26, 60)
        bump_h = rng.randint(14, 42)
        bump_x = rng.randint(0, max(0, WIDTH - bump_w))
        draw.rectangle((bump_x, usable_height - bump_h - 20, bump_x + bump_w, usable_height - 20), fill=light)

    sun_x = WIDTH - 28
    sun_y = 12
    draw.rectangle((sun_x, sun_y, sun_x + 8, sun_y + 8), fill=lightest)
    draw.rectangle((sun_x + 4, sun_y - 4, sun_x + 12, sun_y + 4), fill=lightest)
    draw.rectangle((sun_x + 8, sun_y, sun_x + 16, sun_y + 8), fill=lightest)
    draw.rectangle((sun_x + 4, sun_y + 4, sun_x + 12, sun_y + 12), fill=lightest)


def draw_sprite_frame(draw: ImageDraw.ImageDraw, rng: Random, colors: list[tuple[int, int, int]]) -> None:
    darkest, dark, light, lightest = colors
    usable_height = HEIGHT - TITLE_BAR_HEIGHT
    block = 16
    origin_x = (WIDTH - (block * 5)) // 2
    origin_y = max(8, (usable_height - (block * 5)) // 2 - 8)
    is_diamond = rng.randint(0, 1) == 0
    coordinates = (
        [(2, 0), (1, 1), (2, 1), (3, 1), (0, 2), (1, 2), (2, 2), (3, 2), (4, 2), (1, 3), (2, 3), (3, 3), (2, 4)]
        if is_diamond
        else [(2, 0), (2, 1), (0, 2), (1, 2), (2, 2), (3, 2), (4, 2), (2, 3), (2, 4), (1, 1), (3, 1), (1, 3), (3, 3)]
    )

    draw.rectangle((0, 0, WIDTH, HEIGHT), fill=darkest)
    for index, (x, y) in enumerate(coordinates):
        color = light if (index + rng.randint(0, 1)) % 2 == 0 else lightest
        left = origin_x + (x * block)
        top = origin_y + (y * block)
        draw.rectangle((left, top, left + block - 2, top + block - 2), fill=color)

    draw.rectangle((34, usable_height - 18, WIDTH - 34, usable_height - 6), fill=dark)
    bar_width = int((WIDTH - 76) * (0.35 + (rng.randint(0, 50) / 100)))
    draw.rectangle((38, usable_height - 15, 38 + bar_width, usable_height - 9), fill=lightest)


def draw_map_view(draw: ImageDraw.ImageDraw, rng: Random, colors: list[tuple[int, int, int]]) -> None:
    darkest, dark, light, lightest = colors
    usable_height = HEIGHT - TITLE_BAR_HEIGHT
    origin_x = 16
    origin_y = 16
    cell_w = (WIDTH - 32) // 8
    cell_h = (usable_height - 32) // 6
    tones = [darkest, dark, light]

    draw.rectangle((0, 0, WIDTH, HEIGHT), fill=darkest)
    for row in range(6):
        for col in range(8):
            tone = tones[rng.randint(0, len(tones) - 1)]
            left = origin_x + (col * cell_w)
            top = origin_y + (row * cell_h)
            draw.rectangle((left, top, left + cell_w - 2, top + cell_h - 2), fill=tone)

    cursor_col = rng.randint(0, 7)
    cursor_row = rng.randint(0, 5)
    left = origin_x + (cursor_col * cell_w)
    top = origin_y + (cursor_row * cell_h)
    draw.rectangle((left, top, left + cell_w - 2, top + cell_h - 2), outline=lightest, width=2)


def draw_boss_frame(draw: ImageDraw.ImageDraw, rng: Random, colors: list[tuple[int, int, int]]) -> None:
    darkest, dark, light, lightest = colors
    usable_height = HEIGHT - TITLE_BAR_HEIGHT
    frame_w = int(WIDTH * 0.7)
    frame_h = int(usable_height * 0.7)
    frame_x = (WIDTH - frame_w) // 2
    frame_y = max(8, (usable_height - frame_h) // 2 - 6)

    draw.rectangle((0, 0, WIDTH, HEIGHT), fill=darkest)
    draw.rectangle((frame_x, frame_y, frame_x + frame_w, frame_y + frame_h), outline=lightest, width=2)
    draw.rectangle((frame_x + 18, frame_y + 18, frame_x + frame_w - 18, frame_y + frame_h - 18), fill=dark)

    eye_size = rng.randint(14, 26)
    eye_y = frame_y + int(frame_h * 0.28)
    left_eye_x = frame_x + int(frame_w * 0.28)
    right_eye_x = frame_x + int(frame_w * 0.62) - eye_size
    draw.rectangle((left_eye_x, eye_y, left_eye_x + eye_size, eye_y + eye_size), fill=lightest)
    draw.rectangle((right_eye_x, eye_y, right_eye_x + eye_size, eye_y + eye_size), fill=lightest)

    mouth_w = int(frame_w * (0.18 + (rng.randint(0, 9) / 100)))
    mouth_x = (WIDTH - mouth_w) // 2
    mouth_y = frame_y + int(frame_h * 0.62)
    draw.rectangle((mouth_x, mouth_y, mouth_x + mouth_w, mouth_y + 8), fill=lightest)

    draw.rectangle((40, usable_height - 14, WIDTH - 40, usable_height - 4), fill=dark)
    hp_width = int((WIDTH - 88) * (0.45 + (rng.randint(0, 45) / 100)))
    draw.rectangle((44, usable_height - 11, 44 + hp_width, usable_height - 7), fill=light)


def draw_style(image: Image.Image, game: sqlite3.Row) -> None:
    colors = palette_for(game["console"])
    seed = hash_str(game["id"] or game["title"] or "")
    rng = Random(seed)
    style_index = seed % 6
    draw = ImageDraw.Draw(image, "RGBA")

    if style_index == 0:
        draw_title_card(draw, rng, colors)
    elif style_index == 1:
        draw_scanline_grid(draw, rng, colors)
    elif style_index == 2:
        draw_pixel_terrain(draw, rng, colors)
    elif style_index == 3:
        draw_sprite_frame(draw, rng, colors)
    elif style_index == 4:
        draw_map_view(draw, rng, colors)
    else:
        draw_boss_frame(draw, rng, colors)

    title = (game["title"] or game["id"] or "Unknown").strip()[:20]
    draw.rectangle((0, HEIGHT - TITLE_BAR_HEIGHT, WIDTH, HEIGHT), fill=(0, 0, 0, 180))
    font = load_font(10)
    draw.text((8, HEIGHT - TITLE_BAR_HEIGHT + 3), title, fill=(255, 255, 255, 255), font=font)


def fetch_games(connection: sqlite3.Connection, limit: int | None) -> list[sqlite3.Row]:
    sql = """
        SELECT id, title, console, genre, rarity
        FROM games
        ORDER BY title ASC
    """
    params: tuple[int, ...] = ()
    if limit:
        sql += " LIMIT ?"
        params = (limit,)
    cursor = connection.execute(sql, params)
    return cursor.fetchall()


def iter_batches(items: Iterable[sqlite3.Row], batch_size: int) -> Iterable[list[sqlite3.Row]]:
    batch: list[sqlite3.Row] = []
    for item in items:
        batch.append(item)
        if len(batch) == batch_size:
            yield batch
            batch = []
    if batch:
        yield batch


def generate_assets(limit: int | None) -> int:
    sqlite_path, output_dir = resolve_paths()
    if not sqlite_path.exists():
        raise FileNotFoundError(f"SQLite database not found: {sqlite_path}")

    connection = sqlite3.connect(sqlite_path)
    connection.row_factory = sqlite3.Row
    try:
        games = fetch_games(connection, limit)
    finally:
        connection.close()

    total = len(games)
    generated = 0
    skipped = 0
    failed = 0
    processed = 0

    for batch_index, batch in enumerate(iter_batches(games, BATCH_SIZE), start=1):
        for game in batch:
            processed += 1
            output_path = output_dir / f"{game['id']}.png"
            print(f"[{processed}/{total}] Generating: {game['id']} ...")

            if output_path.exists():
                skipped += 1
                continue

            try:
                image = Image.new("RGBA", (WIDTH, HEIGHT), color=palette_for(game["console"])[0])
                draw_style(image, game)
                image.save(output_path, format="PNG")
                generated += 1
            except Exception as error:  # noqa: BLE001
                failed += 1
                print(f"  FAILED: {game['id']} -> {error}")

        print(f"[{min(processed, total)}/{total}] Batch {batch_index} complete.")

    print("")
    print("Generation complete.")
    print(f"Generated: {generated}")
    print(f"Skipped: {skipped}")
    print(f"Failed: {failed}")
    return 0 if failed == 0 else 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate RetroDex GB-style top-screen assets from SQLite.")
    parser.add_argument("--limit", type=int, default=None, help="Optional cap on the number of games to process.")
    args = parser.parse_args()
    return generate_assets(args.limit)


if __name__ == "__main__":
    raise SystemExit(main())
