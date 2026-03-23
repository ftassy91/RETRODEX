'use strict';

const path = require('path');
const { sequelize, resolveSqlitePath } = require('../config/database');

const DRY_RUN = process.argv.includes('--dry-run');

const GENRE_NORMALIZATION = {
  'Action RPG': 'Action-RPG',
  'Action Adventure': 'Action-Adventure',
  'Action-Platform': 'Platformer',
  'Action Platformer': 'Platformer',
  'Action / Platformer': 'Platformer',
  'Beat em Up': "Beat'em up",
  "Beat'em Up": "Beat'em up",
  'Combat 2D': 'Fighting',
  'Fighting Game': 'Fighting',
  Platform: 'Platformer',
  'Platformer / Action': 'Platformer',
  'Puzzle / Aventure': 'Adventure',
  'Run & Gun': "Shoot'em up",
  'Run and Gun': "Shoot'em up",
  'Shoot em Up': "Shoot'em up",
  "Shoot'Em Up": "Shoot'em up",
  Sports: 'Sport',
  'Sport Game': 'Sport',
  'Strategy RPG': 'RPG Tactique',
  'Strategy Game': 'Strategy',
  'Survival Horr': 'Survival Horror',
  'Tactical RPG': 'RPG Tactique',
  'Turn-Based RPG': 'RPG',
  'Turn Based RPG': 'RPG',
};

const GENRE_RULES = [
  { genre: 'Sport', pattern: /\b(baseball|basketball|football|soccer|hockey|golf|tennis|volleyball|wrestling|boxing|snowboard|skate|olympic|fifa|madden|nba|nfl|nhl|mlb|pga|koshien)\b/i },
  { genre: 'Racing', pattern: /\b(racing|race|kart|driver|driving|drift|motocross|f-?zero|gran turismo|ridge racer|daytona|burnout|out run|top gear)\b/i },
  { genre: 'Fighting', pattern: /\b(fighter|fighting|fatal fury|street fighter|mortal kombat|tekken|virtua fighter|king of fighters|samurai shodown|dead or alive|battle arena toshinden)\b/i },
  { genre: 'Puzzle', pattern: /\b(tetris|puyo|columns|picross|panel|puzzle|bust-a-move|bubble bobble|qix|dr\.?\s*mario)\b/i },
  { genre: 'Simulation', pattern: /\b(harvest moon|sim city|simcity|a-train|theme park|theme hospital|pilotwings|airline|tycoon|simulator)\b/i },
  { genre: 'Strategy', pattern: /\b(wars|tactics|ogre|civilization|nobunaga|romance of the three kingdoms|empire|command|advance wars|fire emblem)\b/i },
  { genre: "Shoot'em up", pattern: /\b(aero fighters|raiden|ikaruga|r-type|gradius|darius|radiant silvergun|1942|1943|galaga|dodonpachi|parodius|shmup)\b/i },
  { genre: "Beat'em up", pattern: /\b(double dragon|final fight|streets of rage|golden axe|battletoads|teenage mutant ninja turtles|tmnt|river city|kunio|batman returns)\b/i },
  { genre: 'Survival Horror', pattern: /\b(resident evil|silent hill|alone in the dark|parasite eve|horror)\b/i },
  { genre: 'Metroidvania', pattern: /\b(castlevania|metroid)\b/i },
  { genre: 'Action-RPG', pattern: /\b(secret of mana|illusion of gaia|terranigma|ys|star ocean|alundra|beyond oasis)\b/i },
  { genre: 'RPG', pattern: /\b(rpg|quest|fantasy|mana|suikoden|dragon|breath of fire|phantasy star|chrono|xeno|wild arms|pokemon|persona|megami tensei|final fantasy|dragon quest|earthbound|mother|hack)\b/i },
  { genre: 'Adventure', pattern: /\b(adventure|myst|monkey island|shadowgate|snatcher|deja vu|phoenix wright|ace attorney|body harvest)\b/i },
  { genre: 'Platformer', pattern: /\b(mario|sonic|banjo|donkey kong|kirby|yoshi|rayman|gex|crash|rocket knight|earthworm jim|aero the acrobat|rocky|bullwinkle)\b/i },
];

const KNOWN_DEVELOPERS = [
  { developer: 'Rare Ltd.', pattern: /\b(banjo|diddy kong racing|goldeneye|blast corps|donkey kong 64|banjo-tooie|perfect dark|killer instinct)\b/i },
  { developer: 'Konami', pattern: /\b(castlevania|metal gear|contra|gradius|parodius|suikoden|dance dance revolution)\b/i },
  { developer: 'Capcom', pattern: /\b(mega man|resident evil|street fighter|breath of fire|final fight|ghosts n goblins|dino crisis)\b/i },
  { developer: 'Nintendo', pattern: /\b(mario|zelda|f-zero|1080|pilotwings|wave race|star fox|excitebike)\b/i },
  { developer: 'Sega', pattern: /\b(altered beast|burning rangers|space harrier|out run|after burner|panzer dragoon)\b/i },
  { developer: 'Intelligent Systems', pattern: /\b(advance wars|fire emblem)\b/i },
  { developer: 'Koei', pattern: /\b(aerobiz|romance of the three kingdoms|nobunaga)\b/i },
  { developer: 'Banpresto', pattern: /\b(super robot wars)\b/i },
  { developer: 'SNK', pattern: /\b(metal slug|fatal fury|samurai shodown|king of fighters|2020 super baseball)\b/i },
  { developer: 'Namco', pattern: /\b(ace combat|ridge racer|tekken|klonoa)\b/i },
  { developer: 'Treasure', pattern: /\b(ikaruga|astro boy|radiant silvergun|gunstar)\b/i },
  { developer: 'Marvelous Entertainment', pattern: /\b(harvest moon)\b/i },
];

