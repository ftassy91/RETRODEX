from __future__ import annotations

import argparse
import csv
import json
import re
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
ASSET_ROOT = ROOT / "assets" / "retrodex"
PROMPT_PACK_ROOT = ASSET_ROOT / "prompt_packs"
REVIEW_ROOT = ASSET_ROOT / "review"
LOG_ROOT = ASSET_ROOT / "logs"
FRANCHISE_MEMORY_RULES_PATH = DATA_DIR / "retrodex_franchise_memory_rules.json"

PROMPT_VERSION = "prompt_formula_v1_production"

MASTER_PROMPT = """Original illustration inspired by a retro {genre_primary} game.

{subject_clause} in {environment}, {action_mood_cue}.

Visual focus:
- one clear subject
- strong silhouette
- readable in 1 second
- exactly one primary focal subject
- no crowd, no collage, no multi-character scene

Style:
- {platform_style}
- always rendered as pixel art
- crisp pixel edges, readable sprite-like shading, and controlled dithering when useful
- clean and modern interpretation of retro limitations
- limited color palette when relevant

Mood:
- {mood}

Composition:
- {composition}
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
- pixel art only
- no text
- no watermark
"""

ARTICLELESS_SUBJECT_PREFIXES = {"stacked", "falling", "interlocking", "layered", "glowing", "floating"}

PLATFORM_STYLES = {
    "Nintendo Entertainment System": {"style_id": "nes_restrained_poster", "description": "NES aesthetic, limited palette, simple iconic forms, crisp outlines, and strong silhouette readability", "palette_hint": ["#0d1b2a", "#415a77", "#c8d5b9", "#f4d35e"]},
    "Super Nintendo": {"style_id": "snes_storybook_16bit", "description": "SNES aesthetic, rich pixel art, layered backgrounds, soft gradients, and readable 16-bit atmosphere", "palette_hint": ["#1f2041", "#4b3f72", "#ffc857", "#f4f1de"]},
    "PlayStation": {"style_id": "ps1_pixel_editorial", "description": "PlayStation-inspired pixel art, moody lighting, low-poly-era color language, and strong late-90s contrast translated into crisp pixels", "palette_hint": ["#11151c", "#364156", "#d66853", "#f3dfa2"]},
    "Nintendo 64": {"style_id": "n64_pixel_volume", "description": "Nintendo 64-inspired pixel art, playful rounded forms, bold readable color blocks, and toy-like volume interpreted through crisp pixel work", "palette_hint": ["#1b1b3a", "#693668", "#f84aa7", "#5dfdcb"]},
    "Game Boy": {"style_id": "gameboy_monochrome_story", "description": "Game Boy aesthetic, green monochrome palette, crisp pixel forms, portable mood, and very clean value separation", "palette_hint": ["#0f380f", "#306230", "#8bac0f", "#cadc9f"]},
    "Game Boy Advance": {"style_id": "gba_bright_action", "description": "Game Boy Advance aesthetic, bright controlled colors, portable action framing, and clean pixel readability", "palette_hint": ["#0c1821", "#324a5f", "#f7b267", "#84dcc6"]},
    "Nintendo DS": {"style_id": "nds_clean_dual_panel", "description": "Nintendo DS-inspired pixel art, clean handheld color blocking, modernized crisp edges, and layered portable clarity", "palette_hint": ["#172121", "#7f7caf", "#f45b69", "#ffd166"]},
    "Sega Genesis": {"style_id": "genesis_arcade_energy", "description": "Genesis aesthetic, bold contrast, arcade energy, harder shadows, and punchy action framing", "palette_hint": ["#14080e", "#49475b", "#e9eb9e", "#f06543"]},
    "Sega Saturn": {"style_id": "saturn_pixel_arcade", "description": "Saturn-inspired pixel art, sharper contrast, premium arcade mood, and elegant late-90s framing expressed through crisp pixel clusters", "palette_hint": ["#1f0322", "#3d1c5b", "#f6f7eb", "#f72c25"]},
    "Dreamcast": {"style_id": "dreamcast_pixel_futurist", "description": "Dreamcast-inspired pixel art, bright accent light, airy arcade composition, and clean futurist shapes rendered with crisp pixels", "palette_hint": ["#0b132b", "#3a506b", "#5bc0be", "#ff9f1c"]},
    "Neo Geo": {"style_id": "neo_geo_premium_arcade", "description": "Neo Geo aesthetic, premium arcade key art, dramatic contrast, dynamic framing, and rich fighting-game energy", "palette_hint": ["#13070c", "#b33f62", "#f9564f", "#f3c677"]},
    "TurboGrafx-16": {"style_id": "turbografx_arcade_poster", "description": "TurboGrafx-16-inspired pixel art, bright arcade poster energy, crisp light, and expressive high-contrast shapes", "palette_hint": ["#231942", "#9f86c0", "#e0b1cb", "#f7ece1"]},
}

