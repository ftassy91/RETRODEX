const HOME_VIEW = {
  render() {
    const featured  = DATA_LAYER.getFeaturedGame();
    const games     = DATA_LAYER.getGames();
    const consoles  = DATA_LAYER.getConsoles();
    const overview  = DATA_LAYER.getMarketOverview();
    const rarity    = DATA_LAYER.getRarityStats();

    const featCard = featured ? `
      <div class="home-featured">
        <p class="eyebrow">Featured — Highest Rated</p>
        <div class="featured-card">
          <div class="featured-artwork">
            <span class="featured-score">${featured.metascore || '?'}</span>
            <span class="featured-label">META</span>
          </div>
          <div class="featured-info">
            <p class="eyebrow">${featured.console}</p>
            <h3>${featured.title}</h3>
            <p>${featured.developer || ''} · ${featured.year || ''}</p>
            <div class="featured-prices">
              <span>Loose <strong>${formatCurrency(featured.price?.loose)}</strong></span>
              <span>CIB <strong>${formatCurrency(featured.price?.cib)}</strong></span>
              <span>Mint <strong>${formatCurrency(featured.price?.mint)}</strong></span>
            </div>
          </div>
          <button class="home-cta" onclick="ROUTER.go('/retrodex')">Open in Retrodex ▶</button>
        </div>
      </div>
    ` : '';

    const rarityEntries = Object.entries(rarity).map(([k,v]) => `
      <div class="home-stat-item">
        <span>${v}</span>
        <p>${k}</p>
      </div>`).join('');

    return `
      <section class="screen screen-home">
        <div class="home-stats-bar">
          <div class="home-stat-item">
            <span>${games.length}</span>
            <p>Games in archive</p>
          </div>
          <div class="home-stat-item">
            <span>${consoles.length}</span>
            <p>Consoles indexed</p>
          </div>
          <div class="home-stat-item">
            <span>${overview.trackedGames}</span>
            <p>Prices tracked</p>
          </div>
          <div class="home-stat-item">
            <span>${formatCurrency(Math.round(overview.averageMint))}</span>
            <p>Avg mint value</p>
          </div>
        </div>
        ${featCard}
        <div class="home-rarity-row">
          <p class="eyebrow" style="margin-bottom:12px">Rarity breakdown</p>
          <div class="home-rarity-grid">${rarityEntries}</div>
        </div>
      </section>
    `;
  }
};

/* ═══════════════════════════════════════════════════════════════
   COLLECTION_VIEW
   Owned + Wishlist en mémoire. Valeur estimée totale.
   ═══════════════════════════════════════════════════════════════ */

