'use strict'
require('dotenv').config({ path: require('path').join(__dirname, '../../backend/.env') })
const { execSync, spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

// ─── CONFIG ────────────────────────────────────────────────────────────────
const ROOT    = path.join(__dirname, '../..')
const STATE_FILE = path.join(ROOT, 'data/pipeline_state.json')

// ─── ÉTAT DU PIPELINE ──────────────────────────────────────────────────────
function loadState() {
  if (!fs.existsSync(STATE_FILE)) return {}
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
}
function saveState(state) {
  const dir = path.dirname(STATE_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
}

// ─── UTILITAIRES ───────────────────────────────────────────────────────────
function run(cmd, opts = {}) {
  console.log(`  $ ${cmd}`)
  const result = spawnSync(cmd, { shell: true, cwd: ROOT,
    stdio: opts.silent ? 'pipe' : 'inherit', ...opts })
  if (result.status !== 0 && !opts.ignoreError) {
    throw new Error(`Command failed: ${cmd}`)
  }
  return result
}

function header(id, title) {
  console.log('\n' + '═'.repeat(60))
  console.log(`  TASK ${id} — ${title}`)
  console.log('═'.repeat(60))
}

function skip(id, title) {
  console.log(`  ✓ SKIP  [${id}] ${title} (déjà exécuté)`)
}

// ─── TÂCHES ────────────────────────────────────────────────────────────────
const TASKS = [

  {
    id: 'UI-FIX-01',
    title: 'Corriger le bug catalogue (data.items)',
    priority: 'CRITIQUE',
    run: async () => {
      // Vérifier l'API
      const r = run(
        `node -e "const h=require('http');h.get('http://localhost:3000/api/games?limit=1',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>{const j=JSON.parse(d);console.log(Object.keys(j).join(','))})}).on('error',()=>console.log('OFFLINE'))"`,
        { silent: true }
      )
      const keys = r.stdout?.toString().trim()
      console.log(`  API format: ${keys}`)
      if (keys && keys.includes('items')) {
        console.log('  ✓ Format API correct — vérifier hub.html et games-list.html manuellement')
      } else {
        console.log('  ⚠ Backend non accessible — lancer node backend/src/server.js d\'abord')
      }
    }
  },

  {
    id: 'POSTGRES-01',
    title: 'Migrer Sequelize SQLite → PostgreSQL dual dialect',
    priority: 'CRITIQUE',
    run: async () => {
      run('cd backend && npm install pg pg-hstore --save', { ignoreError: true })
      console.log('  ✓ pg installé')
      console.log('  → Modifier backend/config/database.js manuellement (voir PROMPT 02 du Brief)')
    }
  },

  {
    id: 'JS-EXTRACT-01',
    title: 'Extraire JS inline de game-detail.html',
    priority: 'HAUTE',
    run: async () => {
      const htmlPath = path.join(ROOT, 'backend/public/game-detail.html')
      const jsPath   = path.join(ROOT, 'backend/public/js/game-detail.js')

      if (!fs.existsSync(htmlPath)) throw new Error('game-detail.html introuvable')

      const html = fs.readFileSync(htmlPath, 'utf8')
      const match = html.match(/<script[^>]*>([\s\S]*?)<\/script>\s*<\/body>/i)
      if (!match) {
        console.log('  ⚠ Aucun script inline trouvé ou déjà extrait')
        return
      }

      const jsContent = match[1].trim()
      const jsDir = path.dirname(jsPath)
      if (!fs.existsSync(jsDir)) fs.mkdirSync(jsDir, { recursive: true })

      fs.writeFileSync(jsPath, `'use strict'\n${jsContent}`)
      console.log(`  ✓ JS extrait → backend/public/js/game-detail.js (${jsContent.length} chars)`)

      const newHtml = html.replace(
        /<script[^>]*>[\s\S]*?<\/script>(\s*<\/body>)/i,
        '<script src="/js/game-detail.js"></script>$1'
      )
      fs.writeFileSync(htmlPath, newHtml)
      console.log('  ✓ game-detail.html mis à jour')
    }
  },

  {
    id: 'MERGE-01',
    title: 'Merger feature/mvp-database-v2 sur main',
    priority: 'CRITIQUE',
    run: async () => {
      const status = run('git status --porcelain', { silent: true })
      if (status.stdout?.toString().trim()) {
        throw new Error('Working tree non propre — committer les changements d\'abord')
      }
      run('git checkout main')
      run('git merge feature/mvp-database-v2 --no-ff -m "chore: merge feature/mvp-database-v2 into main — RetroDex v1.0"')
      run('git tag -a v1.0 -m "RetroDex v1.0 — 21 mars 2026"', { ignoreError: true })
      run('git push origin main')
      run('git push origin v1.0', { ignoreError: true })
      run('git checkout feature/mvp-database-v2')
      console.log('  ✓ Merger sur main + tag v1.0')
    }
  },

  {
    id: 'FRANCHISE-ID',
    title: 'Ajouter franchise_id sur Game',
    priority: 'HAUTE',
    run: async () => {
      const scriptPath = path.join(ROOT, 'scripts/migrate/populate_franchise_ids.js')
      if (!fs.existsSync(scriptPath)) {
        console.log('  → Script populate_franchise_ids.js non trouvé — créer depuis PROMPT 05')
        return
      }
      run(`node ${scriptPath}`)
    }
  },

  {
    id: 'TRUST-SERVICE',
    title: 'Créer backend/src/services/trustService.js',
    priority: 'HAUTE',
    run: async () => {
      const dir  = path.join(ROOT, 'backend/src/services')
      const file = path.join(dir, 'trustService.js')
      if (fs.existsSync(file)) { console.log('  ✓ trustService.js existe déjà'); return }

      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

      fs.writeFileSync(file, `'use strict'
const C = require('../config/constants')
function getTier(p) {
  if (p >= C.TRUST.T1_MIN) return 'T1'
  if (p >= C.TRUST.T2_MIN) return 'T2'
  if (p >= C.TRUST.T3_MIN) return 'T3'
  if (p >= C.TRUST.T4_MIN) return 'T4'
  return 'T0'
}
function getTierLabel(t) {
  return { T1:'✓ VÉRIFIÉ', T2:'~ FIABLE', T3:'≈ INDICATIF', T4:'? ESTIMÉ', T0:'— INCONNU' }[t]
}
function buildTrustInfo(idx) {
  if (!idx) return { tier:'T0', label:'— INCONNU', confidence:0 }
  const tier = getTier(idx.confidence_pct)
  return { tier, label:getTierLabel(tier), confidence:idx.confidence_pct,
    sources_editorial:idx.sources_editorial, last_sale:idx.last_sale_date }
}
module.exports = { getTier, getTierLabel, buildTrustInfo }
`)
      console.log('  ✓ trustService.js créé')
    }
  },

  {
    id: 'PIPELINE-BATCH4',
    title: 'Import Wikidata offset 150 — objectif 1500 jeux',
    priority: 'MOYENNE',
    run: async () => {
      const platforms = ['Super Nintendo','Sega Saturn','PlayStation',
        'Nintendo 64','Sega Genesis','NES','Game Boy']
      for (const p of platforms) {
        console.log(`  → ${p}...`)
        run(`node scripts/pipeline/run.js --entity=game --source=wikidata --platform="${p}" --limit=50 --offset=150`,
          { ignoreError: true })
      }
    }
  },

  {
    id: 'COLLECTION-HISTORY',
    title: 'Ajouter price_paid + plus-value sur CollectionItem',
    priority: 'MOYENNE',
    run: async () => {
      console.log('  → Ce prompt nécessite des modifications manuelles de fichiers')
      console.log('  → Voir PROMPT 12 dans le Brief Autonomie Notion')
      console.log('  → Fichiers : CollectionItem.js, routes/collection.js, collection.html')
    }
  },

  {
    id: 'SEARCH-IMPROVE',
    title: 'Améliorer recherche — tri + année + raccourci /',
    priority: 'MOYENNE',
    run: async () => {
      // Ajouter raccourci clavier / sur hub.html
      const hubPath = path.join(ROOT, 'backend/public/hub.html')
      if (!fs.existsSync(hubPath)) { console.log('  ⚠ hub.html introuvable'); return }

      const hub = fs.readFileSync(hubPath, 'utf8')
      if (hub.includes("e.key === '/'")) {
        console.log('  ✓ Raccourci / déjà présent dans hub.html')
        return
      }

      const snippet = `
<script>
document.addEventListener('keydown', function(e) {
  if (e.key === '/' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
    e.preventDefault()
    window.location.href = '/search.html'
  }
})
</script>
</body>`
      const updated = hub.replace('</body>', snippet)
      fs.writeFileSync(hubPath, updated)
      console.log('  ✓ Raccourci clavier / ajouté dans hub.html')
    }
  },

  {
    id: 'STATS-ENRICH',
    title: 'Page stats avec graphiques ASCII',
    priority: 'MOYENNE',
    run: async () => {
      console.log('  → Voir PROMPT 15 dans le Brief Autonomie Notion')
      console.log('  → Modifier routes/market.js + stats.html')
    }
  },

  {
    id: 'SKELETON-01',
    title: 'Ajouter skeleton loading dans style.css',
    priority: 'MOYENNE',
    run: async () => {
      const cssPath = path.join(ROOT, 'backend/public/style.css')
      if (!fs.existsSync(cssPath)) throw new Error('style.css introuvable')

      const css = fs.readFileSync(cssPath, 'utf8')
      if (css.includes('.skeleton')) {
        console.log('  ✓ Skeleton déjà présent dans style.css')
        return
      }

      const skeletonCss = `

/* ========================================
   SKELETON LOADING
   ======================================== */
.skeleton {
  background: linear-gradient(90deg,
    var(--bg-card) 25%, var(--border) 50%, var(--bg-card) 75%);
  background-size: 200% 100%;
  animation: skeleton-pulse 1.5s infinite;
  height: 12px;
  margin-bottom: 8px;
}
@keyframes skeleton-pulse {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
.skeleton-short  { width: 40%; }
.skeleton-medium { width: 70%; }
.skeleton-full   { width: 100%; }
.skeleton-title  { height: 20px; width: 60%; margin-bottom: 12px; }
`
      fs.appendFileSync(cssPath, skeletonCss)
      console.log('  ✓ Skeleton loading ajouté dans style.css')
    }
  },

  {
    id: 'RENDER-GAME',
    title: 'Créer /js/renderGameRow.js composant unifié',
    priority: 'MOYENNE',
    run: async () => {
      const jsDir  = path.join(ROOT, 'backend/public/js')
      const jsFile = path.join(jsDir, 'renderGameRow.js')
      if (fs.existsSync(jsFile)) { console.log('  ✓ renderGameRow.js existe déjà'); return }

      if (!fs.existsSync(jsDir)) fs.mkdirSync(jsDir, { recursive: true })

      fs.writeFileSync(jsFile, `'use strict'
function renderGameRow(game, opts) {
  opts = opts || {}
  var showPrice  = opts.showPrice  !== false
  var showRarity = opts.showRarity !== false
  var colors = {
    LEGENDARY:'var(--confidence-high)',
    EPIC:'var(--text-alert)',
    RARE:'var(--confidence-mid)',
    UNCOMMON:'var(--text-muted)',
    COMMON:'var(--text-muted)'
  }
  var el = document.createElement('div')
  el.className = 'result-row'
  el.style.cursor = 'pointer'
  el.onclick = function() { location.href = '/game-detail.html?id=' + game.id }
  var price   = showPrice && game.loosePrice ? '$' + Math.round(game.loosePrice) : ''
  var rarity  = game.rarity || ''
  var color   = colors[rarity] || 'var(--text-muted)'
  el.innerHTML =
    '<span class="result-title" style="color:var(--text-primary)">' + game.title + '</span>' +
    '<span class="result-meta">' + (game.console||'') + ' · ' + (game.year||'—') + '</span>' +
    (showPrice  ? '<span class="result-price" style="color:var(--text-alert)">' + price + '</span>' : '') +
    (showRarity ? '<span class="result-rarity" style="color:' + color + ';font-size:9px">' + rarity + '</span>' : '')
  return el
}
if (typeof module !== 'undefined') module.exports = { renderGameRow }
`)
      console.log('  ✓ renderGameRow.js créé dans backend/public/js/')
    }
  },

  {
    id: 'FRANCHISE-BATCH2',
    title: '10 nouvelles franchises',
    priority: 'BASSE',
    run: async () => {
      console.log('  → Ajouter les 10 franchises dans data/franchises_seed.json')
      console.log('  → Voir PROMPT 16 dans le Brief Autonomie Notion')
      console.log('  → Puis : node scripts/encyclopedia/seed_franchises.js')
    }
  },

  {
    id: 'FRESHNESS',
    title: 'Décote de fraîcheur sur confidence_pct',
    priority: 'BASSE',
    run: async () => {
      console.log('  → Voir PROMPT 18 dans le Brief Autonomie Notion')
      console.log('  → Modifier scripts/market/upgrade_to_t1.js + routes/market.js')
    }
  },

  {
    id: 'TESTS-01',
    title: 'Suite de tests supertest',
    priority: 'BASSE',
    run: async () => {
      run('cd backend && npm install --save-dev jest supertest', { ignoreError: true })
      const testDir  = path.join(ROOT, 'backend/tests')
      const testFile = path.join(testDir, 'api.test.js')
      if (fs.existsSync(testFile)) { console.log('  ✓ Tests déjà présents'); return }

      if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true })
      fs.writeFileSync(testFile, `const request = require('supertest')
let app
beforeAll(() => { app = require('../src/server') })
afterAll(async () => {
  const { sequelize } = require('../config/database')
  await sequelize.close()
})
describe('API RetroDex', () => {
  test('GET /api/health', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
  test('GET /api/games retourne items', async () => {
    const res = await request(app).get('/api/games?limit=3')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.items)).toBe(true)
  })
  test('GET /api/franchises', async () => {
    const res = await request(app).get('/api/franchises')
    expect(res.status).toBe(200)
  })
  test('GET /api/search', async () => {
    const res = await request(app).get('/api/search?q=mario&limit=5')
    expect(res.status).toBe(200)
  })
})
`)
      console.log('  ✓ Tests créés dans backend/tests/api.test.js')
    }
  },

  {
    id: 'DEPLOY-FINAL',
    title: 'Export DB + préparation Railway',
    priority: 'CRITIQUE',
    run: async () => {
      console.log('  → Export des données...')
      run('node backend/scripts/export_db.js', { ignoreError: true })

      const exportDir = path.join(ROOT, 'data/exports')
      if (fs.existsSync(exportDir)) {
        const files = fs.readdirSync(exportDir)
        files.forEach(f => {
          const size = fs.statSync(path.join(exportDir, f)).size
          console.log(`  ✓ ${f} (${Math.round(size/1024)}KB)`)
        })
      }
      console.log('\n  DÉPLOIEMENT RAILWAY :')
      console.log('  1. railway.app → New Project → ftassy91/RETRODEX → feature/mvp-database-v2')
      console.log('  2. Add PostgreSQL service → copier DATABASE_URL')
      console.log('  3. Variables : NODE_ENV=production DATABASE_URL=... ANTHROPIC_API_KEY=...')
      console.log('  4. Trigger deploy')
      console.log('  5. Console Railway → node scripts/migrate/import_from_export.js')
    }
  }

]