DEFAULT_PLATFORM_STYLE = {
    "style_id": "retrodex_editorial_default",
    "description": "retro editorial pixel art with controlled contrast, collectible-card composition, and clean silhouettes",
    "palette_hint": ["#111827", "#374151", "#e5e7eb", "#f59e0b"],
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

TITLE_DIRECTION_RULES = [
    {
        "keywords": ["link's awakening"],
        "main_subject": "a small child-sized adventurer seen from behind on the left foreground with a short sword at their side",
        "environment": "a calm island shoreline looking across open water toward a single steep mountain island placed on the right side, with a smooth egg-shaped shrine integrated at its summit",
        "action_mood_cue": "standing still after reaching the shore, facing the distant island in sea wind",
        "mood": ["lonely", "dreamlike", "adventurous"],
        "composition": "small child-sized figure anchored in the lower-left foreground, broad reflective water across the center, one dominant mountain island on the right third, a clear egg-shaped summit, simple clouds, screen-like framing, and strong negative space",
        "legal_watchouts": ["avoid Link likeness", "avoid exact island mountain shapes from official art", "avoid official shield and hat details", "avoid title-screen text or logos", "avoid exact Wind Fish egg iconography"],
        "memory_hook": "portable island adventure, quiet arrival after the shore, and a single egg-crowned destination on the horizon",
    },
    {
        "keywords": ["zelda", "ocarina of time"],
        "main_subject": "a small solitary adventurer with a simple sword and round shield",
        "environment": "a windswept fantasy field or shoreline facing one monumental ancient landmark on the horizon",
        "action_mood_cue": "pausing in the wind before the journey continues",
        "mood": ["mysterious", "heroic", "dreamlike"],
        "composition": "small foreground subject, one dominant distant landmark, broad open space, clean sky and very low clutter",
        "legal_watchouts": ["avoid Link likeness", "avoid Triforce-like symbols", "avoid official shield patterns"],
        "memory_hook": "solitary overworld discovery, mythic destination, and horizon-driven adventure",
    },
    {
        "keywords": ["resident evil", "silent hill"],
        "main_subject": "lone figure holding a flashlight",
        "environment": "a dark corridor or threatening interior with one visible threshold",
        "action_mood_cue": "with the light cutting sharply through the darkness",
        "mood": ["tense", "oppressive", "unknown"],
        "composition": "corridor perspective with the figure dominant and the beam shaping the scene",
        "legal_watchouts": ["avoid official protagonists", "avoid zombie designs", "avoid iconic mansion symbols"],
        "memory_hook": "survival tension, keys, doors, and dread beyond the frame",
    },
    {
        "keywords": ["mario kart"],
        "main_subject": "a single colorful kart",
        "environment": "a curved race track with readable edge markers and dust",
        "action_mood_cue": "drifting hard through the corner with exaggerated motion",
        "mood": ["fast", "playful", "competitive"],
        "composition": "one vehicle only, dynamic three-quarter angle, clean track background",
        "legal_watchouts": ["avoid Mario likeness", "avoid mushroom iconography", "avoid branded kart details"],
        "memory_hook": "arcade drift, speed bursts, and toy-like race energy",
    },
    {
        "keywords": ["metroid"],
        "main_subject": "a lone armored explorer with an arm-mounted tool",
        "environment": "an alien cavern with massive biomechanical pillars, acid glow, and a dark passage ahead",
        "action_mood_cue": "aiming the arm-mounted tool into the dark in hostile silence",
        "mood": ["isolated", "mysterious", "alien"],
        "composition": "single explorer foreground, one clear passage, deep cavern layers, sparse readable glow",
        "legal_watchouts": ["avoid Samus suit likeness", "avoid Metroid creature silhouette", "avoid Chozo-like symbols", "avoid sword-like weapon silhouettes"],
        "memory_hook": "exploration, alien solitude, and hostile vertical space",
    },
]

TITLE_DIRECTION_RULES.extend([
    {
        "keywords": ["tony hawk", "skater"],
        "main_subject": "a single skateboarder silhouette",
        "environment": "a concrete skate scene with a rail, ramp, or ledge",
        "action_mood_cue": "captured mid-motion with the board clearly readable",
        "mood": ["kinetic", "confident", "street"],
        "composition": "one skater only, low clutter, strong board silhouette, urban depth in the back",
        "legal_watchouts": ["avoid real athlete likeness", "avoid sponsor branding", "avoid licensed deck graphics"],
        "memory_hook": "trick flow, concrete texture, and arcade sports momentum",
    },
    {
        "keywords": ["soul calibur"],
        "main_subject": "a lone duelist with a large blade",
        "environment": "a wind-swept stone platform before a monumental ring gate and distant ruins",
        "action_mood_cue": "holding a poised guard stance just before the duel begins",
        "mood": ["mythic", "charged", "ceremonial"],
        "composition": "single duelist only, one readable blade, no crowd, one monumental landmark behind",
        "legal_watchouts": ["avoid roster character likeness", "avoid signature swords", "avoid crowd scenes", "avoid franchise costumes"],
        "memory_hook": "weapon-based duel, sacred arena, and pre-impact tension",
    },
    {
        "keywords": ["tekken"],
        "main_subject": "a lone street fighter in a tight guard stance",
        "environment": "a neon-lit concrete rooftop or industrial training floor at night",
        "action_mood_cue": "framed before impact under one harsh backlight",
        "mood": ["intense", "athletic", "urban"],
        "composition": "single fighter only, no crowd, low camera, one dominant light source, strong shadow",
        "legal_watchouts": ["avoid roster character likeness", "avoid signature hairstyles", "avoid crowd scenes", "avoid franchise costumes"],
        "memory_hook": "close-range pressure, impact timing, and urban combat attitude",
    },
    {
        "keywords": ["tekken", "soul calibur", "street fighter", "mortal kombat", "garou", "fatal fury"],
        "main_subject": "a lone martial artist or duelist silhouette",
        "environment": "an arena or duel space with one clear floor plane and no visible crowd",
        "action_mood_cue": "holding a pre-impact combat stance under dramatic light",
        "mood": ["charged", "focused", "dramatic"],
        "composition": "single fighter, clear pose, readable stance, empty background secondary",
        "legal_watchouts": ["avoid roster character likeness", "avoid franchise costumes", "avoid signature weapons or hairstyles", "avoid crowd scenes"],
        "memory_hook": "versus tension, stance readability, and arena pressure",
    },
    {
        "keywords": ["perfect dark"],
        "main_subject": "a lone covert operative with compact futuristic gear",
        "environment": "a sterile data-vault corridor with glass, consoles, and cold security light",
        "action_mood_cue": "advancing cautiously toward a sealed breach",
        "mood": ["stealthy", "clinical", "tense"],
        "composition": "single operative only, corridor depth, no trench coat, no fedora, minimal props",
        "legal_watchouts": ["avoid specific spy likeness", "avoid weapon replicas", "avoid franchise logos or device designs", "avoid noir detective styling"],
        "memory_hook": "covert infiltration, sci-fi espionage, and cold facility tension",
    },
    {
        "keywords": ["goldeneye", "metal gear"],
        "main_subject": "a lone covert operative silhouette with compact gear",
        "environment": "a tense high-tech corridor or facility edge",
        "action_mood_cue": "moving carefully through hard shadow and cold light",
        "mood": ["stealthy", "tense", "controlled"],
        "composition": "single silhouette, corridor depth, strong light break, minimal props",
        "legal_watchouts": ["avoid specific spy likeness", "avoid weapon replicas", "avoid franchise logos or device designs"],
        "memory_hook": "stealth, infiltration, and intelligence thriller mood",
    },
    {
        "keywords": ["tetris", "puzzle"],
        "main_subject": "a nearly complete wall of interlocking blocks with one falling piece above a tight gap",
        "environment": "a tall glowing playfield seen head-on like a handheld puzzle screen in the dark",
        "action_mood_cue": "caught one instant before the final drop locks into place",
        "mood": ["focused", "clean", "hypnotic"],
        "composition": "single vertical playfield, one falling piece, no isometric explosion, no extra decoration",
        "legal_watchouts": ["avoid official block arrangements from known promo art", "avoid branded UI framing", "avoid floating cube sculpture compositions"],
        "memory_hook": "falling rhythm, spatial pressure, and instant readability",
    },
    {
        "keywords": ["super mario 64"],
        "main_subject": "a small agile explorer running forward",
        "environment": "a rounded toy-like 3D course with grassy slopes, chunky stone ledges, and a distant tower doorway",
        "action_mood_cue": "mid-stride on a clear route toward the landmark",
        "mood": ["playful", "bright", "adventurous"],
        "composition": "single explorer only, one readable route, rounded hills, no abstract block maze",
        "legal_watchouts": ["avoid Mario likeness", "avoid mustache and hat codes", "avoid official mushrooms or stars", "avoid abstract geometry-first compositions"],
        "memory_hook": "open 3D platform course, toy-like movement, and landmark-driven exploration",
    },
    {
        "keywords": ["super mario bros. 3"],
        "main_subject": "a small agile explorer in side view",
        "environment": "a theatrical side-scrolling platform course with layered block islands, suspended platforms, and open sky",
        "action_mood_cue": "caught in a clean upward leap over a gap",
        "mood": ["playful", "nimble", "bright"],
        "composition": "single explorer only, side-view read, one jump arc, no crowd, no abstract stripes",
        "legal_watchouts": ["avoid Mario likeness", "avoid mustache and hat codes", "avoid official mushrooms or stars", "avoid purely graphic stripe backgrounds"],
        "memory_hook": "2D jump rhythm, stage-like worlds, and forward platform momentum",
    },
    {
        "keywords": ["mario"],
        "main_subject": "a small agile explorer",
        "environment": "a bright platform world with layered terrain and a clear route forward",
        "action_mood_cue": "caught in a clean upward leap through the scene",
        "mood": ["playful", "bright", "buoyant"],
        "composition": "single explorer, one readable jump arc, layered platforms, simple sky, no abstract geometry-first layout",
        "legal_watchouts": ["avoid Mario likeness", "avoid mustache and hat codes", "avoid official mushrooms or stars", "avoid abstract geometry-first layouts"],
        "memory_hook": "jump rhythm, forward momentum, and playful platform discovery",
    },
    {
        "keywords": ["castlevania"],
        "main_subject": "a lone gothic adventurer with a blade",
        "environment": "a stormy castle approach with moonlight and heavy stone forms",
        "action_mood_cue": "standing before the ascent in a moment of tension",
        "mood": ["gothic", "heroic", "threatening"],
        "composition": "single adventurer foreground, castle silhouette distance, strong moonlit contrast",
        "legal_watchouts": ["avoid Belmont likeness", "avoid whip-specific silhouettes", "avoid Dracula iconography"],
        "memory_hook": "castle ascent, gothic action, and dangerous nobility",
    },
])

if FRANCHISE_MEMORY_RULES_PATH.exists():
    try:
        _memory_payload = json.loads(FRANCHISE_MEMORY_RULES_PATH.read_text(encoding="utf-8"))
        EXTERNAL_MEMORY_RULES = list(_memory_payload.get("rules", []))
    except Exception:
        EXTERNAL_MEMORY_RULES = []
else:
    EXTERNAL_MEMORY_RULES = []

BUCKET_FALLBACKS = {
    "fantasy_adventure": {"main_subject": "a lone fantasy adventurer", "environment": "a mythic landscape with ruins and a readable path", "action_mood_cue": "facing a distant destination in moving wind", "mood": ["mysterious", "heroic", "mythic"], "composition": "single subject in the foreground, world behind it, one clear landmark", "memory_hook": "journey, discovery, and ancient places"},
    "rpg_epic": {"main_subject": "a lone wanderer beside a glowing relic", "environment": "a broad sacred horizon with ruins and story-scale depth", "action_mood_cue": "standing in a calm moment before a larger quest", "mood": ["epic", "melancholic", "legendary"], "composition": "single subject foreground, relic secondary, layered horizon", "memory_hook": "scale, myth, and world-spanning stakes"},
    "platformer_cartoon": {"main_subject": "a small agile explorer", "environment": "a bright platform world with layered terrain and depth", "action_mood_cue": "caught in a clean leap through the route ahead", "mood": ["playful", "kinetic", "bright"], "composition": "single subject, one clear jump arc, layered route, little clutter", "memory_hook": "timing, jumps, and forward motion"},
    "survival_horror": {"main_subject": "a lone figure with a flashlight", "environment": "a dark threatening interior with one visible threshold", "action_mood_cue": "with light carving a narrow path through the dark", "mood": ["tense", "isolated", "oppressive"], "composition": "single figure, corridor depth, strong light break", "memory_hook": "dread, doors, and survival pressure"},
    "racing": {"main_subject": "a single racing machine", "environment": "a curved track with motion cues and road edge markers", "action_mood_cue": "leaning into speed through the corner", "mood": ["fast", "mechanical", "competitive"], "composition": "one vehicle only, strong diagonal, background secondary", "memory_hook": "speed, line choice, and arcade motion"},
    "fighting": {"main_subject": "a lone duelist silhouette", "environment": "an arena or confrontation space", "action_mood_cue": "holding a readable pre-impact stance", "mood": ["charged", "dramatic", "focused"], "composition": "single fighter, strong pose, simple arena depth", "memory_hook": "stance, tension, and immediate versus energy"},
    "sports": {"main_subject": "a single athlete silhouette", "environment": "a lit competition ground with clean field markers", "action_mood_cue": "leaning into controlled movement", "mood": ["focused", "competitive", "clean"], "composition": "one athlete, simple event context, readable action line", "memory_hook": "competition, timing, and event pressure"},
    "puzzle_abstract": {"main_subject": "stacked physical puzzle pieces", "environment": "a grounded playfield or spatial surface", "action_mood_cue": "captured in a decisive arrangement", "mood": ["precise", "clean", "cerebral"], "composition": "pieces dominate, background minimal, space very readable", "memory_hook": "placement, gravity, and pattern recognition"},
    "strategy_tactics": {"main_subject": "a lone commander at a tactical table", "environment": "a war room, map table, or battlefield edge", "action_mood_cue": "studying the field with discipline", "mood": ["strategic", "measured", "disciplined"], "composition": "single figure or table focus, markers readable, clutter low", "memory_hook": "planning, territory, and decision-making"},
    "sci_fi_action": {"main_subject": "a lone armored explorer", "environment": "an alien or industrial sci-fi environment with cold light", "action_mood_cue": "standing ready in a hostile unknown zone", "mood": ["futuristic", "cold", "urgent"], "composition": "single subject, deep background, few strong light sources", "memory_hook": "exploration, danger, and futuristic scale"},
    "shooter_arcade": {"main_subject": "a single attack ship", "environment": "a combat lane, sky corridor, or deep space route", "action_mood_cue": "cutting forward under immediate threat", "mood": ["aggressive", "fast", "arcade"], "composition": "single craft, strong forward direction, readable threat space", "memory_hook": "velocity, projectile pressure, and arcade survival"},
    "mystery_adventure": {"main_subject": "a lone investigator", "environment": "a quiet room, archive, or hidden passage", "action_mood_cue": "reading the scene in near silence", "mood": ["curious", "quiet", "investigative"], "composition": "single figure, one clue focus, environment still readable", "memory_hook": "clues, silence, and hidden meaning"},
}


def now_utc() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def slugify(value: str) -> str:
    return re.sub(r"(^-|-$)", "", re.sub(r"[^a-z0-9]+", "-", value.lower()))


def ensure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload):
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


