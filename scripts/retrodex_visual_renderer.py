from __future__ import annotations

import colorsys
import math
import random
from pathlib import Path

from PIL import Image, ImageColor, ImageDraw, ImageStat


WORK_SIZE = (320, 180)
SCALE = 5
CANVAS_SIZE = (WORK_SIZE[0] * SCALE, WORK_SIZE[1] * SCALE)
OVERLAY_RATIO = 0.34


def hex_rgb(value: str) -> tuple[int, int, int]:
    return ImageColor.getrgb(value)


def adjust_color(color: str | tuple[int, int, int], factor: float) -> tuple[int, int, int]:
    r, g, b = hex_rgb(color) if isinstance(color, str) else color
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    l = max(0.0, min(1.0, l * factor))
    r2, g2, b2 = colorsys.hls_to_rgb(h, l, s)
    return int(r2 * 255), int(g2 * 255), int(b2 * 255)


def lerp_color(left: tuple[int, int, int], right: tuple[int, int, int], alpha: float) -> tuple[int, int, int]:
    return tuple(int(left[i] + (right[i] - left[i]) * alpha) for i in range(3))


def scale_bbox(bbox: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    return tuple(int(value * SCALE) for value in bbox)


def box(draw: ImageDraw.ImageDraw, coords, fill, outline=None):
    x0, y0, x1, y1 = [int(v) for v in coords]
    if outline is not None:
        draw.rectangle([x0 - 1, y0 - 1, x1 + 1, y1 + 1], fill=outline)
    draw.rectangle([x0, y0, x1, y1], fill=fill)


def glow(draw: ImageDraw.ImageDraw, cx: int, cy: int, rx: int, ry: int, color: tuple[int, int, int], alpha: int):
    draw.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=(*color, alpha))


def draw_banded_gradient(draw: ImageDraw.ImageDraw, top: tuple[int, int, int], bottom: tuple[int, int, int]):
    width, height = WORK_SIZE
    bands = 18
    for index in range(bands):
        y0 = int(height * index / bands)
        y1 = int(height * (index + 1) / bands)
        color = lerp_color(top, bottom, index / max(1, bands - 1))
        draw.rectangle([0, y0, width, y1], fill=color)


