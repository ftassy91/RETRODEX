from __future__ import annotations

import argparse
import csv
import hashlib
import json
import random
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from time import perf_counter

from retrodex_visual_renderer import build_contact_sheet, render_image, run_qa


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
ASSET_ROOT = ROOT / "assets" / "retrodex"
PROMPT_ROOT = ASSET_ROOT / "prompts"
RENDER_ROOT = ASSET_ROOT / "renders"
LOG_ROOT = ASSET_ROOT / "logs"

MASTER_PROMPT = """Original illustration inspired by a retro {genre_primary} game.

A {main_subject} in {context_scene}, {action_mood_cue}.

Game metadata:
- Title: {title}
- Platform: {platform}
- Release year: {year}
- Secondary genre signal: {genre_secondary}

Visual focus:
- one clear subject
- strong silhouette
- readable in 1 second

Style:
- {platform_style}
- pixel art or stylized rendering depending on platform
- clean and modern interpretation of retro limitations
- limited color palette when relevant

Mood:
- {tone}

Composition:
- {composition_rule}
- simple background
- no clutter

Important:
- Do NOT replicate any official character, logo, or design
- Do NOT imitate exact game assets
- Must feel original but clearly inspired by the game's genre and atmosphere

Output:
- high clarity
- strong contrast
- minimal noise
- no text
- no watermark
"""

PLATFORM_STYLES = {
    "Nintendo Entertainment System": {
        "style_id": "nes_restrained_poster",
        "description": "restrained retro poster aesthetic, simple shapes, limited palette, readable silhouettes, 8-bit spirit without actual sprites",
        "palette": ["#0d1b2a", "#1b263b", "#415a77", "#c8d5b9", "#f4d35e", "#d62828"],
    },
    "Super Nintendo": {
        "style_id": "snes_storybook_16bit",
        "description": "colorful 16-bit-inspired fantasy illustration, richer gradients, polished sprite-era composition",
        "palette": ["#1f2041", "#4b3f72", "#ffc857", "#119da4", "#f4f1de", "#e36414"],
    },
    "PlayStation": {
        "style_id": "ps1_lowpoly_editorial",
        "description": "early 3D editorial look, low-poly-inspired forms, moody lighting, late-90s techno-fantasy atmosphere",
        "palette": ["#11151c", "#212d40", "#364156", "#7d4e57", "#d66853", "#f3dfa2"],
    },
    "Nintendo 64": {
        "style_id": "n64_color_volume",
        "description": "colorful stylized 3D collectible render, playful volume, toy-like readability",
        "palette": ["#1b1b3a", "#693668", "#a74482", "#f84aa7", "#ff3562", "#5dfdcb"],
    },
    "Game Boy": {
        "style_id": "gameboy_monochrome_story",
        "description": "monochrome handheld illustration, limited green palette, crisp pixel-informed shapes, nostalgic portable mood",
        "palette": ["#0f380f", "#306230", "#8bac0f", "#9bbc0f", "#cadc9f", "#d8e8b6"],
    },
    "Game Boy Advance": {
        "style_id": "gba_bright_action",
        "description": "portable action illustration, saturated but controlled colors, clean handheld readability",
        "palette": ["#0c1821", "#1b2a41", "#324a5f", "#f7b267", "#f4845f", "#84dcc6"],
    },
    "Nintendo DS": {
        "style_id": "nds_clean_dual_panel",
        "description": "portable mystery illustration, clean shapes, layered panels, modernized handheld mood",
        "palette": ["#172121", "#444554", "#7f7caf", "#b8b8ff", "#f45b69", "#ffd166"],
    },
    "Sega Genesis": {
        "style_id": "genesis_arcade_energy",
        "description": "energetic arcade action poster feel, stronger contrast, bold diagonals, speed and attitude",
        "palette": ["#14080e", "#49475b", "#799496", "#acc196", "#e9eb9e", "#f06543"],
    },
    "Sega Saturn": {
        "style_id": "saturn_art_house",
        "description": "mature arcade illustration, strange and elegant mood, sharper contrast, premium collector framing",
        "palette": ["#1f0322", "#3d1c5b", "#4c956c", "#f6f7eb", "#f7b32b", "#f72c25"],
    },
    "Dreamcast": {
        "style_id": "dreamcast_futurist",
        "description": "clean futurist editorial art, airy space, modern arcade tone, bright accent lighting",
        "palette": ["#0b132b", "#1c2541", "#3a506b", "#5bc0be", "#f4f4f9", "#ff9f1c"],
    },
    "Neo Geo": {
        "style_id": "neo_geo_premium_arcade",
        "description": "premium arcade key art, dramatic contrast, dynamic framing, bold heroic silhouettes",
        "palette": ["#13070c", "#6d1a36", "#b33f62", "#f9564f", "#f3c677", "#f7f7ff"],
    },
    "TurboGrafx-16": {
        "style_id": "turbografx_arcade_poster",
        "description": "bright arcade key art, punchy motion, crisp light, poster-like composition",
        "palette": ["#231942", "#5e548e", "#9f86c0", "#be95c4", "#e0b1cb", "#f7ece1"],
    },
    "Sega Master System": {
        "style_id": "sms_clean_arcade",
        "description": "clean arcade illustration, simple geometry, high contrast shapes, restrained palette",
        "palette": ["#141414", "#3d348b", "#7678ed", "#f7b801", "#f18701", "#f35b04"],
    },
    "Game Gear": {
        "style_id": "gamegear_portable_arcade",
        "description": "portable arcade illustration, vibrant contrast, bold glow, readable silhouettes",
        "palette": ["#0b0f14", "#1d3557", "#457b9d", "#a8dadc", "#f1faee", "#e63946"],
    },
    "Atari Lynx": {
        "style_id": "lynx_neo_arcade",
        "description": "portable neo-arcade art, angular forms, hard shadows, action-first composition",
        "palette": ["#1a1423", "#372549", "#774c60", "#b75d69", "#eacdc2", "#fffbfc"],
    },
    "WonderSwan": {
        "style_id": "wonderswan_mono_modern",
        "description": "minimal handheld illustration, clean geometry, sparse composition, collector-friendly balance",
        "palette": ["#111111", "#393e46", "#6d9886", "#f2e7d5", "#e2c799", "#a77979"],
    },
}