def write_text(path: Path, content: str):
    path.write_text(content, encoding="utf-8")


def next_unique_run_id(base_run_id: str) -> str:
    candidate = base_run_id
    index = 2
    while (
        (PROMPT_PACK_ROOT / candidate).exists()
        or (REVIEW_ROOT / candidate).exists()
        or (LOG_ROOT / candidate).exists()
    ):
        candidate = f"{base_run_id}_r{index}"
        index += 1
    return candidate


def canonical_genre(value: str) -> str:
    raw = str(value or "").strip().lower()
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


def fallback_secondary(primary: str) -> str:
    mapping = {
        "Platformer": "Playful",
        "Action-Adventure": "Fantasy",
        "Adventure": "Mystery",
        "RPG": "Epic",
        "Action": "Retro",
        "Racing": "Competition",
        "Fighting": "Combat",
        "Sports": "Competition",
        "Strategy": "Tactics",
        "Survival Horror": "Horror",
        "Shoot'em up": "Arcade",
    }
    return mapping.get(primary, "Retro")


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
    return "sci_fi_action" if "sci" in gs else "mystery_adventure"


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


def choose_platform_style(platform: str) -> dict:
    return PLATFORM_STYLES.get(platform, DEFAULT_PLATFORM_STYLE)


def infer_risk_level(title: str, bucket: str) -> tuple[str, list[str]]:
    title_lc = title.lower()
    hits_high = sorted(token for token in HIGH_RISK_TOKENS if token in title_lc)
    if hits_high:
        return "high", hits_high
    hits_medium = sorted(token for token in MEDIUM_RISK_TOKENS if token in title_lc)
    if hits_medium or bucket in {"platformer_cartoon", "fighting"}:
        return "medium", hits_medium or ["bucket_sensitive_visual_identity"]
    return "low", ["generic_atmosphere_safe"]