const COLLECTION_VIEW = (() => {
  // État en mémoire (réinitialisé à chaque rechargement de page)
  const state = {
    owned:    [],  // [{ id, title, console, price }]
    wishlist: []   // [{ id, title, console, price }]
  };

  function totalValue(list) {
    return list.reduce((sum, g) => sum + (g.price?.cib || 0), 0);
  }

  function inList(list, id) {
    return list.some(g => g.id === id);
  }

  function addTo(list, game) {
    if (!inList(list, game.id)) list.push(game);
  }

  function removeFrom(list, id) {
    const idx = list.findIndex(g => g.id === id);
    if (idx !== -1) list.splice(idx, 1);
  }

  function renderList(list, type) {
    if (!list.length) return `
      <article class="empty-state">
        <h3>${type === 'owned' ? 'Collection vide' : 'Wishlist vide'}</h3>
        <p>Recherche un jeu ci-dessous pour l'ajouter.</p>
      </article>`;

    return list.map(g => `
      <article class="search-card collection-card">
        <div>
          <p class="eyebrow">${g.console} · ${g.year || '—'}</p>
          <h3>${g.title}</h3>
          <span class="pill">${g.rarity || 'UNKNOWN'}</span>
        </div>
        <div class="search-meta">
          <span>CIB ${formatCurrency(g.price?.cib)}</span>
          <button class="rdx-btn rdx-btn--sm"
            onclick="COLLECTION_VIEW.remove('${type}', '${g.id}')">
            ✕ Retirer
          </button>
        </div>
      </article>`).join('');
  }

  function renderSearch() {
    return `
      <div class="collection-search-bar">
        <input id="colSearchInput" type="search"
               placeholder="Ajouter un jeu…" autocomplete="off">
        <div id="colSearchResults" class="col-search-results"></div>
      </div>`;
  }

  return {
    add(type, gameId) {
      const game = DATA_LAYER.getGameBySlug(gameId);
      if (!game) return;
      const list = type === 'owned' ? state.owned : state.wishlist;
      addTo(list, game);
      this.refresh();
    },

    remove(type, gameId) {
      const list = type === 'owned' ? state.owned : state.wishlist;
      removeFrom(list, gameId);
      this.refresh();
    },

    refresh() {
      const owned    = document.getElementById('colOwned');
      const wishlist = document.getElementById('colWishlist');
      const valOwned = document.getElementById('colValueOwned');
      const valWish  = document.getElementById('colValueWish');
      if (owned)    owned.innerHTML    = renderList(state.owned,    'owned');
      if (wishlist) wishlist.innerHTML = renderList(state.wishlist, 'wishlist');
      if (valOwned) valOwned.textContent = formatCurrency(totalValue(state.owned));
      if (valWish)  valWish.textContent  = formatCurrency(totalValue(state.wishlist));
    },

    bindSearch() {
      const input   = document.getElementById('colSearchInput');
      const results = document.getElementById('colSearchResults');
      if (!input || !results) return;

      input.addEventListener('input', () => {
        const q = input.value.trim();
        if (q.length < 2) { results.innerHTML = ''; return; }
        const found = DATA_LAYER.searchGames(q).slice(0, 6);
        results.innerHTML = found.map(g => `
          <div class="col-search-item">
            <span>${g.title} <small>${g.console}</small></span>
            <div>
              <button class="rdx-btn rdx-btn--sm"
                onclick="COLLECTION_VIEW.add('owned','${g.id}');
                         document.getElementById('colSearchInput').value='';
                         document.getElementById('colSearchResults').innerHTML='';">
                + Owned
              </button>
              <button class="rdx-btn rdx-btn--sm"
                onclick="COLLECTION_VIEW.add('wishlist','${g.id}');
                         document.getElementById('colSearchInput').value='';
                         document.getElementById('colSearchResults').innerHTML='';">
                ♥ Wish
              </button>
            </div>
          </div>`).join('');
      });
    },

    render() {
      const ov = DATA_LAYER.getMarketOverview();
      return `
        <section class="screen screen-collection">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Collector Storage</p>
              <h2>Ma Collection</h2>
            </div>
            <div class="highlight-chip">
              Valeur estimée : <strong id="colValueOwned">${formatCurrency(totalValue(state.owned))}</strong>
            </div>
          </div>

          <div class="metric-grid" style="margin-bottom:24px">
            <article class="metric-card">
              <span>${state.owned.length}</span>
              <p>Jeux owned</p>
            </article>
            <article class="metric-card">
              <span>${state.wishlist.length}</span>
              <p>Wishlist</p>
            </article>
            <article class="metric-card">
              <span id="colValueWish">${formatCurrency(totalValue(state.wishlist))}</span>
              <p>Valeur wishlist</p>
            </article>
            <article class="metric-card">
              <span>${ov.trackedGames}</span>
              <p>Prix indexés</p>
            </article>
          </div>

          <p class="eyebrow" style="margin-bottom:12px">Ajouter un jeu</p>
          ${renderSearch()}

          <div class="collection-columns">
            <div>
              <p class="eyebrow" style="margin:16px 0 10px">
                Owned (${state.owned.length})
              </p>
              <div id="colOwned">${renderList(state.owned, 'owned')}</div>
            </div>
            <div>
              <p class="eyebrow" style="margin:16px 0 10px">
                Wishlist (${state.wishlist.length})
              </p>
              <div id="colWishlist">${renderList(state.wishlist, 'wishlist')}</div>
            </div>
          </div>
        </section>`;
    },

    bindEvents() {
      this.bindSearch();
    }
  };
})();


/* ═══════════════════════════════════════════════════════════════
   EDITORIAL_VIEW — Néo Rétro
   3 articles générés dynamiquement depuis les données.
   ═══════════════════════════════════════════════════════════════ */