DEFAULT_PLATFORM_STYLE = {
    "style_id": "retrodex_editorial_default",
    "description": "editorial retro illustration with controlled contrast, collectible-card composition, and clean silhouettes",
    "palette": ["#111827", "#1f2937", "#374151", "#9ca3af", "#e5e7eb", "#f59e0b"],
}

BUCKET_DEFAULTS = {
    "fantasy_adventure": {"tone": ["mysterious", "heroic", "mythic"], "setting": ["ruins", "path", "distant landmark"], "key_objects": ["sword", "lantern", "stone relic"]},
    "rpg_epic": {"tone": ["epic", "melancholic", "legendary"], "setting": ["horizon", "monument", "sacred sky"], "key_objects": ["crystal", "banner", "ancient map"]},
    "platformer_cartoon": {"tone": ["playful", "kinetic", "bright"], "setting": ["stacked platforms", "rolling backdrop", "floating shapes"], "key_objects": ["spring", "coin-like token", "toy block"]},
    "survival_horror": {"tone": ["tense", "isolated", "oppressive"], "setting": ["corridor", "doorway", "decayed interior"], "key_objects": ["flashlight", "old key", "radio"]},
    "racing": {"tone": ["fast", "mechanical", "competitive"], "setting": ["track curve", "lights", "motion field"], "key_objects": ["machine silhouette", "wheel", "apex marker"]},
    "fighting": {"tone": ["intense", "dramatic", "charged"], "setting": ["arena", "banner field", "impact burst"], "key_objects": ["gauntlet", "arena sigil", "impact ring"]},
    "sports": {"tone": ["competitive", "clean", "focused"], "setting": ["stadium", "lights", "field geometry"], "key_objects": ["ball", "trophy silhouette", "score marker"]},
    "puzzle_abstract": {"tone": ["precise", "calm", "cerebral"], "setting": ["grid", "negative space", "stacked motifs"], "key_objects": ["tile cluster", "orb", "frame marker"]},
    "strategy_tactics": {"tone": ["strategic", "measured", "disciplined"], "setting": ["map table", "grid", "campaign horizon"], "key_objects": ["banner pin", "compass", "marker token"]},
    "sci_fi_action": {"tone": ["futuristic", "urgent", "cold"], "setting": ["starfield", "reactor space", "industrial skyline"], "key_objects": ["visor", "energy core", "drone-like beacon"]},
    "shooter_arcade": {"tone": ["aggressive", "fast", "arcade"], "setting": ["star lane", "energy tunnel", "combat haze"], "key_objects": ["craft silhouette", "energy bolt", "shield disc"]},
    "mystery_adventure": {"tone": ["curious", "quiet", "investigative"], "setting": ["archive room", "desk", "hidden passage"], "key_objects": ["notebook", "key", "sealed envelope"]},
}

KEYWORD_BUCKETS = [
    ("survival_horror", ["resident evil", "silent hill", "parasite eve", "horror", "fear", "clock tower"]),
    ("racing", ["kart", "turismo", "racer", "racing", "f-zero", "taxi", "driver", "road"]),
    ("fighting", ["fighter", "fighters", "kombat", "tekken", "garou", "samurai", "fatal fury", "soul", "street fighter", "wrestle"]),
    ("sports", ["golf", "tennis", "bowl", "skater", "soccer", "baseball", "football", "basketball", "hockey"]),
    ("puzzle_abstract", ["tetris", "puzzle", "dr. mario", "meteos", "qube", "picross"]),
    ("strategy_tactics", ["wars", "tactics", "emblem", "force", "ogre", "advance wars", "civilization"]),
    ("sci_fi_action", ["metroid", "star", "metal gear", "xenogears", "cyber", "virtual", "alien", "robot", "future"]),
    ("fantasy_adventure", ["zelda", "mana", "dragon", "legend", "gaia", "lufia", "quest", "castlevania"]),
    ("platformer_cartoon", ["mario", "kirby", "sonic", "banjo", "donkey", "yoshi", "crash", "spyro", "wario", "rayman"]),
    ("shooter_arcade", ["gradius", "ikaruga", "silvergun", "contra", "gunstar", "metal slug", "shmup", "thunder"]),
    ("rpg_epic", ["final fantasy", "chrono", "earthbound", "suikoden", "wild arms", "breath of fire", "grandia", "valkyrie", "shining"]),
    ("mystery_adventure", ["phoenix wright", "ghost trick", "999", "hotel", "mystery", "detective", "layton"]),
]

HIGH_RISK_TOKENS = {"mario", "zelda", "pokemon", "metroid", "sonic", "kirby", "link", "samus", "resident evil", "silent hill", "final fantasy", "metal gear", "castlevania", "mega man", "donkey kong", "crash", "spyro", "banjo", "street fighter", "mortal kombat", "tekken", "chrono", "earthbound", "tetris", "star fox"}
MEDIUM_RISK_TOKENS = {"dragon", "quest", "persona", "shenmue", "grandia", "suikoden", "wild arms", "breath of fire", "goldeneye", "perfect dark", "f-zero", "mario kart", "power stone", "nights", "panzer dragoon"}