def choose_direction(title: str, bucket: str) -> dict:
    title_lc = title.lower()
    for rule in EXTERNAL_MEMORY_RULES:
        if any(keyword in title_lc for keyword in rule["keywords"]):
            return dict(rule)
    for rule in TITLE_DIRECTION_RULES:
        if any(keyword in title_lc for keyword in rule["keywords"]):
            return dict(rule)
    return dict(BUCKET_FALLBACKS[bucket])


def build_subject_clause(main_subject: str) -> str:
    phrase = re.sub(r"\s+", " ", main_subject).strip()
    if not phrase:
        return "A retro scene"
    lower = phrase.lower()
    if lower.startswith(("a ", "an ", "the ")):
        return phrase[0].upper() + phrase[1:]
    first_word = lower.split()[0]
    if first_word in ARTICLELESS_SUBJECT_PREFIXES:
        return phrase[0].upper() + phrase[1:]
    article = "An" if first_word[:1] in {"a", "e", "i", "o", "u"} else "A"
    return f"{article} {phrase}"


def build_negative_prompt(pack: dict) -> str:
    parts = [
        "no official character likeness",
        "no logo",
        "no box art recreation",
        "no screenshot recreation",
        "no UI elements",
        "no sprite rip",
        "no direct copy of official costume or weapon design",
        "no franchise text",
        "no watermark",
    ]
    for note in pack["legal_watchouts"]:
        parts.append(note)
    for token in pack["risk_reasons"]:
        if token not in {"generic_atmosphere_safe", "bucket_sensitive_visual_identity"}:
            parts.append(f"avoid resemblance to {token}")
    return ", ".join(parts)


