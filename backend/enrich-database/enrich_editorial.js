'use strict';
/**
 * scripts/enrich/enrich_editorial.js
 * ══════════════════════════════════════════════════════════════
 * Enrichissement éditorial complet via Anthropic Claude.
 *
 * Génère pour chaque jeu :
 *   - synopsis (texte encyclopédique EN 150-300 mots)
 *   - summary (accroche 1-2 phrases)
 *   - tagline (accroche collector FR max 120 chars)
 *   - dev_anecdotes (3 anecdotes JSON)
 *   - dev_team (équipe JSON)
 *   - cheat_codes (codes JSON)
 *
 * Usage :
 *   node scripts/enrich/enrich_editorial.js --field synopsis --limit 50
 *   node scripts/enrich/enrich_editorial.js --field tagline --limit 200
 *   node scripts/enrich/enrich_editorial.js --field anecdotes --limit 30
 *   node scripts/enrich/enrich_editorial.js --field cheat_codes --limit 50
 *   node scripts/enrich/enrich_editorial.js --field all --limit 10
 *   node scripts/enrich/enrich_editorial.js --game panzer-dragoon-saga-sega-saturn
 *   node scripts/enrich/enrich_editorial.js --rarity LEGENDARY,EPIC --field all
 *
 * Prérequis : ANTHROPIC_API_KEY dans backend/.env
 */

require('./bootstrap');

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('✗ ANTHROPIC_API_KEY manquant dans backend/.env');
  process.exit(1);
}

const { db, supabase, USE_SUPABASE } = require('./bootstrap');

const args    = process.argv.slice(2);
const DRY     = args.includes('--dry-run');
const FIELD   = args.includes('--field')   ? args[args.indexOf('--field')+1]   : 'synopsis';
const LIMIT   = args.includes('--limit')   ? parseInt(args[args.indexOf('--limit')+1]) : 20;
const GAME_ID = args.includes('--game')    ? args[args.indexOf('--game')+1]    : null;
const RARITY  = args.includes('--rarity')  ? args[args.indexOf('--rarity')+1].split(',') : null;
const sleep   = ms => new Promise(r => setTimeout(r, ms));

// ── Anthropic ──────────────────────────────────────────────────────────────
async function claude(prompt, maxTokens = 500) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  return (await res.json()).content[0].text.trim();
}

// ── Prompts ────────────────────────────────────────────────────────────────
const P = {
  synopsis: g => `You are an encyclopedic retrogaming journalist.
Write a Wikipedia-style synopsis for "${g.title}" (${g.console}, ${g.year}).
Developer: ${g.developer||'unknown'}. Genre: ${g.genre||'unknown'}. Metascore: ${g.metascore||'N/A'}.

Rules:
- 150-280 words
- Describe: game concept, gameplay mechanics, historical context, legacy
- Factual and encyclopedic tone — no hype, no spoilers
- If you are not 100% sure about facts, stay vague rather than inventing
- No title header, just the paragraph text
- End with its place in retrogaming history`,

  summary: g => `Write a 1-2 sentence collector summary for the retro game "${g.title}" (${g.console}, ${g.year}).
Highlight what makes it notable or rare. 30-60 words. No title. Just the text.`,

  tagline: g => `Write a French collector tagline for "${g.title}" (${g.console}, ${g.year}).
Rules: max 120 chars, must end with . ! or ?, collector/retrogaming tone, highlight rarity or appeal.
Reply ONLY with the tagline text, no quotes, no tags.`,

  anecdotes: g => `You are a retrogaming historian. For "${g.title}" (${g.console}, ${g.year}, developer: ${g.developer||'unknown'}),
generate 3 development anecdotes in JSON. If you don't know real anecdotes, create plausible ones based on the era/hardware context.

Reply ONLY with this JSON (no markdown, no explanation):
[
  {"title": "Short title 1", "text": "80-120 word anecdote."},
  {"title": "Short title 2", "text": "80-120 word anecdote."},
  {"title": "Short title 3", "text": "80-120 word anecdote."}
]`,

  dev_team: g => `For "${g.title}" (${g.console}, ${g.year}, developer: ${g.developer||'unknown'}),
list known development team members in JSON. Only include people you are confident about.

Reply ONLY with JSON (no markdown):
[{"role": "Director", "name": "Name or null"}, {"role": "Producer", "name": "..."}, {"role": "Composer", "name": "..."}, {"role": "Lead Programmer", "name": "..."}]
Return [] if unknown.`,

  cheat_codes: g => `List cheat codes, passwords, and easter eggs for "${g.title}" (${g.console}, ${g.year}).
Include: cheat codes, level select, debug modes, unlockables, secrets.

Reply ONLY with JSON (no markdown):
[{"name": "Code name", "code": "Button sequence or password", "effect": "What it does"}]
Return [] if none known.`,
};