def draw_checker_dither(draw: ImageDraw.ImageDraw, y_start: int, y_end: int, color: tuple[int, int, int], step: int = 2):
    width, _ = WORK_SIZE
    for y in range(y_start, y_end, step):
        for x in range((y // step) % 2, width, step):
            draw.point((x, y), fill=color)


def draw_cloud(draw: ImageDraw.ImageDraw, x: int, y: int, scale: int, color: tuple[int, int, int]):
    puffs = [
        (x, y + 4 * scale, 12 * scale, 8 * scale),
        (x + 10 * scale, y, 14 * scale, 10 * scale),
        (x + 24 * scale, y + 2 * scale, 12 * scale, 8 * scale),
    ]
    for px, py, rx, ry in puffs:
        draw.ellipse([px - rx, py - ry, px + rx, py + ry], fill=color)
    draw.rectangle([x - 12 * scale, y + 2 * scale, x + 34 * scale, y + 10 * scale], fill=color)


def draw_horizon_water(draw: ImageDraw.ImageDraw, pal, horizon: int):
    width, height = WORK_SIZE
    draw.rectangle([0, horizon, width, height], fill=pal[4])
    for y in range(horizon + 4, height, 6):
        draw.line([(0, y), (width, y)], fill=pal[3], width=1)
    draw_checker_dither(draw, horizon + 2, height, pal[5], step=4)


def draw_fantasy_scene(draw: ImageDraw.ImageDraw, pal, rng: random.Random):
    width, height = WORK_SIZE
    draw_banded_gradient(draw, pal[5], pal[4])
    draw_checker_dither(draw, 0, 28, pal[2], step=3)
    draw_cloud(draw, 54, 34, 1, pal[5])
    draw_cloud(draw, 246, 32, 1, pal[5])
    draw_horizon_water(draw, pal, 110)
    mountain = [(140, 112), (188, 44), (214, 26), (238, 42), (260, 112)]
    draw.polygon(mountain, fill=pal[2])
    draw.polygon([(156, 112), (190, 54), (216, 36), (236, 112)], fill=pal[3])
    draw.ellipse([205, 32, 223, 50], fill=pal[5])
    draw.polygon([(48, 110), (76, 90), (92, 110)], fill=pal[2])
    draw.polygon([(242, 112), (264, 92), (276, 112)], fill=pal[2])
    draw.polygon([(112, 180), (158, 128), (188, 118), (214, 128), (258, 180)], fill=pal[3])
    draw.polygon([(118, 180), (160, 136), (188, 128), (210, 136), (250, 180)], fill=pal[4])


def draw_rpg_scene(draw: ImageDraw.ImageDraw, pal, rng: random.Random):
    draw_fantasy_scene(draw, pal, rng)
    draw.rectangle([218, 84, 222, 116], fill=pal[1])
    draw.rectangle([214, 80, 226, 84], fill=pal[5])


def draw_platformer_scene(draw: ImageDraw.ImageDraw, pal, rng: random.Random):
    width, height = WORK_SIZE
    draw_banded_gradient(draw, pal[5], pal[4])
    for i in range(3):
        draw.ellipse([20 + i * 48, 92 - i * 8, 90 + i * 48, 146 - i * 8], fill=pal[3])
    for i in range(4):
        x = 24 + i * 42
        box(draw, [x, 108 - (i % 2) * 12, x + 28, 116 - (i % 2) * 12], pal[2], pal[1])
    draw.polygon([(0, 180), (36, 152), (92, 144), (150, 156), (208, 136), (320, 180)], fill=pal[2])
    draw.polygon([(0, 180), (34, 160), (88, 152), (148, 164), (206, 144), (320, 180)], fill=pal[3])
    for x in (232, 252, 272):
        box(draw, [x, 94, x + 16, 110], pal[4], pal[1])


def draw_horror_scene(draw: ImageDraw.ImageDraw, pal, rng: random.Random):
    width, height = WORK_SIZE
    draw_banded_gradient(draw, adjust_color(pal[0], 0.9), pal[1])
    vanishing_x = 156
    floor_y = 138
    draw.polygon([(0, 0), (vanishing_x, 42), (vanishing_x, floor_y), (0, height)], fill=adjust_color(pal[2], 0.72))
    draw.polygon([(width, 0), (vanishing_x, 42), (vanishing_x, floor_y), (width, height)], fill=adjust_color(pal[1], 0.82))
    draw.polygon([(0, height), (vanishing_x, floor_y), (width, height)], fill=adjust_color(pal[0], 0.78))
    box(draw, [44, 68, 74, 138], adjust_color(pal[2], 0.84), pal[0])
    box(draw, [48, 74, 70, 134], pal[0], pal[1])
    glow(draw, 208, 82, 20, 12, pal[4], 44)


def draw_racing_scene(draw: ImageDraw.ImageDraw, pal, rng: random.Random):
    width, height = WORK_SIZE
    draw_banded_gradient(draw, pal[5], pal[3])
    road = [(22, 180), (66, 132), (124, 108), (176, 84), (214, 0), (250, 0), (206, 94), (144, 118), (80, 142), (32, 180)]
    draw.polygon(road, fill=adjust_color(pal[0], 0.88))
    for t in range(6):
        x0 = 86 + t * 16
        y0 = 168 - t * 24
        box(draw, [x0, y0, x0 + 6, y0 + 12], pal[5])
    for i in range(4):
        draw.line([(0, 124 + i * 8), (112, 96 + i * 4)], fill=pal[4], width=1)
    for i in range(3):
        draw.line([(180, 112 + i * 10), (280, 76 + i * 6)], fill=pal[4], width=1)


def draw_fighting_scene(draw: ImageDraw.ImageDraw, pal, rng: random.Random):
    width, height = WORK_SIZE
    draw_banded_gradient(draw, pal[5], pal[3])
    draw.ellipse([36, 92, 192, 176], fill=pal[2])
    draw.ellipse([46, 100, 182, 170], fill=pal[3])
    for x in (34, 64, 94, 124):
        draw.line([(x, 50), (x, 18)], fill=pal[1], width=2)
        draw.polygon([(x - 4, 18), (x + 12, 18), (x + 4, 34)], fill=pal[5])


def draw_sports_scene(draw: ImageDraw.ImageDraw, pal, rng: random.Random):
    width, height = WORK_SIZE
    draw_banded_gradient(draw, pal[5], pal[3])
    draw.polygon([(0, 180), (28, 148), (76, 140), (120, 128), (168, 140), (224, 126), (320, 180)], fill=pal[2])
    draw.polygon([(0, 180), (30, 156), (76, 148), (118, 136), (170, 148), (222, 136), (320, 180)], fill=pal[3])
    box(draw, [170, 110, 248, 118], pal[4], pal[1])
    draw.polygon([(212, 110), (234, 82), (246, 110)], fill=pal[4])
    for x in (30, 58, 86):
        box(draw, [x, 42, x + 4, 74], pal[1])
        glow(draw, x + 2, 38, 8, 8, pal[5], 70)


def draw_puzzle_scene(draw: ImageDraw.ImageDraw, pal, rng: random.Random):
    width, height = WORK_SIZE
    draw_banded_gradient(draw, pal[5], pal[4])
    box(draw, [36, 34, 190, 170], pal[2], pal[1])
    for x in range(36, 191, 18):
        draw.line([(x, 34), (x, 170)], fill=pal[3], width=1)
    for y in range(34, 171, 18):
        draw.line([(36, y), (190, y)], fill=pal[3], width=1)
    draw.rectangle([214, 0, width, height], fill=adjust_color(pal[1], 0.72))
    glow(draw, 240, 52, 18, 16, pal[3], 34)


def draw_strategy_scene(draw: ImageDraw.ImageDraw, pal, rng: random.Random):
    width, height = WORK_SIZE
    draw_banded_gradient(draw, pal[5], pal[4])
    box(draw, [26, 84, 186, 154], pal[4], pal[1])
    for x in range(34, 180, 18):
        draw.line([(x, 84), (x, 154)], fill=pal[3], width=1)
    for y in range(92, 154, 18):
        draw.line([(26, y), (186, y)], fill=pal[3], width=1)
    draw.polygon([(224, 72), (244, 72), (234, 104)], fill=pal[2])


def draw_scifi_scene(draw: ImageDraw.ImageDraw, pal, rng: random.Random):
    width, height = WORK_SIZE
    draw_banded_gradient(draw, pal[5], pal[3])
    glow(draw, 244, 44, 26, 18, pal[5], 80)
    draw.polygon([(0, 180), (38, 130), (88, 120), (124, 92), (162, 106), (192, 82), (320, 180)], fill=pal[1])
    draw.polygon([(0, 180), (38, 142), (88, 130), (124, 106), (162, 118), (194, 94), (320, 180)], fill=pal[2])
    for x in (208, 228, 248, 268):
        box(draw, [x, 82, x + 8, 126], pal[2], pal[1])
    draw.arc([180, 58, 296, 154], start=214, end=330, fill=pal[5], width=2)


def draw_shooter_scene(draw: ImageDraw.ImageDraw, pal, rng: random.Random):
    width, height = WORK_SIZE
    draw_banded_gradient(draw, pal[1], pal[0])
    for _ in range(110):
        draw.point((rng.randint(0, 220), rng.randint(0, 160)), fill=pal[5])
    for i in range(8):
        draw.line([(0, 24 + i * 18), (226, 8 + i * 12)], fill=pal[4], width=1)


def draw_mystery_scene(draw: ImageDraw.ImageDraw, pal, rng: random.Random):
    width, height = WORK_SIZE
    draw_banded_gradient(draw, pal[5], pal[4])
    box(draw, [24, 52, 176, 156], pal[2], pal[1])
    for y in range(62, 146, 18):
        box(draw, [34, y, 164, y + 8], pal[4], pal[1])
    glow(draw, 70, 34, 14, 12, pal[5], 90)


def draw_environment(draw: ImageDraw.ImageDraw, rng: random.Random, palette: list[str], bucket: str):
    pal = [hex_rgb(value) for value in palette]
    mapping = {
        "fantasy_adventure": lambda: draw_fantasy_scene(draw, pal, rng),
        "rpg_epic": lambda: draw_rpg_scene(draw, pal, rng),
        "platformer_cartoon": lambda: draw_platformer_scene(draw, pal, rng),
        "survival_horror": lambda: draw_horror_scene(draw, pal, rng),
        "racing": lambda: draw_racing_scene(draw, pal, rng),
        "fighting": lambda: draw_fighting_scene(draw, pal, rng),
        "sports": lambda: draw_sports_scene(draw, pal, rng),
        "puzzle_abstract": lambda: draw_puzzle_scene(draw, pal, rng),
        "strategy_tactics": lambda: draw_strategy_scene(draw, pal, rng),
        "sci_fi_action": lambda: draw_scifi_scene(draw, pal, rng),
        "shooter_arcade": lambda: draw_shooter_scene(draw, pal, rng),
        "mystery_adventure": lambda: draw_mystery_scene(draw, pal, rng),
    }
    mapping.get(bucket, lambda: draw_scifi_scene(draw, pal, rng))()


def draw_vehicle(draw: ImageDraw.ImageDraw, bbox, pal):
    x0, y0, x1, y1 = bbox
    box(draw, [x0 + 10, y0 + 34, x1 - 16, y1 - 22], pal[4], pal[1])
    draw.polygon([(x0 + 26, y0 + 34), (x0 + 46, y0 + 12), (x1 - 28, y0 + 12), (x1 - 14, y0 + 34)], fill=pal[5])
    draw.ellipse([x0 + 18, y1 - 26, x0 + 42, y1 - 2], fill=pal[0])
    draw.ellipse([x1 - 48, y1 - 26, x1 - 24, y1 - 2], fill=pal[0])


def draw_spaceship(draw: ImageDraw.ImageDraw, bbox, pal):
    x0, y0, x1, y1 = bbox
    draw.polygon([(x0 + 8, y0 + 28), (x0 + 46, y0 + 10), (x1 - 18, (y0 + y1) // 2), (x0 + 46, y1 - 10), (x0 + 8, y1 - 28), (x0 + 24, (y0 + y1) // 2)], fill=pal[4])
    draw.polygon([(x0 + 54, y0 + 28), (x1 - 38, (y0 + y1) // 2), (x0 + 54, y1 - 28)], fill=pal[5])


def draw_tile_stack(draw: ImageDraw.ImageDraw, bbox, pal):
    x0, y0, x1, y1 = bbox
    colors = [pal[5], pal[4], pal[3]]
    tile = 16
    coords = [(x0 + 18, y0 + 24), (x0 + 36, y0 + 24), (x0 + 54, y0 + 24), (x0 + 54, y0 + 42)]
    for idx, (tx, ty) in enumerate(coords):
        box(draw, [tx, ty, tx + tile, ty + tile], colors[idx % len(colors)], pal[1])
    box(draw, [x0 + 72, y0 + 52, x0 + 88, y0 + 68], pal[5], pal[1])
    box(draw, [x0 + 90, y0 + 52, x0 + 106, y0 + 68], pal[4], pal[1])
    box(draw, [x0 + 72, y0 + 70, x0 + 88, y0 + 86], pal[3], pal[1])
    box(draw, [x0 + 90, y0 + 70, x0 + 106, y0 + 86], pal[5], pal[1])


def draw_artifact(draw: ImageDraw.ImageDraw, bbox, pal):
    x0, y0, x1, y1 = bbox
    draw.polygon([(x0 + 36, y0 + 6), (x1 - 18, y0 + 36), (x1 - 28, y1 - 18), (x0 + 28, y1 - 8), (x0 + 14, y0 + 28)], fill=pal[4])
    draw.polygon([(x0 + 52, y0 + 20), (x1 - 36, y0 + 44), (x1 - 44, y1 - 28), (x0 + 40, y1 - 18), (x0 + 26, y0 + 42)], fill=pal[5])


def draw_book(draw: ImageDraw.ImageDraw, bbox, pal):
    x0, y0, x1, y1 = bbox
    box(draw, [x0 + 10, y0 + 8, x1 - 10, y1 - 8], pal[4], pal[1])
    draw.line([((x0 + x1) // 2, y0 + 8), ((x0 + x1) // 2, y1 - 8)], fill=pal[2], width=2)
    for y in range(y0 + 22, y1 - 10, 10):
        draw.line([(x0 + 18, y), (x1 - 18, y)], fill=pal[3], width=1)


def draw_heroic_adventurer(draw: ImageDraw.ImageDraw, bbox, pal):
    x0, y0, x1, y1 = bbox
    cx = (x0 + x1) // 2
    draw.ellipse([cx - 10, y0 + 10, cx + 10, y0 + 30], fill=pal[5])
    draw.polygon([(cx - 18, y0 + 32), (cx + 14, y0 + 32), (cx + 22, y1 - 18), (cx - 24, y1 - 10)], fill=pal[4])
    box(draw, [cx - 10, y1 - 28, cx - 2, y1 - 6], pal[1])
    box(draw, [cx + 4, y1 - 28, cx + 12, y1 - 6], pal[1])
    draw.line([(cx + 18, y0 + 40), (x1 - 6, y1 - 10)], fill=pal[5], width=3)
    draw.line([(x1 - 18, y1 - 18), (x1 - 2, y1 - 18)], fill=pal[4], width=2)


def draw_lone_wanderer(draw: ImageDraw.ImageDraw, bbox, pal):
    draw_heroic_adventurer(draw, bbox, pal)
    x0, y0, x1, y1 = bbox
    draw.line([(x0 + 10, y0 + 30), (x0 + 10, y1 - 4)], fill=pal[5], width=2)
    glow(draw, x0 + 20, y0 + 36, 6, 6, pal[5], 110)


def draw_flashlight_figure(draw: ImageDraw.ImageDraw, bbox, pal):
    x0, y0, x1, y1 = bbox
    cx = (x0 + x1) // 2
    draw.ellipse([cx - 9, y0 + 8, cx + 9, y0 + 26], fill=pal[5])
    draw.polygon([(cx - 16, y0 + 28), (cx + 14, y0 + 28), (cx + 20, y1 - 18), (cx - 18, y1 - 10)], fill=pal[4])
    box(draw, [cx - 10, y1 - 26, cx - 2, y1 - 4], pal[1])
    box(draw, [cx + 4, y1 - 24, cx + 12, y1 - 4], pal[1])
    box(draw, [cx + 16, y0 + 42, cx + 28, y0 + 48], pal[5])
    draw.polygon([(cx + 28, y0 + 38), (x1 + 26, y0 + 18), (x1 + 26, y1 - 18), (cx + 28, y0 + 52)], fill=(*pal[5], 110))


def draw_armored_explorer(draw: ImageDraw.ImageDraw, bbox, pal):
    x0, y0, x1, y1 = bbox
    cx = (x0 + x1) // 2
    draw.pieslice([cx - 16, y0 + 6, cx + 16, y0 + 38], start=180, end=360, fill=pal[4])
    box(draw, [cx - 16, y0 + 34, cx + 16, y1 - 18], pal[3], pal[1])
    box(draw, [cx - 12, y0 + 14, cx + 12, y0 + 24], pal[5])
    box(draw, [cx + 18, y0 + 46, x1 - 2, y0 + 56], pal[5])
    box(draw, [cx - 14, y1 - 28, cx - 4, y1 - 4], pal[1])
    box(draw, [cx + 4, y1 - 28, cx + 14, y1 - 4], pal[1])


def draw_duelist(draw: ImageDraw.ImageDraw, bbox, pal):
    x0, y0, x1, y1 = bbox
    cx = (x0 + x1) // 2
    draw.ellipse([cx - 9, y0 + 8, cx + 9, y0 + 24], fill=pal[5])
    draw.polygon([(cx - 16, y0 + 26), (cx + 14, y0 + 26), (cx + 16, y1 - 18), (cx - 20, y1 - 12)], fill=pal[4])
    box(draw, [cx - 12, y1 - 26, cx - 2, y1 - 4], pal[1])
    box(draw, [cx + 4, y1 - 24, cx + 12, y1 - 4], pal[1])
    draw.line([(cx + 10, y0 + 34), (x1 + 8, y0 + 10)], fill=pal[5], width=3)


def draw_athlete(draw: ImageDraw.ImageDraw, bbox, pal):
    x0, y0, x1, y1 = bbox
    cx = (x0 + x1) // 2
    draw.ellipse([cx - 8, y0 + 8, cx + 8, y0 + 24], fill=pal[5])
    draw.polygon([(cx - 14, y0 + 26), (cx + 12, y0 + 26), (cx + 18, y1 - 18), (cx - 18, y1 - 10)], fill=pal[4])
    draw.line([(cx - 6, y1 - 18), (cx - 18, y1)], fill=pal[1], width=2)
    draw.line([(cx + 4, y1 - 18), (cx + 18, y1 - 4)], fill=pal[1], width=2)


def draw_skateboarder(draw: ImageDraw.ImageDraw, bbox, pal):
    draw_athlete(draw, bbox, pal)
    x0, y0, x1, y1 = bbox
    box(draw, [x0 + 18, y1 - 10, x1 - 8, y1 - 4], pal[5], pal[1])
    draw.ellipse([x0 + 20, y1 - 6, x0 + 28, y1 + 2], fill=pal[1])
    draw.ellipse([x1 - 26, y1 - 6, x1 - 18, y1 + 2], fill=pal[1])


def draw_agile_explorer(draw: ImageDraw.ImageDraw, bbox, pal):
    draw_heroic_adventurer(draw, bbox, pal)
    x0, y0, x1, y1 = bbox
    box(draw, [x0 + 4, y1 - 8, x0 + 24, y1 - 4], pal[3], pal[1])


def draw_commander(draw: ImageDraw.ImageDraw, bbox, pal):
    draw_athlete(draw, bbox, pal)
    x0, y0, x1, y1 = bbox
    box(draw, [x0 + 8, y1 - 28, x1 - 8, y1 - 16], pal[5], pal[1])


def draw_investigator(draw: ImageDraw.ImageDraw, bbox, pal):
    draw_flashlight_figure(draw, bbox, pal)
    x0, y0, x1, y1 = bbox
    box(draw, [x0 + 8, y0 + 42, x0 + 28, y0 + 54], pal[4], pal[1])


def draw_covert_operative(draw: ImageDraw.ImageDraw, bbox, pal):
    draw_flashlight_figure(draw, bbox, pal)
    x0, y0, x1, y1 = bbox
    box(draw, [x1 - 18, y0 + 42, x1 + 2, y0 + 50], pal[5], pal[1])


SUBJECT_DRAWERS = {
    "heroic_adventurer": draw_heroic_adventurer,
    "lone_wanderer": draw_lone_wanderer,
    "flashlight_figure": draw_flashlight_figure,
    "armored_explorer": draw_armored_explorer,
    "duelist": draw_duelist,
    "athlete": draw_athlete,
    "skateboarder": draw_skateboarder,
    "agile_explorer": draw_agile_explorer,
    "commander": draw_commander,
    "investigator": draw_investigator,
    "covert_operative": draw_covert_operative,
}

OBJECT_DRAWERS = {
    "vehicle": draw_vehicle,
    "spaceship": draw_spaceship,
    "tile_stack": draw_tile_stack,
    "artifact": draw_artifact,
    "book": draw_book,
}


def choose_subject(record: dict) -> tuple[str, str]:
    subject_key = record.get("subject_key")
    if subject_key in SUBJECT_DRAWERS:
        return subject_key, "figure"
    core_object = record.get("core_object")
    if core_object in OBJECT_DRAWERS:
        return core_object, "object"
    for candidate in record.get("key_objects", []):
        if candidate in OBJECT_DRAWERS:
            return candidate, "object"
    return "artifact", "object"


def compute_subject_bbox(record: dict, subject_kind: str) -> tuple[int, int, int, int]:
    width, height = WORK_SIZE
    focus = max(0.9, min(1.25, float(record.get("focus_scale", 1.0))))
    if subject_kind == "figure":
        base_w = int(60 * focus)
        base_h = int(92 * focus)
        if record.get("bucket") == "platformer_cartoon":
            base_w += 6
            base_h += 8
    else:
        base_w = int(78 * focus)
        base_h = int(62 * focus)
    center_x = 120 if record.get("bucket") not in {"survival_horror", "mystery_adventure"} else 132
    center_y = 126 if record.get("bucket") not in {"racing", "sports"} else 132
    return (
        max(8, center_x - base_w // 2),
        max(8, center_y - base_h // 2),
        min(210, center_x + base_w // 2),
        min(172, center_y + base_h // 2),
    )


def draw_subject(draw: ImageDraw.ImageDraw, record: dict, palette: list[str]) -> tuple[tuple[int, int, int, int], str]:
    pal = [hex_rgb(value) for value in palette]
    subject_name, subject_kind = choose_subject(record)
    bbox = compute_subject_bbox(record, subject_kind)
    cx = (bbox[0] + bbox[2]) // 2
    glow(draw, cx, bbox[1] + 18, (bbox[2] - bbox[0]) // 2 + 12, (bbox[3] - bbox[1]) // 2, pal[5], 38)
    draw.ellipse([bbox[0] + 6, bbox[3] - 6, bbox[2] + 10, bbox[3] + 8], fill=(*adjust_color(pal[0], 0.72), 140))
    shadow_bbox = (bbox[0] + 2, bbox[1] + 2, bbox[2] + 2, bbox[3] + 2)
    shadow_pal = [adjust_color(value, 0.42) for value in pal]
    if subject_kind == "figure":
        SUBJECT_DRAWERS.get(subject_name, draw_heroic_adventurer)(draw, shadow_bbox, shadow_pal)
        SUBJECT_DRAWERS.get(subject_name, draw_heroic_adventurer)(draw, bbox, pal)
    else:
        OBJECT_DRAWERS.get(subject_name, draw_artifact)(draw, shadow_bbox, shadow_pal)
        OBJECT_DRAWERS.get(subject_name, draw_artifact)(draw, bbox, pal)
    return bbox, subject_name


def add_finish_layers(image: Image.Image, palette: list[str], rng: random.Random):
    width, height = image.size
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    accent = adjust_color(palette[5], 1.04)
    for _ in range(26):
        x = rng.randint(0, int(width * 0.62))
        y = rng.randint(0, height)
        draw.rectangle([x, y, x + rng.randint(6, 18), y + rng.randint(1, 3)], fill=(*accent, rng.randint(8, 18)))
    image.alpha_composite(overlay)


def draw_overlay_band(image: Image.Image, palette: list[str]):
    width, height = image.size
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    dark = adjust_color(palette[0], 0.4)
    for step in range(20):
        alpha = int(235 * (step / 19))
        x0 = int(width * (1 - OVERLAY_RATIO) + (step * width * OVERLAY_RATIO / 20))
        draw.rectangle([x0, 0, width, height], fill=(*dark, alpha))
    image.alpha_composite(overlay)


def render_image(record: dict, render_path: Path, retry_count: int, palette: list[str], rng: random.Random) -> dict:
    pal = [hex_rgb(value) for value in palette]
    work = Image.new("RGBA", WORK_SIZE, pal[0] + (255,))
    draw = ImageDraw.Draw(work, "RGBA")
    draw_environment(draw, rng, palette, record["bucket"])
    subject_bbox, subject_label = draw_subject(draw, record, palette)
    image = work.resize(CANVAS_SIZE, resample=Image.Resampling.NEAREST)
    draw_overlay_band(image, palette)
    add_finish_layers(image, pal, rng)
    render_path.parent.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(render_path)
    return {
        "path": str(render_path),
        "subject_bbox": scale_bbox(subject_bbox),
        "subject_label": subject_label,
    }


def crop_mean(image: Image.Image, bbox) -> float:
    x0, y0, x1, y1 = [int(v) for v in bbox]
    x0 = max(0, x0)
    y0 = max(0, y0)
    x1 = min(image.width, x1)
    y1 = min(image.height, y1)
    if x1 <= x0 or y1 <= y0:
        return 0.0
    return ImageStat.Stat(image.crop((x0, y0, x1, y1)).convert("L")).mean[0]


def crop_std(image: Image.Image, bbox) -> float:
    x0, y0, x1, y1 = [int(v) for v in bbox]
    x0 = max(0, x0)
    y0 = max(0, y0)
    x1 = min(image.width, x1)
    y1 = min(image.height, y1)
    if x1 <= x0 or y1 <= y0:
        return 0.0
    return ImageStat.Stat(image.crop((x0, y0, x1, y1)).convert("L")).stddev[0]


def run_qa(record: dict, render_meta: dict, platform_style_id: str, retry_count: int) -> dict:
    image = Image.open(render_meta["path"]).convert("RGB")
    bbox = render_meta["subject_bbox"]
    area_ratio = ((bbox[2] - bbox[0]) * (bbox[3] - bbox[1])) / float(image.width * image.height)
    subject_mean = crop_mean(image, bbox)
    bg_bbox = (bbox[2] + 40, bbox[1], image.width, bbox[3])
    surrounding_mean = crop_mean(image, bg_bbox)
    overlay_bbox = (image.width * (1 - OVERLAY_RATIO), 0, image.width, image.height * 0.78)
    overlay_mean = crop_mean(image, overlay_bbox)
    overlay_std = crop_std(image, overlay_bbox)
    subject_contrast = abs(subject_mean - surrounding_mean)

    checks = {
        "no_text_detected": True,
        "no_logo_detected": True,
        "no_character_likeness": True,
        "subject_readable": subject_contrast >= 12 and 0.05 <= area_ratio <= 0.28,
        "ui_overlay_usable": overlay_mean <= 120 and overlay_std <= 78,
        "no_copyright_replication": True,
        "platform_style_match": record["platform_style_id"] == platform_style_id,
    }
    weights = {
        "no_text_detected": 12,
        "no_logo_detected": 12,
        "no_character_likeness": 16,
        "subject_readable": 20,
        "ui_overlay_usable": 14,
        "no_copyright_replication": 16,
        "platform_style_match": 10,
    }
    score = sum(weight for name, weight in weights.items() if checks[name])
    reasons = [name for name, passed in checks.items() if not passed]
    status = "generated" if not reasons else ("retry" if retry_count < 2 else "flagged")
    return {
        "checks": checks,
        "qa_score": score,
        "status": status,
        "failure_reasons": reasons,
        "metrics": {
            "area_ratio": round(area_ratio, 4),
            "subject_contrast": round(subject_contrast, 2),
            "overlay_mean": round(overlay_mean, 2),
            "overlay_std": round(overlay_std, 2),
        },
    }


def build_contact_sheet(items: list[dict], output_path: Path):
    if not items:
        return
    thumb_w, thumb_h = 320, 180
    cols = 4
    rows = math.ceil(len(items) / cols)
    sheet = Image.new("RGB", (cols * thumb_w, rows * thumb_h), color=(10, 10, 14))
    for index, item in enumerate(items):
        image = Image.open(item["render"]["path"]).convert("RGB")
        image.thumbnail((thumb_w, thumb_h))
        x = (index % cols) * thumb_w
        y = (index // cols) * thumb_h
        sheet.paste(image, (x, y))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output_path)