def priority_score(record: dict) -> int:
    rarity_bonus = {"COMMON": 0, "UNCOMMON": 10, "RARE": 25, "ULTRA RARE": 35, "LEGENDARY": 45}
    metascore = int(record.get("metascore") or 0)
    rarity = rarity_bonus.get(str(record.get("rarity") or "").upper(), 5)
    year = int(record.get("year") or 0)
    return metascore * 10 + rarity + max(0, year - 1980)


def normalize_games(catalog: list[dict], entries: dict) -> list[dict]:
    normalized = []
    for game in catalog:
        entry = entries.get(game["id"], {})
        genre_primary, genre_secondary = infer_genres(game, entry)
        bucket = infer_bucket(game["title"], genre_primary, genre_secondary)
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
            "bucket": bucket,
            "priority": priority_score(game),
        })
    return normalized


def classify_games(records: list[dict]) -> list[dict]:
    classified = []
    for record in records:
        style = choose_platform_style(record["platform"])
        risk_level, risk_reasons = infer_risk_level(record["title"], record["bucket"])
        direction = choose_direction(record["title"], record["bucket"])
        classified_record = dict(record)
        classified_record.update({
            "platform_style_id": style["style_id"],
            "platform_style_description": style["description"],
            "palette_hint": style["palette_hint"],
            "risk_level": risk_level,
            "risk_reasons": risk_reasons,
            "memory_rule_id": direction.get("rule_id", ""),
            "main_subject": direction["main_subject"],
            "environment": direction["environment"],
            "action_mood_cue": direction["action_mood_cue"],
            "mood": direction["mood"],
            "composition": direction["composition"],
            "memory_hook": direction["memory_hook"],
            "legal_watchouts": direction.get("legal_watchouts", []),
            "prompt_version": PROMPT_VERSION,
        })
        classified.append(classified_record)
    return classified