COMPOSITION_BY_CLASS = {
    "environment": "one subject framed by a readable world, with the subject still dominant and the background strictly secondary",
    "object": "one subject slightly left of center, with a clean silhouette and a world behind it that explains the genre immediately",
}

OBJECT_BY_BUCKET = {
    "fantasy_adventure": ["sword", "artifact", "shield"],
    "rpg_epic": ["crystal", "artifact", "sword"],
    "platformer_cartoon": ["artifact", "vehicle", "building"],
    "survival_horror": ["key", "lantern", "building"],
    "racing": ["vehicle", "helmet", "weapon"],
    "fighting": ["weapon", "gauntlet", "helmet"],
    "sports": ["vehicle", "helmet", "artifact"],
    "puzzle_abstract": ["artifact", "tile_stack", "building"],
    "strategy_tactics": ["artifact", "building", "weapon"],
    "sci_fi_action": ["helmet", "spaceship", "weapon"],
    "shooter_arcade": ["spaceship", "weapon", "helmet"],
    "mystery_adventure": ["key", "book", "building"],
}

SUBJECT_BY_BUCKET = {
    "fantasy_adventure": {"subject_key": "heroic_adventurer", "main_subject": "small heroic adventurer with a sword", "action_mood_cue": "standing still as the wind crosses the scene"},
    "rpg_epic": {"subject_key": "lone_wanderer", "main_subject": "lone wanderer beside a glowing relic", "action_mood_cue": "facing a mythic horizon with quiet determination"},
    "platformer_cartoon": {"subject_key": "agile_explorer", "main_subject": "small agile explorer", "action_mood_cue": "caught in a forward-moving leap through layered terrain"},
    "survival_horror": {"subject_key": "flashlight_figure", "main_subject": "lone figure holding a flashlight", "action_mood_cue": "with the beam cutting through the darkness"},
    "racing": {"subject_key": "vehicle", "main_subject": "single colorful vehicle", "action_mood_cue": "drifting through a curve with visible momentum"},
    "fighting": {"subject_key": "duelist", "main_subject": "lone duelist silhouette", "action_mood_cue": "holding a tense ready stance before impact"},
    "sports": {"subject_key": "athlete", "main_subject": "single athlete silhouette", "action_mood_cue": "leaning into motion under bright arena light"},
    "puzzle_abstract": {"subject_key": "tile_stack", "main_subject": "stacked falling blocks", "action_mood_cue": "locked in a precise falling moment above a grounded puzzle space"},
    "strategy_tactics": {"subject_key": "commander", "main_subject": "lone commander at a tactical table", "action_mood_cue": "studying the field with disciplined focus"},
    "sci_fi_action": {"subject_key": "armored_explorer", "main_subject": "lone armored explorer", "action_mood_cue": "standing alert in cold alien light"},
    "shooter_arcade": {"subject_key": "spaceship", "main_subject": "single attack ship", "action_mood_cue": "cutting forward through danger at full speed"},
    "mystery_adventure": {"subject_key": "investigator", "main_subject": "lone investigator with a notebook", "action_mood_cue": "reading the space carefully in near silence"},
}

TITLE_SUBJECT_RULES = [
    ({"subject_key": "heroic_adventurer", "main_subject": "small heroic adventurer with a sword", "action_mood_cue": "standing on a windswept path with quiet resolve"}, ["zelda", "castlevania", "ys", "mana", "alundra"]),
    ({"subject_key": "flashlight_figure", "main_subject": "lone figure holding a flashlight", "action_mood_cue": "with the beam cutting through a threatening dark interior"}, ["resident evil", "silent hill", "parasite eve"]),
    ({"subject_key": "vehicle", "main_subject": "single colorful kart", "action_mood_cue": "drifting hard through a playful curved track"}, ["mario kart"]),
    ({"subject_key": "vehicle", "main_subject": "single racing vehicle", "action_mood_cue": "leaning into speed on a sweeping track"}, ["turismo", "ridge racer", "f-zero", "daytona", "wave race", "crazy taxi", "outrun"]),
    ({"subject_key": "armored_explorer", "main_subject": "lone armored explorer", "action_mood_cue": "standing in a hostile alien cavern under atmospheric light"}, ["metroid"]),
    ({"subject_key": "skateboarder", "main_subject": "single skateboarder silhouette", "action_mood_cue": "balancing into motion on a board in a clean skate scene"}, ["tony hawk", "skater"]),
    ({"subject_key": "duelist", "main_subject": "lone martial artist silhouette", "action_mood_cue": "holding a focused pre-fight stance in a charged arena"}, ["tekken", "soul calibur", "street fighter", "mortal kombat", "garou", "fatal fury"]),
    ({"subject_key": "covert_operative", "main_subject": "lone covert operative silhouette", "action_mood_cue": "moving carefully through a tense high-tech space"}, ["perfect dark", "goldeneye", "metal gear"]),
    ({"subject_key": "tile_stack", "main_subject": "stacked falling blocks", "action_mood_cue": "captured in a precise descending arrangement above a grounded puzzle surface"}, ["tetris", "columns", "dr. mario", "puzzle"]),
    ({"subject_key": "investigator", "main_subject": "lone investigator with a notebook", "action_mood_cue": "studying clues inside a quiet room"}, ["phoenix wright", "layton", "hotel dusk", "ghost trick", "999"]),
    ({"subject_key": "spaceship", "main_subject": "single attack ship", "action_mood_cue": "flying into danger through a deep combat lane"}, ["ikaruga", "silvergun", "thunder force", "star fox", "panzer dragoon", "gradius", "r-type"]),
]

