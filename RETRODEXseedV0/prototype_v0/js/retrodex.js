/* =====================================================================
   RETRODEX_VIEW — 3DS XL PNG Interface
   Top screen  : pixel art illustration (ILLUSTRATOR)
   Bot screen  : structured game card (Zelda-reference layout)
   ===================================================================== */

const RETRODEX_VIEW = {
  currentIndex: 0,
  chart: null,

  /* ── Data helpers ──────────────────────────────────────────────── */
  getGames()  { return DATA_LAYER.getGames(); },

  getGame() {
    const g = this.getGames();
    if (!g || !g.length) return null;
    this.currentIndex = Math.max(0, Math.min(this.currentIndex, g.length - 1));
    return g[this.currentIndex];
  },

  getRank(game, all) {
    const pool = all.filter(g => g.console === game.console && g.metascore)
                    .sort((a, b) => b.metascore - a.metascore);
    const i = pool.findIndex(g => g.id === game.id);
    return i >= 0 ? i + 1 : '?';
  },

  getGenre(game) {
    if (typeof getGenre === 'function') return getGenre(game);
    const map = {
      'Action': ['contra','ninja','shinobi','castlevania','ghosts','mega man','ghouls','battletoads'],
      'RPG':    ['final fantasy','dragon quest','chrono','breath of fire','suikoden','xenogears','wild arms','lufia','phantasy star','secret of mana'],
      'Platform':['mario','sonic','donkey kong','kirby','crash','spyro','yoshi','wario'],
      'Racing': ['mario kart','f-zero','wipeout','colin','ridge racer'],
      'Puzzle': ['tetris','dr. mario','meteos','intelligent qube'],
      'Fighting':['street fighter','mortal kombat','soul','king of fighters','samurai shodown','fatal fury','garou','last blade'],
      'Shooter': ['ikaruga','radiant silvergun','thunder force','truxton','gradius','r-type'],
      'Adventure':['zelda','tomb raider','parasite eve','vagrant','alundra','klonoa'],
    };
    const t = (game.title + (game.developer || '')).toLowerCase();
    for (const [genre, keys] of Object.entries(map)) {
      if (keys.some(k => t.includes(k))) return genre;
    }
    return 'Action';
  },

  /* ── Navigation ────────────────────────────────────────────────── */
  navigate(dir) {
    const n = this.getGames().length;
    this.currentIndex = (this.currentIndex + dir + n) % n;
    this.refresh();
  },

  goTo(id) {
    const i = this.getGames().findIndex(g => g.id === id);
    if (i >= 0) { this.currentIndex = i; this.refresh(); }
  },

  /* ── Shell HTML ────────────────────────────────────────────────── */
  render() {
    return `<section class="screen screen-retrodex" style="display:flex;flex-direction:column;align-items:center;padding:24px 16px;width:100%;min-height:100vh;background:#000;">
      <div class="rdx-wrapper" style="position:relative;width:min(92vw,740px);aspect-ratio:1313/875;background:#000;">
        <div class="rdx-top" id="rdxTop" style="position:absolute;left:15.16%;top:6.86%;width:69.69%;height:37.37%;background:#0f380f;z-index:1;overflow:hidden;">
          <canvas id="rdxCanvas" width="320" height="240"></canvas>
        </div>
        <div class="rdx-bot" id="rdxBot" style="position:absolute;left:24.60%;top:47.43%;width:50.65%;height:38.51%;background:#0f380f;z-index:1;overflow:hidden;padding:7px 9px;display:flex;flex-direction:column;"></div>
        <img class="rdx-png" src="img/3ds-template.png" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:fill;pointer-events:none;z-index:10;">
      </div>
      <div class="rdx-nav" id="rdxNav" style="display:flex;align-items:center;justify-content:center;gap:24px;margin-top:14px;width:min(92vw,740px);"></div>
    </section>`;
  },

  /* ── Refresh ───────────────────────────────────────────────────── */
  refresh() {
    const game = this.getGame();
    const all  = this.getGames();
    if (!game) return;

    /* Top screen — illustration */
    try {
      const cv = document.getElementById('rdxCanvas');
      if (cv) {
        if (typeof ILLUSTRATOR !== 'undefined') {
          ILLUSTRATOR.generate(cv, game, 4);
        } else {
          const ctx = cv.getContext('2d');
          ctx.fillStyle = '#0f380f';
          ctx.fillRect(0, 0, 320, 240);
          ctx.fillStyle = '#9bbc0f';
          ctx.font = 'bold 13px monospace';
          const words = game.title.split(' ');
          let line = '', y = 40;
          words.forEach(w => {
            const test = line + (line ? ' ' : '') + w;
            if (ctx.measureText(test).width > 290) {
              ctx.fillText(line, 10, y); line = w; y += 20;
            } else { line = test; }
          });
          if (line) ctx.fillText(line, 10, y);
          ctx.font = '11px monospace';
          ctx.fillStyle = '#8bac0f';
          ctx.fillText(game.console + ' · ' + game.year, 10, y + 24);
        }
      }
    } catch(e) { console.error('[RDX top]', e); }

    /* Bot screen — data card */
    try {
      const bot = document.getElementById('rdxBot');
      if (bot) bot.innerHTML = this.renderBot(game, all);
    } catch(e) { console.error('[RDX bot]', e); }

    /* Nav */
    try {
      const nav = document.getElementById('rdxNav');
      if (nav) nav.innerHTML = this.renderNav(all);
    } catch(e) { console.error('[RDX nav]', e); }

    /* Chart */
    setTimeout(() => { try { this.mountChart(game); } catch(e){ console.error('[RDX chart]',e); } }, 0);
  },

  /* ── Bottom screen — Zelda-reference layout ────────────────────── */
  renderBot(game, all) {
    const rank  = this.getRank(game, all);
    const genre = this.getGenre(game);
    const p     = game.price || {};
    const loose = p.loose ? '$' + p.loose : 'N/A';
    const cib   = p.cib   ? '$' + p.cib   : 'N/A';
    const mint  = p.mint  ? '$' + p.mint  : 'N/A';

    const S = { card:'position:relative;z-index:1;display:flex;flex-direction:column;flex:1;overflow:hidden;', title:'font-family:"Courier New",monospace;font-size:7px;color:#9bbc0f;line-height:1.5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex-shrink:0;margin-bottom:3px;', line:'font-family:"Courier New",monospace;font-size:7.5px;color:#9bbc0f;line-height:1.55;white-space:nowrap;overflow:hidden;flex-shrink:0;', hr:'border:none;border-top:1px solid rgba(139,172,15,0.5);margin:2px 0 3px;flex-shrink:0;', badge:'font-family:"Courier New",monospace;font-size:5.5px;color:#0f380f;background:#8bac0f;padding:2px 4px;border-radius:2px;white-space:nowrap;flex-shrink:0;', phead:'font-family:"Courier New",monospace;font-size:6.5px;color:#9bbc0f;margin:4px 0 3px;flex-shrink:0;', pbody:'display:flex;align-items:stretch;gap:8px;flex:1;min-height:0;', pcol:'display:flex;flex-direction:column;justify-content:space-evenly;flex-shrink:0;', pline:'font-family:"Courier New",monospace;font-size:7px;color:#9bbc0f;white-space:nowrap;line-height:1.5;', spark:'flex:1;min-width:0;min-height:24px;border:1px solid rgba(155,188,15,0.35);background:rgba(10,30,10,0.6);position:relative;', genreline:'display:flex;align-items:center;justify-content:space-between;margin-top:1px;' };
    return `<div class="rdx-card" style="${S.card}">
      <div class="rdx-card-title" style="${S.title}">${game.title}</div>
      <hr class="rdx-hr" style="${S.hr}">
      <div class="rdx-line" style="${S.line}"><span class="rdx-lbl">Console:</span> ${game.console}</div>
      <div class="rdx-line" style="${S.line}"><span class="rdx-lbl">Metascore:</span> ${game.metascore || 'N/A'}</div>
      <div class="rdx-line" style="${S.line}"><span class="rdx-lbl">Rank:</span> #${rank} ${game.console}</div>
      <div class="rdx-line rdx-genre-line">
        <span><span class="rdx-lbl">Genre:</span> ${genre}</span>
        <span class="rdx-badge" style="${S.badge}">${game.rarity}</span>
      </div>
      <hr class="rdx-hr" style="${S.hr}">
      <div class="rdx-price-head" style="${S.phead}">Price Range</div>
      <div class="rdx-price-body" style="${S.pbody}">
        <div class="rdx-price-col" style="${S.pcol}">
          <div class="rdx-pline" style="${S.pline}"><span class="rdx-lbl">Loose:</span> ${loose}</div>
          <div class="rdx-pline" style="${S.pline}"><span class="rdx-lbl">CIB:</span>   ${cib}</div>
          <div class="rdx-pline" style="${S.pline}"><span class="rdx-lbl">Mint:</span>  ${mint}</div>
        </div>
        <div class="rdx-spark-wrap" style="${S.spark}"><canvas id="rdxSpark" style="display:block;position:absolute;inset:0;width:100%;height:100%;"></canvas></div>
      </div>
    </div>`;
  },

  renderNav(all) {
    const bs = 'font-family:monospace;font-size:9px;color:#9bbc0f;background:rgba(155,188,15,0.08);border:1px solid rgba(155,188,15,0.35);border-radius:3px;padding:10px 22px;cursor:pointer;letter-spacing:0.04em;';
    const cs = 'font-family:monospace;font-size:11px;color:rgba(155,188,15,0.5);min-width:80px;text-align:center;';
    const idx = this.currentIndex + 1;
    const tot = all.length;
    return '<button class="rdx-btn" style="'+bs+'" onclick="RETRODEX_VIEW.navigate(-1)">&#9664; PREV</button>'
         + '<span class="rdx-ctr" style="'+cs+'">#'+idx+' / '+tot+'</span>'
         + '<button class="rdx-btn" style="'+bs+'" onclick="RETRODEX_VIEW.navigate(1)">NEXT &#9654;</button>';
  },

  /* ── Spark chart ───────────────────────────────────────────────── */
  mountChart(game) {
    if (this.chart) { try { this.chart.destroy(); } catch(_){} this.chart = null; }
    const cv = document.getElementById('rdxSpark');
    if (!cv || typeof Chart === 'undefined') return;
    const p = game.price || {};
    if (!p.loose && !p.cib && !p.mint) return;

    this.chart = new Chart(cv, {
      type: 'line',
      data: {
        labels: ['L', 'C', 'M'],
        datasets: [{
          data: [p.loose || 0, p.cib || 0, p.mint || 0],
          borderColor: '#9bbc0f',
          backgroundColor: 'rgba(155,188,15,0.12)',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: '#9bbc0f',
          tension: 0.35,
          fill: true
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 0 },
        plugins: { legend: { display: false },
          tooltip: { displayColors: false,
            backgroundColor: '#0f380f', titleColor: '#9bbc0f', bodyColor: '#8bac0f',
            callbacks: { label: c => '$' + c.parsed.y }
          }
        },
        scales: { x: { display: false }, y: { display: false, beginAtZero: true } }
      }
    });
  },

  /* ── Events ────────────────────────────────────────────────────── */
  bindEvents() {
    if (this._kh) {
      document.removeEventListener('keydown', this._kh);
    }

    this.refresh();
    this._kh = e => {
      if (e.key==='ArrowLeft'  || e.key==='ArrowUp')   { e.preventDefault(); this.navigate(-1); }
      if (e.key==='ArrowRight' || e.key==='ArrowDown')  { e.preventDefault(); this.navigate(1); }
    };
    document.addEventListener('keydown', this._kh);
  },

  cleanup() {
    if (this._kh) { document.removeEventListener('keydown', this._kh); this._kh = null; }
    if (this.chart) { try { this.chart.destroy(); } catch(_){} this.chart = null; }
  }
};
