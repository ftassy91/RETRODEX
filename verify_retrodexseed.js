/**
 * RETRODEX — Script de vérification structure RETRODEXseed
 * Vérification des 4 points : A (dossiers), B (docs), C (scripts), D (checkpoint)
 * Lancement : node verify_retrodexseed.js
 */

const fs = require('fs');
const path = require('path');

const BASE = path.join(
  'C:\\Users\\ftass\\OneDrive\\Bureau\\RETRODEXseed'
);

const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE   = '\x1b[34m';
const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';

function exists(p)    { try { return fs.existsSync(p); } catch { return false; } }
function isDir(p)     { try { return fs.statSync(p).isDirectory(); } catch { return false; } }
function isFile(p)    { try { return fs.statSync(p).isFile(); } catch { return false; } }
function listDir(p)   { try { return fs.readdirSync(p); } catch { return []; } }

function ok(label)    { console.log(`  ${GREEN}✅ OK${RESET}    ${label}`); }
function fail(label)  { console.log(`  ${RED}❌ MANQUE${RESET} ${label}`); }
function info(label)  { console.log(`  ${YELLOW}ℹ️  INFO${RESET}  ${label}`); }

let totalOk = 0;
let totalFail = 0;

function check(condition, label, detail) {
  if (condition) {
    ok(label);
    totalOk++;
  } else {
    fail(label + (detail ? `  →  ${detail}` : ''));
    totalFail++;
  }
}

console.log();
console.log(`${BOLD}${BLUE}════════════════════════════════════════════${RESET}`);
console.log(`${BOLD}  RETRODEX — Vérification RETRODEXseed${RESET}`);
console.log(`${BOLD}${BLUE}════════════════════════════════════════════${RESET}`);
console.log(`  Base : ${BASE}`);
console.log();

// ──────────────────────────────────────────────
// A — STRUCTURE DES DOSSIERS
// ──────────────────────────────────────────────
console.log(`${BOLD}A — Structure des dossiers${RESET}`);

check(isDir(BASE),                            'RETRODEXseed/ existe',            'Créer le dossier manuellement');
check(isDir(path.join(BASE, 'assets')),       'assets/',                         'mkdir assets');
check(isDir(path.join(BASE, 'data')),         'data/',                            'mkdir data');
check(isDir(path.join(BASE, 'docs')),         'docs/',                            'mkdir docs');
check(isDir(path.join(BASE, 'scripts')),      'scripts/',                         'mkdir scripts');
check(isDir(path.join(BASE, 'logs')),         'logs/',                            'mkdir logs');
check(isDir(path.join(BASE, 'logs','audit')), 'logs/audit/',                     'mkdir logs\\audit');
check(isDir(path.join(BASE, 'logs','checkpoints')), 'logs/checkpoints/',         'mkdir logs\\checkpoints');

console.log();

// ──────────────────────────────────────────────
// B — DOCUMENTATION
// ──────────────────────────────────────────────
console.log(`${BOLD}B — Documentation${RESET}`);

const readme   = path.join(BASE, 'README.md');
const overview = path.join(BASE, 'docs', 'project_overview.md');
const workflow = path.join(BASE, 'docs', 'development_workflow.md');

check(isFile(readme),   'README.md',                    'Créer README.md à la racine');
check(isFile(overview), 'docs/project_overview.md',     'Créer docs/project_overview.md');
check(isFile(workflow), 'docs/development_workflow.md', 'Créer docs/development_workflow.md');

// Vérification du contenu si les fichiers existent
if (isFile(readme)) {
  const content = fs.readFileSync(readme, 'utf8');
  check(content.length > 100, 'README.md non vide (>100 chars)', 'Ajouter le contenu');
}
if (isFile(overview)) {
  const content = fs.readFileSync(overview, 'utf8');
  check(content.length > 100, 'project_overview.md non vide', 'Ajouter le contenu');
}
if (isFile(workflow)) {
  const content = fs.readFileSync(workflow, 'utf8');
  check(content.length > 100, 'development_workflow.md non vide', 'Ajouter le contenu');
}

console.log();

// ──────────────────────────────────────────────
// C — SCRIPTS
// ──────────────────────────────────────────────
console.log(`${BOLD}C — Scripts${RESET}`);