CONTEXT_BY_BUCKET = {
    "fantasy_adventure": "a windswept fantasy landscape with ruins, a distant landmark, and a traversable path",
    "rpg_epic": "a mythic horizon with ancient structures, sacred sky, and story-scale depth",
    "platformer_cartoon": "a playful platform world with layered terrain, readable obstacles, and bright depth cues",
    "survival_horror": "a tense corridor or decayed interior with one threatening threshold and controlled darkness",
    "racing": "a fast track or road scene with motion lines, curve markers, and strong directional perspective",
    "fighting": "an arena or duel space with impact energy, banners, and confrontation framing",
    "sports": "a stadium or competition ground with lights, field markers, and focused event framing",
    "puzzle_abstract": "a physical puzzle space with stacked pieces, spatial logic, and grounded surfaces",
    "strategy_tactics": "a campaign table, battlefield edge, or tactical ground with markers and territorial cues",
    "sci_fi_action": "a futuristic industrial skyline or reactor zone with cold light and scale",
    "shooter_arcade": "a deep space lane or combat tunnel with velocity and incoming threat",
    "mystery_adventure": "an archive room, hidden passage, or investigative interior with clues in the space",
}

GENRE_SIGNAL_BY_BUCKET = {
    "fantasy_adventure": "heroic fantasy exploration",
    "rpg_epic": "mythic role-playing quest",
    "platformer_cartoon": "playful traversal and momentum",
    "survival_horror": "claustrophobic dread and survival tension",
    "racing": "speed, machinery, and competitive momentum",
    "fighting": "combat readiness and duel pressure",
    "sports": "competitive event focus",
    "puzzle_abstract": "spatial problem-solving with physical pieces",
    "strategy_tactics": "campaign planning and tactical control",
    "sci_fi_action": "futuristic danger and combat technology",
    "shooter_arcade": "arcade velocity and projectile threat",
    "mystery_adventure": "investigation, secrecy, and hidden meaning",
}


def slugify(value: str) -> str:
    return re.sub(r"(^-|-$)", "", re.sub(r"[^a-z0-9]+", "-", value.lower()))


def now_utc() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def ensure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def stable_seed(*parts: str) -> int:
    digest = hashlib.sha256("::".join(parts).encode("utf-8")).hexdigest()
    return int(digest[:16], 16)


def write_json(path: Path, payload):
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


def write_text(path: Path, value: str):
    path.write_text(value, encoding="utf-8")


def fallback_secondary(primary: str) -> str:
    mapping = {
        "Action-Adventure": "Fantasy",
        "Action-RPG": "Fantasy",
        "RPG": "Epic",
        "Tactical RPG": "Strategy",
        "Platformer": "Action",
        "Puzzle": "Abstract",
        "Fighting": "Combat",
        "Shoot'em up": "Arcade",
        "Racing": "Competition",
        "Strategy": "Tactics",
        "FPS": "Action",
        "Survival Horror": "Horror",
        "Action-Stealth": "Thriller",
    }
    return mapping.get(primary, "Retro")


def canonical_genre(value: str) -> str:
    raw = (value or "").strip().lower()
    if not raw:
        return ""
    replacements = {
        "platform": "Platformer",
        "platformer / action": "Platformer",
        "action / platformer": "Platformer",
        "action-platform": "Platformer",
        "combat 2d": "Fighting",
        "stratégie": "Strategy",
        "action-adventure": "Action-Adventure",
        "action-rpg": "Action-RPG",
        "tactical rpg": "Tactical RPG",
        "action-stealth": "Action-Stealth",
    }
    return replacements.get(raw, value.strip())


def bucket_to_primary_genre(bucket: str) -> str:
    mapping = {
        "fantasy_adventure": "Action-Adventure",
        "rpg_epic": "RPG",
        "platformer_cartoon": "Platformer",
        "survival_horror": "Survival Horror",
        "racing": "Racing",
        "fighting": "Fighting",
        "sports": "Sports",
        "puzzle_abstract": "Puzzle",
        "strategy_tactics": "Strategy",
        "sci_fi_action": "Action",
        "shooter_arcade": "Shoot'em up",
        "mystery_adventure": "Adventure",
    }
    return mapping.get(bucket, "Action")


def bucket_to_secondary_genre(bucket: str) -> str:
    mapping = {
        "fantasy_adventure": "Fantasy",
        "rpg_epic": "Epic",
        "platformer_cartoon": "Playful",
        "survival_horror": "Horror",
        "racing": "Competition",
        "fighting": "Combat",
        "sports": "Competition",
        "puzzle_abstract": "Abstract",
        "strategy_tactics": "Tactics",
        "sci_fi_action": "Sci-Fi",
        "shooter_arcade": "Arcade",
        "mystery_adventure": "Mystery",
    }
    return mapping.get(bucket, "Retro")


def infer_bucket(title: str, genre_primary: str, genre_secondary: str) -> str:
    title_lc = title.lower()
    for bucket, keywords in KEYWORD_BUCKETS:
        if any(keyword in title_lc for keyword in keywords):
            return bucket
    gp = genre_primary.lower()
    gs = genre_secondary.lower()
    if "horror" in gp or "horror" in gs:
        return "survival_horror"
    if "puzzle" in gp:
        return "puzzle_abstract"
    if "racing" in gp:
        return "racing"
    if "fight" in gp or "combat" in gp:
        return "fighting"
    if "sport" in gp:
        return "sports"
    if "strategy" in gp or "tactical" in gp:
        return "strategy_tactics"
    if "shoot" in gp or "fps" in gp:
        return "shooter_arcade"
    if "rpg" in gp:
        return "rpg_epic"
    if "platform" in gp:
        return "platformer_cartoon"
    if "adventure" in gp:
        return "fantasy_adventure"
    return "sci_fi_action" if "sci" in gs.lower() else "mystery_adventure"


