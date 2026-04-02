'use strict';

const fs = require('fs');
const path = require('path');

const {
  PROJECT_ROOT,
  RAW_DIR,
  ensureWorkspace,
  readJson,
  resolveLatestMatchingFile,
  utcDateStamp,
  writeJson,
} = require('./_shared');

function loadEncyclopediaSeedMap() {
  const filePath = path.join(PROJECT_ROOT, 'data', 'encyclopedia_seed.json');
  if (!fs.existsSync(filePath)) {
    return new Map();
  }

  const rows = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const index = new Map();
  rows.forEach((row) => {
    if (row?.id) {
      index.set(String(row.id), row);
    }
  });
  return index;
}

function resolveWikipediaCacheFile() {
  try {
    return resolveLatestMatchingFile(
      RAW_DIR,
      /^editorial_wikipedia_cache_\d{8}\.json$/,
      'editorial wikipedia cache'
    );
  } catch (error) {
    return null;
  }
}

function loadWikipediaCacheMap(filePath = resolveWikipediaCacheFile()) {
  if (!filePath || !fs.existsSync(filePath)) {
    return new Map();
  }

  const rows = readJson(filePath);
  const index = new Map();
  rows.forEach((row) => {
    if (row?.id) {
      index.set(String(row.id), row);
    }
  });
  return index;
}

function buildWikipediaCachePath(date = new Date()) {
  ensureWorkspace();
  return path.join(RAW_DIR, `editorial_wikipedia_cache_${utcDateStamp(date)}.json`);
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function deriveSummaryFromText(text, maxLength = 220) {
  const normalized = normalizeText(text);
  if (!normalized) {
    return null;
  }

  const sentenceMatch = normalized.match(/^(.{20,220}?[.!?])(?:\s|$)/);
  if (sentenceMatch) {
    return sentenceMatch[1].trim();
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const truncated = normalized.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return `${truncated.slice(0, lastSpace > 40 ? lastSpace : maxLength).trim()}.`;
}

function splitPossibleNames(segment) {
  return String(segment || '')
    .replace(/\([^)]*\)/g, '')
    .split(/\s*(?:,| and | & |\/)\s*/i)
    .map((value) => value.trim().replace(/^the\s+/i, ''))
    .filter(Boolean)
    .filter((value) => value.length >= 3 && value.length <= 60)
    .filter((value) => {
      const words = value.split(/\s+/);
      return words.length <= 6 && words.some((word) => /^[A-Z0-9]/.test(word));
    });
}

function extractComposerNamesFromText(text) {
  const normalized = normalizeText(text);
  if (!normalized) {
    return [];
  }

  const patterns = [
    /(?:soundtrack|score|music)[^.!?]{0,80}?composed by ([^.?!;:]+)/i,
    /music by ([^.?!;:]+)/i,
    /score by ([^.?!;:]+)/i,
    /composed by ([^.?!;:]+)/i,
  ];

  const results = new Set();
  patterns.forEach((pattern) => {
    const match = normalized.match(pattern);
    if (!match) {
      return;
    }
    splitPossibleNames(match[1]).forEach((name) => results.add(name));
  });

  return Array.from(results);
}

function parseIntegerArg(argv, key, defaultValue = 0) {
  const inline = argv.find((arg) => arg.startsWith(`${key}=`));
  if (inline) {
    return Number.parseInt(inline.slice(key.length + 1), 10) || defaultValue;
  }

  const index = argv.indexOf(key);
  if (index >= 0 && index < argv.length - 1) {
    return Number.parseInt(argv[index + 1], 10) || defaultValue;
  }

  return defaultValue;
}

async function wikiSearch(query) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query.replace(/ /g, '_'))}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'RetroDexPolish/1.0 (retrogaming data pipeline; read-only cache)',
    },
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  if (!payload?.extract || payload.extract.length < 80) {
    return null;
  }
  return payload;
}

function isVideoGameResult(payload, row) {
  if (!payload) {
    return false;
  }
  const description = String(payload.description || '').toLowerCase();
  const extract = String(payload.extract || '').toLowerCase();
  const year = row?.year ? String(row.year) : '';

  return (
    description.includes('video game')
    || description.includes('game')
    || extract.includes('video game')
    || (year && extract.includes(year))
  );
}

async function fetchWikipediaEditorialEntry(row) {
  const attempts = [
    `${row.title} (video game)`,
    row.year ? `${row.title} (${row.year} video game)` : null,
    row.console ? `${row.title} (${row.console} game)` : null,
    row.title,
  ].filter(Boolean);

  for (const query of attempts) {
    try {
      const payload = await wikiSearch(query);
      if (!payload || !isVideoGameResult(payload, row)) {
        continue;
      }

      const synopsis = normalizeText(String(payload.extract).slice(0, 1200));
      const summary = deriveSummaryFromText(payload.extract);
      return {
        id: row.id,
        title: row.title,
        pageTitle: payload.title || null,
        description: payload.description || null,
        wikiUrl: payload.content_urls?.desktop?.page || null,
        summary: summary || null,
        synopsis: synopsis || null,
        fetchedAt: new Date().toISOString(),
      };
    } catch (error) {
      continue;
    }
  }

  return null;
}

async function refreshWikipediaCache(rows, options = {}) {
  const {
    limit = 0,
    existing = loadWikipediaCacheMap(),
    sleepMs = 150,
  } = options;
  const cache = new Map(existing);
  const candidates = rows
    .filter((row) => {
      const cached = cache.get(row.id);
      return !(cached?.summary && cached?.synopsis);
    })
    .slice(0, limit > 0 ? limit : rows.length);

  let updated = 0;
  let misses = 0;

  for (const row of candidates) {
    const result = await fetchWikipediaEditorialEntry(row);
    if (result) {
      cache.set(row.id, result);
      updated += 1;
    } else {
      misses += 1;
    }

    if (sleepMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, sleepMs));
    }
  }

  const filePath = buildWikipediaCachePath(new Date());
  writeJson(
    filePath,
    Array.from(cache.values()).sort((left, right) => String(left.id).localeCompare(String(right.id)))
  );

  return {
    filePath,
    cache,
    attempted: candidates.length,
    updated,
    misses,
  };
}

module.exports = {
  deriveSummaryFromText,
  extractComposerNamesFromText,
  loadEncyclopediaSeedMap,
  loadWikipediaCacheMap,
  parseIntegerArg,
  refreshWikipediaCache,
  resolveWikipediaCacheFile,
};