const STOP_WORDS = new Set([
  'the', 'of', 'and', 'a', 'an', 'version', 'super', 'hyper', 'deluxe',
]);

function normalizeText(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/['`]/g, '')
    .toLowerCase();
}

function slugifyValue(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

function buildSlug(title, consoleName, usedSlugs) {
  const base = slugifyValue(`${title}-${consoleName}`) || slugifyValue(title) || 'game';
  let candidate = base;
  let suffix = 2;

  while (usedSlugs.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  usedSlugs.add(candidate);
  return candidate;
}

function deriveSeriesKey(title) {
  let normalized = normalizeText(title)
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b\d+(st|nd|rd|th)\b/g, ' ')
    .replace(/\b[ivxlcdm]+\b/g, ' ');

  normalized = normalized.split(':')[0].split('-')[0];

  let tokens = normalized
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .filter((token) => !STOP_WORDS.has(token));

  while (tokens.length && /^\d+$/.test(tokens[0])) {
    tokens.shift();
  }

  while (tokens.length && /^\d+$/.test(tokens[tokens.length - 1])) {
    tokens.pop();
  }

  return tokens.slice(0, 3).join(' ');
}

function inferGenre(game) {
  const normalizedGenre = GENRE_NORMALIZATION[game.genre] || null;
  if (normalizedGenre) {
    return normalizedGenre;
  }

  if (game.genre && game.genre !== 'Other') {
    return game.genre;
  }

  for (const rule of GENRE_RULES) {
    if (rule.pattern.test(game.title || '')) {
      return rule.genre;
    }
  }

  return 'Action';
}

function inferDeveloper(game, developerByFranchise, developerBySeries) {
  if (game.developer && String(game.developer).trim()) {
    return game.developer;
  }

  for (const rule of KNOWN_DEVELOPERS) {
    if (rule.pattern.test(game.title || '')) {
      return rule.developer;
    }
  }

  const franchiseDeveloper = game.franch_id ? developerByFranchise.get(game.franch_id) : null;
  if (franchiseDeveloper) {
    return franchiseDeveloper;
  }

  const seriesKey = deriveSeriesKey(game.title);
  if (!seriesKey) {
    return null;
  }

  const seriesDeveloper = developerBySeries.get(seriesKey);
  return seriesDeveloper || null;
}

function inferRarity(game) {
  const prices = [game.loose_price, game.cib_price, game.mint_price]
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!prices.length) {
    return game.rarity || 'COMMON';
  }

  const maxPrice = Math.max(...prices);
  if (maxPrice >= 500) return 'LEGENDARY';
  if (maxPrice >= 200) return 'EPIC';
  if (maxPrice >= 80) return 'RARE';
  if (maxPrice >= 25) return 'UNCOMMON';
  return 'COMMON';
}

function inferConfidence(game, nextValues) {
  let score = 0.4;

  if (nextValues.genre && nextValues.genre !== 'Other') score += 0.1;
  if (nextValues.developer) score += 0.1;
  if (game.synopsis || game.summary) score += 0.15;
  if (game.tagline) score += 0.05;
  if (game.metascore != null) score += 0.1;
  if (game.cover_url) score += 0.05;
  if ([game.loose_price, game.cib_price, game.mint_price].some((value) => Number(value) > 0)) score += 0.1;

  return Math.min(0.95, Math.round(score * 100) / 100);
}

function addFrequency(map, key, value) {
  if (!key || !value) {
    return;
  }

  const bucket = map.get(key) || new Map();
  bucket.set(value, (bucket.get(value) || 0) + 1);
  map.set(key, bucket);
}

function mostFrequent(bucket) {
  if (!bucket || bucket.size === 0) {
    return null;
  }

  return [...bucket.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'fr', { sensitivity: 'base' }))
    .map(([value]) => value)[0] || null;
}

async function loadGames() {
  const [rows] = await sequelize.query(`
    SELECT
      id,
      title,
      console,
      year,
      genre,
      developer,
      rarity,
      slug,
      source_confidence,
      summary,
      synopsis,
      tagline,
      metascore,
      cover_url,
      franch_id,
      loose_price,
      cib_price,
      mint_price
    FROM games
    WHERE type = 'game'
    ORDER BY title ASC
  `);

  return rows;
}