def infer_genres(game: dict, entry: dict | None) -> tuple[str, str]:
    genre_value = canonical_genre((entry or {}).get("genre", ""))
    if genre_value:
        parts = [canonical_genre(part) for part in re.split(r"\s*/\s*|,\s*", genre_value) if part.strip()]
        if parts:
            primary = parts[0]
            secondary = parts[1] if len(parts) > 1 else fallback_secondary(primary)
            return primary, secondary
    bucket = infer_bucket(game["title"], "Action", "Adventure")
    return bucket_to_primary_genre(bucket), bucket_to_secondary_genre(bucket)


def infer_title_tags(title: str) -> set[str]:
    title_lc = title.lower()
    tags = set()
    keyword_map = {
        "sword": ["zelda", "mana", "dragoon", "fire emblem", "sword", "castlevania"],
        "crystal": ["final fantasy", "chrono", "mana", "dragon quest", "pokemon"],
        "key": ["resident evil", "silent hill", "mystery", "detective"],
        "helmet": ["metroid", "mega man", "star", "cyber", "virtual", "robot"],
        "machine": ["racing", "kart", "turismo", "f-zero", "taxi"],
        "orb": ["kirby", "dream", "fantasy", "mystic", "puzzle"],
        "map": ["wars", "tactics", "emblem", "quest", "strategy"],
        "portal": ["metroid", "castlevania", "chrono", "silent hill"],
        "radio": ["silent hill", "resident evil"],
        "track": ["racing", "kart", "turismo", "taxi", "road"],
        "gauntlet": ["fighter", "tekken", "kombat", "garou", "samurai"],
        "tile": ["tetris", "puzzle", "qube", "dr. mario"],
        "notebook": ["phoenix wright", "detective", "ghost trick", "999", "layton"],
    }
    for tag, needles in keyword_map.items():
        if any(needle in title_lc for needle in needles):
            tags.add(tag)
    return tags


def merge_unique(*groups) -> list[str]:
    seen = set()
    values = []
    for group in groups:
        for item in group:
            clean = str(item).strip()
            if not clean or clean in seen:
                continue
            seen.add(clean)
            values.append(clean)
    return values


def infer_tone_setting_objects(title: str, bucket: str) -> tuple[list[str], list[str], list[str]]:
    defaults = BUCKET_DEFAULTS[bucket]
    title_tags = infer_title_tags(title)
    tone = list(defaults["tone"])
    setting = list(defaults["setting"])
    objects = list(defaults["key_objects"])
    tag_tone = {"helmet": ["cold", "focused"], "key": ["tense", "sealed"], "machine": ["fast", "mechanical"], "orb": ["dreamlike", "soft"], "gauntlet": ["charged", "aggressive"], "tile": ["precise", "minimal"]}
    tag_setting = {"helmet": ["industrial glow"], "key": ["locked threshold"], "machine": ["motion trail"], "track": ["apex curve"], "map": ["campaign table"], "notebook": ["document spread"]}
    tag_objects = {"sword": ["sword"], "crystal": ["crystal"], "key": ["key"], "helmet": ["visor"], "machine": ["machine silhouette"], "orb": ["orb"], "map": ["map marker"], "portal": ["portal ring"], "radio": ["radio"], "track": ["track marker"], "gauntlet": ["gauntlet"], "tile": ["tile cluster"], "notebook": ["notebook"]}
    for tag in sorted(title_tags):
        tone = merge_unique(tone, tag_tone.get(tag, []))
        setting = merge_unique(setting, tag_setting.get(tag, []))
        objects = merge_unique(objects, tag_objects.get(tag, []))
    return tone[:4], setting[:4], objects[:4]


def choose_subject_profile(title: str, bucket: str) -> dict:
    title_lc = title.lower()
    for profile, keywords in TITLE_SUBJECT_RULES:
        if any(keyword in title_lc for keyword in keywords):
            return dict(profile)
    return dict(SUBJECT_BY_BUCKET[bucket])


def choose_core_object(subject_key: str, bucket: str) -> str:
    subject_object_map = {
        "heroic_adventurer": "sword",
        "lone_wanderer": "crystal",
        "agile_explorer": "artifact",
        "flashlight_figure": "lantern",
        "vehicle": "vehicle",
        "duelist": "weapon",
        "athlete": "helmet",
        "tile_stack": "tile_stack",
        "commander": "artifact",
        "armored_explorer": "helmet",
        "spaceship": "spaceship",
        "investigator": "book",
        "skateboarder": "vehicle",
        "covert_operative": "weapon",
    }
    return subject_object_map.get(subject_key, OBJECT_BY_BUCKET[bucket][0])


def choose_context_scene(bucket: str) -> str:
    return CONTEXT_BY_BUCKET[bucket]


def choose_genre_signal(bucket: str) -> str:
    return GENRE_SIGNAL_BY_BUCKET[bucket]


def infer_risk_level(title: str, bucket: str) -> tuple[str, list[str]]:
    title_lc = title.lower()
    hits_high = sorted(token for token in HIGH_RISK_TOKENS if token in title_lc)
    if hits_high:
        return "high", hits_high
    hits_medium = sorted(token for token in MEDIUM_RISK_TOKENS if token in title_lc)
    if hits_medium or bucket in {"platformer_cartoon", "fighting"}:
        return "medium", hits_medium or ["bucket_sensitive_visual_identity"]
    return "low", ["generic_atmosphere_safe"]