check(isDir(path.join(BASE, 'scripts', 'audit')),  'scripts/audit/',  'mkdir scripts\\audit');
check(isDir(path.join(BASE, 'scripts', 'import')), 'scripts/import/', 'mkdir scripts\\import');
check(isDir(path.join(BASE, 'scripts', 'sync')),   'scripts/sync/',   'mkdir scripts\\sync');

// Lister les scripts existants
const scriptsRoot = path.join(BASE, 'scripts');
if (isDir(scriptsRoot)) {
  const files = listDir(scriptsRoot).filter(f => f.endsWith('.js') || f.endsWith('.py'));
  if (files.length > 0) {
    info(`Scripts trouvés à la racine : ${files.join(', ')}`);
  } else {
    info('Aucun script .js/.py à la racine de scripts/');
  }
}

console.log();

// ──────────────────────────────────────────────
// D — CHECKPOINT
// ──────────────────────────────────────────────
console.log(`${BOLD}D — Checkpoint${RESET}`);

const checkpointsDir = path.join(BASE, 'logs', 'checkpoints');

if (isDir(checkpointsDir)) {
  const files = listDir(checkpointsDir);
  const checkpoints = files.filter(f => 
    f.endsWith('.json') || f.endsWith('.md') || f.endsWith('.txt')
  );

  check(checkpoints.length > 0, `Au moins 1 checkpoint dans logs/checkpoints/`,
    'Créer un fichier JSON avec timestamp, action, files_modified, next_step');

  if (checkpoints.length > 0) {
    info(`${checkpoints.length} checkpoint(s) trouvé(s) : ${checkpoints.slice(0,3).join(', ')}`);

    // Vérifier le contenu du dernier checkpoint
    const latest = checkpoints.sort().pop();
    const cpPath = path.join(checkpointsDir, latest);
    try {
      const raw = fs.readFileSync(cpPath, 'utf8');
      let cp;
      try { cp = JSON.parse(raw); } catch { cp = null; }

      if (cp) {
        const hasTimestamp = 'timestamp' in cp || 'date' in cp;
        const hasAction    = 'action' in cp;
        const hasFiles     = 'files_modified' in cp || 'files' in cp;
        const hasNext      = 'next_step' in cp || 'nextStep' in cp || 'next' in cp;

        check(hasTimestamp, `  [${latest}] champ timestamp`,   'Ajouter "timestamp": "..."');
        check(hasAction,    `  [${latest}] champ action`,      'Ajouter "action": "..."');
        check(hasFiles,     `  [${latest}] champ files_modified`, 'Ajouter "files_modified": [...]');
        check(hasNext,      `  [${latest}] champ next_step`,   'Ajouter "next_step": "..."');
      } else {
        info(`${latest} : fichier non-JSON (contenu texte)`);
        check(raw.length > 50, `  [${latest}] contenu non vide`, 'Ajouter du contenu structuré');
      }
    } catch (e) {
      fail(`Impossible de lire ${latest} : ${e.message}`);
    }
  }
} else {
  fail('logs/checkpoints/ manquant — créer le dossier d\'abord');
  totalFail++;
}

// ──────────────────────────────────────────────
// RÉSUMÉ
// ──────────────────────────────────────────────
console.log();
console.log(`${BOLD}${BLUE}════════════════════════════════════════════${RESET}`);
const total = totalOk + totalFail;
const pct   = total > 0 ? Math.round(totalOk / total * 100) : 0;

if (totalFail === 0) {
  console.log(`${BOLD}${GREEN}  ✅ TOUT OK — ${totalOk}/${total} vérifications passées (${pct}%)${RESET}`);
} else {
  console.log(`${BOLD}  Score : ${totalOk}/${total} (${pct}%)${RESET}`);
  console.log(`${RED}  ${totalFail} élément(s) manquant(s)${RESET}`);
  console.log();
  console.log(`${YELLOW}  → Pour créer les dossiers manquants, copie-colle ceci :${RESET}`);
  console.log(`     cd "C:\\Users\\ftass\\OneDrive\\Bureau\\RETRODEXseed"`);
  console.log(`     mkdir assets data docs scripts logs`);
  console.log(`     mkdir logs\\audit logs\\checkpoints`);
  console.log(`     mkdir scripts\\audit scripts\\import scripts\\sync`);
}
console.log(`${BOLD}${BLUE}════════════════════════════════════════════${RESET}`);
console.log();