async function applyUpdates(updates) {
  if (!updates.length || DRY_RUN) {
    return;
  }

  await sequelize.transaction(async (transaction) => {
    for (const update of updates) {
      const fields = [];
      const replacements = { id: update.id };

      for (const [key, value] of Object.entries(update.fields)) {
        fields.push(`${key} = :${key}`);
        replacements[key] = value;
      }

      await sequelize.query(
        `UPDATE games SET ${fields.join(', ')} WHERE id = :id`,
        { replacements, transaction }
      );
    }
  });
}

async function main() {
  if (sequelize.getDialect() !== 'sqlite') {
    throw new Error('fix_local_data.js targets SQLite local only.');
  }

  const games = await loadGames();
  const usedSlugs = new Set(
    games
      .map((game) => String(game.slug || '').trim())
      .filter(Boolean)
  );

  const developerByFranchiseBuckets = new Map();
  const developerBySeriesBuckets = new Map();

  for (const game of games) {
    const developer = String(game.developer || '').trim();
    if (!developer) continue;
    addFrequency(developerBySeriesBuckets, deriveSeriesKey(game.title), developer);
    addFrequency(developerByFranchiseBuckets, game.franch_id, developer);
  }

  const developerByFranchise = new Map(
    [...developerByFranchiseBuckets.entries()].map(([key, bucket]) => [key, mostFrequent(bucket)])
  );
  const developerBySeries = new Map(
    [...developerBySeriesBuckets.entries()].map(([key, bucket]) => [key, mostFrequent(bucket)])
  );

  const updates = [];
  const counters = {
    genresFixed: 0,
    slugsGenerated: 0,
    developersInferred: 0,
    raritiesUpdated: 0,
    confidenceUpdated: 0,
  };

  for (const game of games) {
    const nextGenre = inferGenre(game);
    const nextDeveloper = inferDeveloper(game, developerByFranchise, developerBySeries);
    const nextRarity = inferRarity(game);
    const nextSlug = String(game.slug || '').trim() ? game.slug : buildSlug(game.title, game.console, usedSlugs);
    const nextConfidence = inferConfidence(game, {
      genre: nextGenre,
      developer: nextDeveloper,
    });

    const fields = {};

    if ((game.genre || null) !== nextGenre) {
      fields.genre = nextGenre;
      counters.genresFixed += 1;
    }

    if (!(game.slug && String(game.slug).trim())) {
      fields.slug = nextSlug;
      counters.slugsGenerated += 1;
    }

    if (!(game.developer && String(game.developer).trim()) && nextDeveloper) {
      fields.developer = nextDeveloper;
      counters.developersInferred += 1;
    }

    if ((game.rarity || null) !== nextRarity) {
      fields.rarity = nextRarity;
      counters.raritiesUpdated += 1;
    }

    if (Object.keys(fields).length > 0) {
      const currentConfidence = Number(game.source_confidence);
      if (!Number.isFinite(currentConfidence) || Math.abs(currentConfidence - nextConfidence) >= 0.01) {
        fields.source_confidence = nextConfidence;
        counters.confidenceUpdated += 1;
      }
      updates.push({ id: game.id, fields });
    }
  }

  console.log(`RetroDex - local SQLite data fixer`);
  console.log(`DB: ${resolveSqlitePath()}`);
  console.log(`Games scanned: ${games.length}`);
  if (DRY_RUN) {
    console.log('[DRY RUN] No writes');
  }
  console.log(`Planned updates: ${updates.length}`);
  console.log(`  genres fixed: ${counters.genresFixed}`);
  console.log(`  slugs generated: ${counters.slugsGenerated}`);
  console.log(`  developers inferred: ${counters.developersInferred}`);
  console.log(`  rarities updated: ${counters.raritiesUpdated}`);
  console.log(`  confidence updated: ${counters.confidenceUpdated}`);

  if (DRY_RUN) {
    updates.slice(0, 10).forEach((update) => {
      console.log(`  [DRY] ${update.id} -> ${JSON.stringify(update.fields)}`);
    });
  }

  await applyUpdates(updates);

  const [summaryRows] = await sequelize.query(`
    SELECT
      SUM(CASE WHEN genre = 'Other' OR genre IS NULL OR TRIM(genre) = '' THEN 1 ELSE 0 END) AS other_count,
      SUM(CASE WHEN slug IS NULL OR TRIM(slug) = '' THEN 1 ELSE 0 END) AS missing_slug_count,
      SUM(CASE WHEN developer IS NULL OR TRIM(developer) = '' THEN 1 ELSE 0 END) AS missing_developer_count
    FROM games
    WHERE type = 'game'
  `);

  const summary = summaryRows[0] || {};
  console.log(`Remaining Other: ${summary.other_count || 0}`);
  console.log(`Remaining missing slugs: ${summary.missing_slug_count || 0}`);
  console.log(`Remaining missing developers: ${summary.missing_developer_count || 0}`);
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close().catch(() => {});
  });