def choose_illustration_class(bucket: str, risk_level: str) -> str:
    if bucket in {"survival_horror", "mystery_adventure"}:
        return "environment"
    return "object"


def choose_platform_style(platform: str) -> dict:
    return PLATFORM_STYLES.get(platform, DEFAULT_PLATFORM_STYLE)


def build_negative_prompt(record: dict) -> str:
    extra = []
    for token in record["risk_reasons"]:
        if token == "bucket_sensitive_visual_identity":
            extra.append("avoid any mascot-like facial or costume elements")
        elif token != "generic_atmosphere_safe":
            extra.append(f"avoid resemblance to {token}")
    extra.extend([
        "no official character likeness",
        "no copyrighted costume replication",
        "no original enemy designs",
        "no game logo",
        "no UI elements",
        "no screenshot recreation",
        "no exact box art composition",
        "no branded symbols",
        "no text",
        "no abstract shapes",
        "no decorative geometry",
        "no empty background",
    ])
    return ", ".join(merge_unique(extra))


def build_prompt(record: dict) -> str:
    return MASTER_PROMPT.format(
        title=record["title"],
        platform=record["platform"],
        year=record["year"],
        genre_primary=record["genre_primary"],
        genre_secondary=record["genre_secondary"],
        tone=", ".join(record["tone"]),
        main_subject=record["main_subject"],
        context_scene=record["context_scene"],
        action_mood_cue=record["action_mood_cue"],
        composition_rule=COMPOSITION_BY_CLASS[record["illustration_class"]],
        platform_style=record["platform_style_description"],
    ).strip()


def priority_score(record: dict) -> int:
    rarity_bonus = {"COMMON": 0, "UNCOMMON": 10, "RARE": 25, "ULTRA RARE": 35, "LEGENDARY": 45}
    metascore = int(record.get("metascore") or 0)
    rarity = rarity_bonus.get(str(record.get("rarity") or "").upper(), 5)
    year = int(record.get("year") or 0)
    return metascore * 10 + rarity + max(0, year - 1980)


def normalize_records(catalog: list[dict], entries: dict) -> list[dict]:
    normalized = []
    for game in catalog:
        entry = entries.get(game["id"], {})
        genre_primary, genre_secondary = infer_genres(game, entry)
        bucket = infer_bucket(game["title"], genre_primary, genre_secondary)
        tone, setting, key_objects = infer_tone_setting_objects(game["title"], bucket)
        subject_profile = choose_subject_profile(game["title"], bucket)
        subject_key = subject_profile["subject_key"]
        core_object = choose_core_object(subject_key, bucket)
        context_scene = choose_context_scene(bucket)
        genre_signal = choose_genre_signal(bucket)
        supportive_objects = [obj for obj in key_objects if obj != core_object]
        key_objects = merge_unique([core_object], supportive_objects, OBJECT_BY_BUCKET[bucket][1:])
        normalized.append({
            "game_id": game["id"],
            "slug": slugify(game["id"]),
            "title": game["title"],
            "platform": game["console"],
            "year": int(game["year"]) if game.get("year") else 0,
            "developer": game.get("developer") or "",
            "metascore": int(game.get("metascore") or 0),
            "rarity": game.get("rarity") or "COMMON",
            "genre_primary": genre_primary,
            "genre_secondary": genre_secondary,
            "tone": tone,
            "setting": setting,
            "key_objects": key_objects[:4],
            "subject_key": subject_key,
            "main_subject": subject_profile["main_subject"],
            "action_mood_cue": subject_profile["action_mood_cue"],
            "core_object": core_object,
            "context_scene": context_scene,
            "genre_signal": genre_signal,
            "focus_scale": 1.0,
        })
    return normalized


def classify_records(records: list[dict]) -> list[dict]:
    classified = []
    for record in records:
        style = choose_platform_style(record["platform"])
        bucket = infer_bucket(record["title"], record["genre_primary"], record["genre_secondary"])
        risk_level, risk_reasons = infer_risk_level(record["title"], bucket)
        classified_record = dict(record)
        classified_record.update({
            "bucket": bucket,
            "platform_style_id": style["style_id"],
            "platform_style_description": style["description"],
            "risk_level": risk_level,
            "risk_reasons": risk_reasons,
            "illustration_class": choose_illustration_class(bucket, risk_level),
            "composition_type": choose_illustration_class(bucket, risk_level),
            "priority": priority_score(record),
            "legal_notes": f"Risk level {risk_level}; use generic subject archetypes, readable environments, and platform-coded style only. Downgrade if likeness risk rises.",
        })
        classified.append(classified_record)
    return classified


def prompt_records(records: list[dict]) -> list[dict]:
    prompted = []
    for record in records:
        next_record = dict(record)
        next_record["prompt"] = build_prompt(record)
        next_record["negative_prompt"] = build_negative_prompt(record)
        next_record["retry_count"] = 0
        next_record["status"] = "queued"
        next_record["correction_notes"] = []
        prompted.append(next_record)
    return prompted