def build_prompt_pack(record: dict) -> dict:
    pack = dict(record)
    pack["prompt"] = MASTER_PROMPT.format(
        genre_primary=record["genre_primary"],
        subject_clause=build_subject_clause(record["main_subject"]),
        environment=record["environment"],
        action_mood_cue=record["action_mood_cue"],
        platform_style=record["platform_style_description"],
        mood=", ".join(record["mood"]),
        composition=record["composition"],
    ).strip()
    pack["negative_prompt"] = build_negative_prompt(record)
    pack["legal_notes"] = (
        f"Risk level: {record['risk_level']}. "
        "Use generic archetypes, avoid franchise-identifiable costume or symbol language, "
        "and preserve recognizability through atmosphere, scene memory, and gameplay cues only."
    )
    pack["generation_notes"] = {
        "format": "16:9 hero visual",
        "overlay_safe_side": "right",
        "preferred_render_mode": "pixel art illustration only",
        "detail_policy": "rich enough to feel desirable, simple enough to read fast",
        "render_policy": "always_pixel_art",
    }
    pack["status"] = "READY_FOR_REVIEW"
    return pack


def write_pack_files(pack_dir: Path, pack: dict):
    payload = {
        "game_id": pack["game_id"],
        "title": pack["title"],
        "platform": pack["platform"],
        "year": pack["year"],
        "genre_primary": pack["genre_primary"],
        "genre_secondary": pack["genre_secondary"],
        "bucket": pack["bucket"],
        "risk_level": pack["risk_level"],
        "risk_reasons": pack["risk_reasons"],
        "platform_style_id": pack["platform_style_id"],
        "platform_style_description": pack["platform_style_description"],
        "palette_hint": pack["palette_hint"],
        "memory_rule_id": pack.get("memory_rule_id", ""),
        "main_subject": pack["main_subject"],
        "environment": pack["environment"],
        "action_mood_cue": pack["action_mood_cue"],
        "mood": pack["mood"],
        "composition": pack["composition"],
        "memory_hook": pack["memory_hook"],
        "legal_watchouts": pack["legal_watchouts"],
        "legal_notes": pack["legal_notes"],
        "prompt_version": pack["prompt_version"],
        "prompt": pack["prompt"],
        "negative_prompt": pack["negative_prompt"],
        "generation_notes": pack["generation_notes"],
        "status": pack["status"],
    }
    write_json(pack_dir / f"{pack['slug']}.json", payload)
    markdown = [
        f"# {pack['title']}",
        "",
        f"- Game ID: `{pack['game_id']}`",
        f"- Platform: `{pack['platform']}`",
        f"- Year: `{pack['year']}`",
        f"- Genres: `{pack['genre_primary']}` / `{pack['genre_secondary']}`",
        f"- Bucket: `{pack['bucket']}`",
        f"- Risk level: `{pack['risk_level']}`",
        f"- Memory rule: `{pack.get('memory_rule_id') or 'bucket_fallback'}`",
        f"- Prompt version: `{pack['prompt_version']}`",
        "",
        "## Art Direction",
        "",
        f"- Memory hook: {pack['memory_hook']}",
        f"- Main subject: {pack['main_subject']}",
        f"- Environment: {pack['environment']}",
        f"- Action / mood cue: {pack['action_mood_cue']}",
        f"- Mood keywords: {', '.join(pack['mood'])}",
        f"- Composition: {pack['composition']}",
        f"- Platform style: {pack['platform_style_description']}",
        f"- Palette hint: {', '.join(pack['palette_hint'])}",
        "",
        "## Prompt",
        "",
        pack["prompt"],
        "",
        "## Negative Prompt",
        "",
        pack["negative_prompt"],
        "",
        "## Legal Notes",
        "",
        pack["legal_notes"],
        "",
        "## Review Checklist",
        "",
        "- Is the subject readable in under one second?",
        "- Does the scene evoke the franchise without copying it?",
        "- Does the platform identity come through in palette and rendering mood?",
        "- Would this work as a desirable GameDetail hero visual?",
        "- Is there any element too close to a protected design?",
        "",
    ]
    write_text(pack_dir / f"{pack['slug']}.md", "\n".join(markdown))