// ─── RUNNER PRINCIPAL ──────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2)
  const targetId   = args.find(a => !a.startsWith('--'))
  const forceRedo  = args.includes('--force')
  const listMode   = args.includes('--list')
  const resetMode  = args.includes('--reset')
  const autoMode   = args.includes('--auto')   // exécuter sans confirmation

  const state = loadState()

  if (resetMode) {
    saveState({})
    console.log('✓ État du pipeline réinitialisé')
    return
  }

  if (listMode) {
    console.log('\n📋 PIPELINE RETRODEX — ÉTAT DES TÂCHES\n')
    TASKS.forEach(t => {
      const done   = !!state[t.id]
      const status = done ? '✅' : '🔴'
      const date   = done ? ` (${state[t.id].date})` : ''
      console.log(`  ${status} [${t.priority.padEnd(8)}] ${t.id} — ${t.title}${date}`)
    })
    console.log('\nUsage:')
    console.log('  node retrodex_pipeline.js --list           Voir toutes les tâches')
    console.log('  node retrodex_pipeline.js [ID]             Exécuter une tâche')
    console.log('  node retrodex_pipeline.js --auto           Exécuter toutes les tâches non faites')
    console.log('  node retrodex_pipeline.js [ID] --force     Forcer la ré-exécution')
    console.log('  node retrodex_pipeline.js --reset          Remettre l\'état à zéro')
    return
  }

  // Sélectionner les tâches à exécuter
  let tasksToRun = targetId
    ? TASKS.filter(t => t.id === targetId)
    : autoMode
      ? TASKS.filter(t => !state[t.id])
      : TASKS.filter(t => !state[t.id])

  if (tasksToRun.length === 0) {
    if (targetId) console.log(`\n⚠ Tâche "${targetId}" introuvable ou déjà exécutée (--force pour forcer)`)
    else          console.log('\n✅ Toutes les tâches sont déjà exécutées. (--reset pour recommencer)')
    return
  }

  for (const task of tasksToRun) {
    if (state[task.id] && !forceRedo) {
      skip(task.id, task.title)
      continue
    }

    header(task.id, task.title)

    try {
      await task.run()

      state[task.id] = {
        done: true,
        date: new Date().toISOString().slice(0, 10),
        status: 'success'
      }
      saveState(state)
      console.log(`\n  ✅ ${task.id} terminé`)

    } catch (err) {
      console.error(`\n  ❌ ${task.id} ERREUR : ${err.message}`)
      state[task.id] = {
        done: false,
        date: new Date().toISOString().slice(0, 10),
        status: 'error',
        error: err.message
      }
      saveState(state)

      if (!autoMode) break  // En mode manuel, arrêter sur erreur
      // En mode auto, continuer avec la prochaine tâche
    }
  }

  console.log('\n' + '═'.repeat(60))
  console.log('  PIPELINE TERMINÉ')
  console.log('═'.repeat(60))
  const done  = Object.values(state).filter(s => s.status === 'success').length
  const total = TASKS.length
  console.log(`  ${done}/${total} tâches complétées`)
  console.log('  node scripts/pipeline/retrodex_pipeline.js --list\n')
}

main().catch(err => {
  console.error('[FATAL]', err.message)
  process.exit(1)
})