def save_prompt_files(prompt_dir: Path, record: dict):
    payload = {
        "game_id": record["game_id"],
        "slug": record["slug"],
        "title": record["title"],
        "platform": record["platform"],
        "year": record["year"],
        "genre_primary": record["genre_primary"],
        "genre_secondary": record["genre_secondary"],
        "bucket": record["bucket"],
        "platform_style": record["platform_style_id"],
        "illustration_class": record["illustration_class"],
        "risk_level": record["risk_level"],
        "subject_key": record.get("subject_key"),
        "main_subject": record.get("main_subject"),
        "action_mood_cue": record.get("action_mood_cue"),
        "composition_type": record["composition_type"],
        "prompt": record["prompt"],
        "negative_prompt": record["negative_prompt"],
        "legal_notes": record["legal_notes"],
        "status": record.get("status", "queued"),
    }
    write_json(prompt_dir / f"{record['slug']}.json", payload)
    write_text(prompt_dir / f"{record['slug']}.txt", f"{record['prompt']}\n\nNegative constraints:\n{record['negative_prompt']}\n")


def downgrade_class(value: str) -> str:
    if value == "environment":
        return "object"
    return "object"


def apply_auto_correction(record: dict, qa_result: dict, retry_count: int) -> dict:
    next_record = dict(record)
    next_record["retry_count"] = retry_count + 1
    notes = list(next_record.get("correction_notes", []))
    if any(reason in qa_result["failure_reasons"] for reason in ["no_character_likeness", "no_copyright_replication"]):
        next_record["illustration_class"] = downgrade_class(next_record["illustration_class"])
        next_record["focus_scale"] = max(float(next_record.get("focus_scale", 1.0)), 1.12)
        notes.append("Removed likeness risk by forcing a simpler subject-first composition.")
    elif "subject_readable" in qa_result["failure_reasons"]:
        next_record["illustration_class"] = "object"
        next_record["focus_scale"] = max(float(next_record.get("focus_scale", 1.0)) + 0.12, 1.18)
        notes.append("Enlarged the subject and simplified the scene to improve readability.")
    else:
        next_record["illustration_class"] = downgrade_class(next_record["illustration_class"])
        next_record["focus_scale"] = max(float(next_record.get("focus_scale", 1.0)), 1.08)
        notes.append("Simplified composition and reinforced the central subject.")
    next_record["composition_type"] = next_record["illustration_class"] + "_adjusted"
    next_record["prompt"] = build_prompt(next_record) + "\n\nAdjustment: enlarge the central subject, reduce clutter, strengthen contrast, and keep the background supportive but secondary."
    next_record["negative_prompt"] = build_negative_prompt(next_record) + ", simplify background detail, no humanoid face, no mascot proportions"
    next_record["correction_notes"] = notes
    return next_record


def write_tracking_csv(path: Path, rows: list[dict]):
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["game_id", "status", "risk_level", "illustration_class", "retries", "qa_score"])
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def build_report(path: Path, context: dict):
    lines = [
        "# RetroDex Visual Batch Summary",
        "",
        f"- Run ID: `{context['run_id']}`",
        f"- Generated at: `{context['generated_at']}`",
        f"- Normalized games: `{context['normalized_count']}`",
        f"- Classified games: `{context['classified_count']}`",
        f"- Prompt records: `{context['prompt_count']}`",
        f"- Batch size processed: `{context['batch_size']}`",
        f"- Generated: `{context['generated']}`",
        f"- Flagged: `{context['flagged']}`",
        f"- Average QA score: `{context['avg_qa']:.1f}`",
        f"- Throughput estimate: `{context['throughput']:.1f}` games/hour",
        "",
        "## Failure Patterns",
    ]
    if context["failure_patterns"]:
        for reason, count in sorted(context["failure_patterns"].items(), key=lambda item: (-item[1], item[0])):
            lines.append(f"- `{reason}`: {count}")
    else:
        lines.append("- No automatic QA failures in this batch.")
    lines.extend(["", "## Flagged Images"])
    if context["flagged_items"]:
        for item in context["flagged_items"]:
            lines.append(f"- `{item['record']['game_id']}` -> `{item['render']['path']}` | reasons: {', '.join(item['qa']['failure_reasons'])}")
    else:
        lines.append("- None.")
    lines.extend(["", "## Validation Package", f"- Contact sheet: `{context['contact_sheet']}`", "- Human review should confirm atmosphere recognition, legal safety, and GameDetail overlay fit before wider rollout.", "", "## Next Batch Preview"])
    for item in context["next_batch_preview"]:
        lines.append(f"- `{item['game_id']}` | `{item['title']}` | `{item['platform']}` | priority `{item['priority']}`")
    write_text(path, "\n".join(lines) + "\n")