def write_review_queue(path: Path, packs: list[dict]):
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=[
            "game_id",
            "title",
            "platform",
            "risk_level",
            "status",
            "decision",
            "decision_reason",
            "reviewer_notes",
            "prompt_pack_json",
            "prompt_pack_md",
            "selected_for_generation",
        ])
        writer.writeheader()
        for pack in packs:
            writer.writerow({
                "game_id": pack["game_id"],
                "title": pack["title"],
                "platform": pack["platform"],
                "risk_level": pack["risk_level"],
                "status": "PENDING_REVIEW",
                "decision": "",
                "decision_reason": "",
                "reviewer_notes": "",
                "prompt_pack_json": f"packs/{pack['slug']}.json",
                "prompt_pack_md": f"packs/{pack['slug']}.md",
                "selected_for_generation": "",
            })


def write_review_instructions(path: Path):
    lines = [
        "# RetroDex Prompt Pack Review",
        "",
        "Decision values:",
        "- `APPROVED`: pack can be sent to image generation",
        "- `RETRY`: pack needs prompt refinement before generation",
        "- `REJECT`: pack direction is wrong and must be rebuilt",
        "",
        "Review criteria:",
        "- subject readable in under one second",
        "- franchise evocation without direct copying",
        "- platform identity visible",
        "- strong GameDetail hero potential",
        "- legal risk acceptable",
        "",
        "Workflow:",
        "1. Open the `.md` brief for the game",
        "2. Read the prompt and legal notes",
        "3. Set `decision` in `review_queue.csv`",
        "4. Add `decision_reason` and `reviewer_notes`",
        "5. Mark `selected_for_generation=yes` only for approved packs",
    ]
    write_text(path, "\n".join(lines) + "\n")


