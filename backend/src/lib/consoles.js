const fs = require('fs');
const path = require('path');

const CONSOLES_DATA_PATH = path.resolve(__dirname, '../../../data/consoles.json');

let consolesCache = null;
let aliasesCache = null;

function normalizeConsoleKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .trim();
}

function loadConsolesData() {
  if (!consolesCache) {
    const raw = fs.readFileSync(CONSOLES_DATA_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    consolesCache = Array.isArray(parsed) ? parsed : [];
  }

  return consolesCache;
}

function buildAliases(entry) {
  const aliases = new Set([
    entry.id,
    entry.name,
    `${entry.manufacturer || ''} ${entry.name || ''}`,
  ]);

  if (entry.name === 'Super Nintendo') {
    aliases.add('SNES');
    aliases.add('Super Nintendo Entertainment System');
  }

  if (entry.name === 'Nintendo Entertainment System') {
    aliases.add('NES');
    aliases.add('Famicom');
  }

  if (entry.name === 'Sega Genesis') {
    aliases.add('Mega Drive');
    aliases.add('Sega Mega Drive');
  }

  if (entry.name === 'PlayStation') {
    aliases.add('PS1');
    aliases.add('PSX');
    aliases.add('Sony PlayStation');
  }

  if (entry.name === 'Game Boy') {
    aliases.add('GB');
  }

  if (entry.name === 'Game Boy Advance') {
    aliases.add('GBA');
  }

  if (entry.name === 'Nintendo 64') {
    aliases.add('N64');
  }

  if (entry.name === 'TurboGrafx-16') {
    aliases.add('PC Engine');
  }

  if (entry.name === 'Neo Geo') {
    aliases.add('Neo-Geo');
  }

  return Array.from(aliases)
    .map((alias) => normalizeConsoleKey(alias))
    .filter(Boolean);
}

function getAliasesIndex() {
  if (!aliasesCache) {
    aliasesCache = new Map();
    for (const entry of loadConsolesData()) {
      for (const alias of buildAliases(entry)) {
        if (!aliasesCache.has(alias)) {
          aliasesCache.set(alias, entry);
        }
      }
    }
  }

  return aliasesCache;
}

function listConsoles() {
  return loadConsolesData();
}

function getConsoleById(id) {
  const key = normalizeConsoleKey(id);
  if (!key) return null;
  return getAliasesIndex().get(key) || null;
}

function getRelatedConsoles(entry, limit = 4) {
  if (!entry) return [];

  return loadConsolesData()
    .filter((candidate) => candidate.id !== entry.id)
    .filter(
      (candidate) =>
        candidate.manufacturer === entry.manufacturer ||
        candidate.generation === entry.generation,
    )
    .sort((left, right) => {
      const sameMaker = Number(right.manufacturer === entry.manufacturer) - Number(left.manufacturer === entry.manufacturer);
      if (sameMaker !== 0) return sameMaker;
      return Number(left.release_year || 0) - Number(right.release_year || 0);
    })
    .slice(0, limit);
}

module.exports = {
  getConsoleById,
  getRelatedConsoles,
  listConsoles,
  normalizeConsoleKey,
};