def run_pipeline(batch_size: int, game_ids: list[str] | None = None) -> dict:
    start = perf_counter()
    run_id = datetime.now(timezone.utc).strftime("visual_batch_%Y%m%dT%H%M%SZ")
    run_log_dir = ensure_dir(LOG_ROOT / run_id)
    prompt_dir = ensure_dir(PROMPT_ROOT / run_id)

    catalog = read_json(DATA_DIR / "catalog.json")
    entries = read_json(DATA_DIR / "entries.json")

    normalized = normalize_records(catalog, entries)
    write_json(run_log_dir / "checkpoint_01_normalized_games.json", normalized)

    classified = classify_records(normalized)
    write_json(run_log_dir / "checkpoint_02_classification.json", classified)

    prompted = prompt_records(classified)
    write_json(run_log_dir / "checkpoint_03_prompts.json", prompted)
    for record in prompted:
        save_prompt_files(prompt_dir, record)

    render_queue = sorted(prompted, key=lambda item: (-item["priority"], item["year"], item["title"]))
    if game_ids:
        requested = {value.strip() for value in game_ids if value.strip()}
        render_queue = [item for item in render_queue if item["game_id"] in requested]
    write_json(run_log_dir / "checkpoint_04_render_queue.json", render_queue)

    processed_rows = []
    failure_patterns = Counter()
    flagged_items = []
    batch_items = []
    for queue_item in render_queue[:batch_size]:
        current = dict(queue_item)
        final_result = None
        for retry_count in range(0, 3):
            style = choose_platform_style(current["platform"])
            palette = style["palette"]
            rng = random.Random(stable_seed(current["game_id"], current["illustration_class"], str(retry_count)))
            platform_slug = slugify(current["platform"])
            render_name = f"{current['slug']}_b01_r{retry_count:02d}.png"
            render_path = RENDER_ROOT / run_id / platform_slug / render_name
            render_meta = render_image(current, render_path, retry_count, palette, rng)
            render_meta["path"] = str(render_path.relative_to(ROOT)).replace("\\", "/")
            qa = run_qa(current, render_meta, style["style_id"], retry_count)
            sidecar = {
                "game_id": current["game_id"],
                "title": current["title"],
                "platform": current["platform"],
                "retry_count": retry_count,
                "classification": {"bucket": current["bucket"], "risk_level": current["risk_level"], "illustration_class": current["illustration_class"], "composition_type": current["composition_type"]},
                "prompt": current["prompt"],
                "negative_prompt": current["negative_prompt"],
                "render": render_meta,
                "qa": qa,
                "generated_at": now_utc(),
            }
            write_json(render_path.with_suffix(".json"), sidecar)
            final_result = {"record": current, "render": render_meta, "qa": qa}
            if qa["status"] == "generated":
                break
            failure_patterns.update(qa["failure_reasons"])
            current = apply_auto_correction(current, qa, retry_count)

        batch_items.append(final_result)
        if final_result["qa"]["status"] == "flagged":
            flagged_items.append(final_result)
        processed_rows.append({
            "game_id": final_result["record"]["game_id"],
            "status": final_result["qa"]["status"],
            "risk_level": final_result["record"]["risk_level"],
            "illustration_class": final_result["record"]["illustration_class"],
            "retries": final_result["record"].get("retry_count", 0),
            "qa_score": final_result["qa"]["qa_score"],
        })

    tracking_path = run_log_dir / "checkpoint_05_tracking.csv"
    write_tracking_csv(tracking_path, processed_rows)
    contact_sheet_path = run_log_dir / "validation_contact_sheet_batch_001.png"
    build_contact_sheet(batch_items, contact_sheet_path)

    elapsed = max(0.001, perf_counter() - start)
    report_context = {
        "run_id": run_id,
        "generated_at": now_utc(),
        "normalized_count": len(normalized),
        "classified_count": len(classified),
        "prompt_count": len(prompted),
        "batch_size": len(batch_items),
        "generated": sum(1 for item in batch_items if item["qa"]["status"] == "generated"),
        "flagged": sum(1 for item in batch_items if item["qa"]["status"] == "flagged"),
        "avg_qa": sum(item["qa"]["qa_score"] for item in batch_items) / max(1, len(batch_items)),
        "throughput": len(batch_items) * 3600.0 / elapsed,
        "failure_patterns": dict(failure_patterns),
        "flagged_items": flagged_items,
        "contact_sheet": str(contact_sheet_path.relative_to(ROOT)).replace("\\", "/"),
        "next_batch_preview": render_queue[batch_size:batch_size + 10],
    }
    build_report(run_log_dir / "report_batch_summary.md", report_context)

    validation_package = {
        "run_id": run_id,
        "batch_size": len(batch_items),
        "generated_items": [{"game_id": item["record"]["game_id"], "title": item["record"]["title"], "platform": item["record"]["platform"], "render_path": item["render"]["path"], "qa_score": item["qa"]["qa_score"], "status": item["qa"]["status"]} for item in batch_items],
        "flagged_items": [{"game_id": item["record"]["game_id"], "render_path": item["render"]["path"], "failure_reasons": item["qa"]["failure_reasons"], "retry_count": item["record"].get("retry_count", 0)} for item in flagged_items],
        "next_batch_ready": [{"game_id": item["game_id"], "title": item["title"], "platform": item["platform"], "priority": item["priority"]} for item in render_queue[batch_size:batch_size + 10]],
        "contact_sheet": str(contact_sheet_path.relative_to(ROOT)).replace("\\", "/"),
    }
    write_json(run_log_dir / "validation_package.json", validation_package)
    return {
        "run_id": run_id,
        "log_dir": str(run_log_dir.relative_to(ROOT)).replace("\\", "/"),
        "prompt_dir": str(prompt_dir.relative_to(ROOT)).replace("\\", "/"),
        "generated_count": report_context["generated"],
        "flagged_count": report_context["flagged"],
        "throughput": report_context["throughput"],
        "avg_qa": report_context["avg_qa"],
        "contact_sheet": validation_package["contact_sheet"],
        "validation_package": str((run_log_dir / "validation_package.json").relative_to(ROOT)).replace("\\", "/"),
    }


def parse_args():
    parser = argparse.ArgumentParser(description="RetroDex legacy local illustration renderer. Deprecated for final art.")
    parser.add_argument("--batch-size", type=int, default=50, help="Number of games to render in the current autonomous batch.")
    parser.add_argument("--game-ids", type=str, default="", help="Comma-separated list of game ids to process.")
    parser.add_argument("--legacy-local-renderer", action="store_true", help="Explicitly allow the deprecated local renderer path.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not args.legacy_local_renderer:
        print(json.dumps({
            "status": "deprecated",
            "message": "Local renderer disabled for final art. Use scripts/retrodex_prompt_pack_pipeline.py for the production path.",
        }, indent=2))
        return 2
    selected_ids = [value.strip() for value in args.game_ids.split(",") if value.strip()]
    result = run_pipeline(batch_size=args.batch_size, game_ids=selected_ids or None)
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