const EDITORIAL_VIEW = {
  render() {
    const games    = DATA_LAYER.getGames();
    const overview = DATA_LAYER.getMarketOverview();

    // Article 1 — Le jeu le plus rare du moment
    const legendary = games
      .filter(g => g.rarity === 'LEGENDARY' && g.price?.mint)
      .sort((a, b) => (b.price?.mint || 0) - (a.price?.mint || 0))
      .slice(0, 3);

    // Article 2 — Les jeux sous-côtés (score élevé, prix bas)
    const underrated = games
      .filter(g => g.metascore >= 80 && g.price?.cib && g.price.cib < 20)
      .sort((a, b) => (b.metascore || 0) - (a.metascore || 0))
      .slice(0, 3);

    // Article 3 — Coup de cœur : meilleur score par génération
    const byConsole = {};
    games.forEach(g => {
      if (!byConsole[g.console] || (g.metascore || 0) > (byConsole[g.console].metascore || 0)) {
        byConsole[g.console] = g;
      }
    });
    const bestPerConsole = Object.values(byConsole)
      .sort((a, b) => (b.metascore || 0) - (a.metascore || 0))
      .slice(0, 4);

    const articleCard = (game, note) => `
      <article class="editorial-game-card">
        <div>
          <p class="eyebrow">${game.console} · ${game.year || '—'}</p>
          <h4>${game.title}</h4>
          ${note ? `<p class="editorial-note">${note}</p>` : ''}
        </div>
        <div class="search-meta">
          <span class="pill">${game.rarity}</span>
          <span>Mint ${formatCurrency(game.price?.mint)}</span>
        </div>
      </article>`;

    return `
      <section class="screen screen-editorial">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Magazine Desk</p>
            <h2>Néo Rétro</h2>
          </div>
          <div class="highlight-chip">3 articles</div>
        </div>

        <div class="editorial-grid">

          <div class="editorial-article">
            <p class="eyebrow">Cote du moment</p>
            <h3>Les Légendaires en feu</h3>
            <p class="editorial-intro">
              Ces ${legendary.length} titres LEGENDARY atteignent des sommets.
              Mint value en hausse, stocks introuvables.
            </p>
            ${legendary.map(g => articleCard(g, `Score ${g.metascore}/100`)).join('')}
          </div>

          <div class="editorial-article">
            <p class="eyebrow">Bonnes affaires</p>
            <h3>Sous-côtés mais excellents</h3>
            <p class="editorial-intro">
              Score ≥ 80/100, prix CIB inférieur à $20.
              Des pépites accessibles avant qu'elles ne s'envolent.
            </p>
            ${underrated.map(g => articleCard(g, `Score ${g.metascore}/100 · CIB ${formatCurrency(g.price?.cib)}`)).join('')}
          </div>

          <div class="editorial-article">
            <p class="eyebrow">Coup de cœur</p>
            <h3>Le meilleur de chaque console</h3>
            <p class="editorial-intro">
              Un seul titre par machine. Le sommet absolu de chaque catalogue.
            </p>
            ${bestPerConsole.map(g => articleCard(g, g.developer || '')).join('')}
          </div>

        </div>
      </section>`;
  }
};


/* ═══════════════════════════════════════════════════════════════
   GUIDES_VIEW
   Index des consoles avec liens vers leurs jeux.
   ═══════════════════════════════════════════════════════════════ */

const GUIDES_VIEW = {
  render() {
    const consoles = DATA_LAYER.getConsoles();
    const byGen    = {};

    consoles.forEach(c => {
      const g = c.gen || 0;
      if (!byGen[g]) byGen[g] = [];
      byGen[g].push(c);
    });

    const genLabels = {
      3: '3e Génération',
      4: '4e Génération',
      5: '5e Génération',
      6: '6e Génération',
      7: '7e Génération'
    };

    const genBlocks = Object.keys(byGen).sort().map(gen => `
      <div class="guides-gen-block">
        <p class="eyebrow">${genLabels[gen] || 'Génération ' + gen}</p>
        <div class="guides-console-grid">
          ${byGen[gen].map(c => `
            <button class="guides-console-card"
              onclick="ROUTER.go('/search'); setTimeout(() => {
                const sel = document.getElementById('filterConsole');
                if (sel) { sel.value='${c.name.replace(/'/g,"\\'")}';
                           sel.dispatchEvent(new Event('change')); }
              }, 120)">
              <span class="guides-console-name">${c.name}</span>
              <span class="eyebrow">${c.games} jeux · ${c.type || 'Home'}</span>
              <span class="guides-console-year">${c.release || '—'}</span>
            </button>`).join('')}
        </div>
      </div>`).join('');

    return `
      <section class="screen screen-guides">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Manual Archive</p>
            <h2>Guides &amp; Consoles</h2>
          </div>
          <div class="highlight-chip">${consoles.length} systèmes</div>
        </div>

        <p style="margin-bottom:24px; color:var(--scene-muted)">
          Clique sur une console pour filtrer l'archive de jeux.
        </p>

        ${genBlocks}
      </section>`;
  }
};