def write_summary(path: Path, context: dict):
    lines = [
        "# RetroDex Prompt Pack Batch Summary",
        "",
        f"- Run ID: `{context['run_id']}`",
        f"- Generated at: `{context['generated_at']}`",
        f"- Normalized games: `{context['normalized_count']}`",
        f"- Classified games: `{context['classified_count']}`",
        f"- Prompt packs created: `{context['pack_count']}`",
        f"- Output pack dir: `{context['pack_dir']}`",
        f"- Review queue: `{context['review_queue']}`",
        "",
        "## Batch games",
    ]
    for pack in context["packs"]:
        lines.append(f"- `{pack['game_id']}` | `{pack['title']}` | `{pack['platform']}` | risk `{pack['risk_level']}`")
    lines.extend([
        "",
        "## Notes",
        "- Local renderer is no longer part of the final art path.",
        "- These prompt packs are the new production handoff for external image generation and human review.",
    ])
    write_text(path, "\n".join(lines) + "\n")


def parse_args():
    parser = argparse.ArgumentParser(description="RetroDex production prompt-pack generator.")
    parser.add_argument("--batch-size", type=int, default=10, help="Number of prompt packs to generate.")
    parser.add_argument("--game-ids", type=str, default="", help="Comma-separated game ids to include.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    selected_ids = [value.strip() for value in args.game_ids.split(",") if value.strip()]

    run_id = next_unique_run_id(datetime.now(timezone.utc).strftime("prompt_pack_batch_%Y%m%dT%H%M%SZ"))
    log_dir = ensure_dir(LOG_ROOT / run_id)
    pack_dir = ensure_dir(PROMPT_PACK_ROOT / run_id / "packs")
    review_dir = ensure_dir(REVIEW_ROOT / run_id)

    catalog = read_json(DATA_DIR / "catalog.json")
    entries = read_json(DATA_DIR / "entries.json")

    normalized = normalize_games(catalog, entries)
    write_json(log_dir / "checkpoint_01_normalized_games.json", normalized)

    classified = classify_games(normalized)
    write_json(log_dir / "checkpoint_02_classification.json", classified)

    ordered = sorted(classified, key=lambda item: (-item["priority"], item["year"], item["title"]))
    if selected_ids:
        wanted = {value for value in selected_ids}
        ordered = [item for item in ordered if item["game_id"] in wanted]

    packs = [build_prompt_pack(item) for item in ordered[: args.batch_size]]
    write_json(log_dir / "checkpoint_03_prompt_packs.json", packs)

    for pack in packs:
        write_pack_files(pack_dir, pack)

    bundle_index = {
        "run_id": run_id,
        "prompt_version": PROMPT_VERSION,
        "pack_count": len(packs),
        "packs": [
            {
                "game_id": pack["game_id"],
                "title": pack["title"],
                "platform": pack["platform"],
                "risk_level": pack["risk_level"],
                "json_path": f"packs/{pack['slug']}.json",
                "md_path": f"packs/{pack['slug']}.md",
            }
            for pack in packs
        ],
    }
    write_json(log_dir / "checkpoint_04_pack_index.json", bundle_index)

    review_queue = review_dir / "review_queue.csv"
    write_review_queue(review_queue, packs)
    write_review_instructions(review_dir / "review_instructions.md")

    context = {
        "run_id": run_id,
        "generated_at": now_utc(),
        "normalized_count": len(normalized),
        "classified_count": len(classified),
        "pack_count": len(packs),
        "pack_dir": str(pack_dir.relative_to(ROOT)).replace("\\", "/"),
        "review_queue": str(review_queue.relative_to(ROOT)).replace("\\", "/"),
        "packs": packs,
    }
    write_summary(log_dir / "report_prompt_pack_summary.md", context)

    result = {
        "run_id": run_id,
        "pack_dir": context["pack_dir"],
        "review_dir": str(review_dir.relative_to(ROOT)).replace("\\", "/"),
        "log_dir": str(log_dir.relative_to(ROOT)).replace("\\", "/"),
        "pack_count": len(packs),
        "prompt_version": PROMPT_VERSION,
        "review_queue": context["review_queue"],
    }
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