// ── JSON parser ────────────────────────────────────────────────────────────
function parseJSON(text) {
  try {
    return JSON.parse(text.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim());
  } catch { return null; }
}

// ── Validators ─────────────────────────────────────────────────────────────
const V = {
  synopsis:    t => t && t.length >= 100,
  summary:     t => t && t.length >= 20 && t.length <= 300,
  tagline:     t => t && t.length <= 120 && /[.!?]$/.test(t) && t.length >= 15,
  anecdotes:   t => Array.isArray(t) && t.length > 0 && t[0].title && t[0].text,
  dev_team:    t => Array.isArray(t),
  cheat_codes: t => Array.isArray(t),
};

// ── DB helpers ─────────────────────────────────────────────────────────────
async function getGames() {
  if (GAME_ID) {
    if (USE_SUPABASE) {
      const { data } = await supabase.from('games').select('*').eq('id', GAME_ID).single();
      return data ? [data] : [];
    }
    return db.prepare('SELECT * FROM games WHERE id=?').all(GAME_ID);
  }

  const fieldMap = {
    synopsis:    'synopsis IS NULL',
    tagline:     'tagline IS NULL',
    anecdotes:   'dev_anecdotes IS NULL',
    dev_team:    'dev_team IS NULL',
    cheat_codes: 'cheat_codes IS NULL',
    all:         'synopsis IS NULL',
  };
  const cond = fieldMap[FIELD] || 'synopsis IS NULL';

  if (USE_SUPABASE) {
    let q = supabase.from('games').select('*').eq('type','game');
    if (RARITY) q = q.in('rarity', RARITY);
    const { data } = await q.limit(LIMIT);
    return (data || []).filter(g => {
      if (FIELD === 'synopsis')    return !g.synopsis;
      if (FIELD === 'tagline')     return !g.tagline;
      if (FIELD === 'anecdotes')   return !g.dev_anecdotes;
      if (FIELD === 'dev_team')    return !g.dev_team;
      if (FIELD === 'cheat_codes') return !g.cheat_codes;
      return !g.synopsis;
    });
  }

  const rarityClause = RARITY ? `AND rarity IN (${RARITY.map(()=>'?').join(',')})` : '';
  return db.prepare(`SELECT * FROM games WHERE type='game' AND ${cond} ${rarityClause} LIMIT ?`)
    .all(...(RARITY || []), LIMIT);
}

async function saveField(id, field, value) {
  if (DRY) { console.log(`  [DRY] ${field}: ${JSON.stringify(value).slice(0,60)}`); return; }
  const v = typeof value === 'object' ? JSON.stringify(value) : value;
  if (USE_SUPABASE) await supabase.from('games').update({ [field]: v }).eq('id', id);
  else db.prepare(`UPDATE games SET ${field}=? WHERE id=?`).run(v, id);
}

// ── Process one game ───────────────────────────────────────────────────────
async function processGame(game, fields) {
  const results = {};
  for (const f of fields) {
    try {
      const isJson = ['anecdotes','dev_team','cheat_codes'].includes(f);
      const promptFn = P[f === 'anecdotes' ? 'anecdotes' : f];
      if (!promptFn) continue;

      const raw = await claude(promptFn(game), f === 'synopsis' ? 600 : 400);
      const value = isJson ? parseJSON(raw) : raw;

      const dbField = {
        synopsis: 'synopsis', summary: 'summary', tagline: 'tagline',
        anecdotes: 'dev_anecdotes', dev_team: 'dev_team', cheat_codes: 'cheat_codes',
      }[f];

      if (V[f](value)) {
        await saveField(game.id, dbField, value);
        results[f] = '✓';
      } else {
        results[f] = '✗ validation';
      }
    } catch (e) {
      results[f] = `✗ ${e.message.slice(0,40)}`;
    }
    await sleep(500);
  }
  return results;
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const games = await getGames();
  const fields = FIELD === 'all'
    ? ['synopsis','summary','tagline','anecdotes','dev_team','cheat_codes']
    : [FIELD];

  console.log(`\nRetroDex — Editorial enrichment (${fields.join(', ')})`);
  console.log(`${games.length} games · model: claude-sonnet-4-20250514`);
  if (DRY) console.log('[DRY RUN]');

  let ok = 0, fail = 0;
  for (const g of games) {
    console.log(`\n→ ${g.title} (${g.console} ${g.year})`);
    const res = await processGame(g, fields);
    Object.entries(res).forEach(([f,r]) => {
      if (r === '✓') ok++; else fail++;
      console.log(`  ${f}: ${r}`);
    });
    await sleep(300);
  }
  console.log(`\n✅ ${ok} written · ${fail} failed`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
