const SEARCH_VIEW = {
  initialConsole: null,

  filterBy(consoleName) {
    this.initialConsole = consoleName;
  },

  render() {
    const consoles = DATA_LAYER.getConsoles().map(c => c.name);
    const rarities = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'];

    const activeConsole = this.initialConsole || '';
    this.initialConsole = null;

    const consoleOpts = consoles
      .map(c => `<option value="${c}" ${c === activeConsole ? 'selected' : ''}>${c}</option>`)
      .join('');
    const rarityOpts = rarities
      .map(r => `<option value="${r}">${r}</option>`)
      .join('');
    const results = DATA_LAYER.getGames().slice(0, 40);

    return `
      <section class="screen screen-search">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Archive Search</p>
            <h2>Filter the archive</h2>
          </div>
          <div class="highlight-chip" id="resultCount">${DATA_LAYER.getGames().length} games</div>
        </div>

        <div class="search-controls">
          <label class="search-box">
            <span>Search by title, developer, year...</span>
            <input id="searchInput" type="search" placeholder="Zelda, Capcom, 1994..." autocomplete="off">
          </label>
          <div class="search-filters">
            <select id="filterConsole" class="filter-select">
              <option value="">All consoles</option>
              ${consoleOpts}
            </select>
            <select id="filterRarity" class="filter-select">
              <option value="">All rarities</option>
              ${rarityOpts}
            </select>
          </div>
        </div>

        <div id="searchResults" class="search-results">
          ${this.renderResults(results)}
        </div>
      </section>
    `;
  },

  bindEvents() {
    const sel = document.getElementById('filterConsole');
    if (sel && sel.value) sel.dispatchEvent(new Event('change'));

    const input = document.getElementById('searchInput');
    const selCon = document.getElementById('filterConsole');
    const selRar = document.getElementById('filterRarity');
    const results = document.getElementById('searchResults');
    const count = document.getElementById('resultCount');

    const update = () => {
      const query = input?.value || '';
      const consoleName = selCon?.value || '';
      const rarity = selRar?.value || '';

      const filters = {};
      if (consoleName) filters.console = consoleName;
      if (rarity) filters.rarity = rarity;

      const found = DATA_LAYER.searchGames(query, filters);
      const shown = found.slice(0, 60);

      if (count) count.textContent = `${found.length} result${found.length !== 1 ? 's' : ''}`;
      if (results) results.innerHTML = this.renderResults(shown);
    };

    input?.addEventListener('input', update);
    selCon?.addEventListener('change', update);
    selRar?.addEventListener('change', update);
  },

  renderResults(results) {
    if (!results.length) {
      return `
        <article class="empty-state">
          <h3>No matches</h3>
          <p>Try adjusting the search term or filters.</p>
        </article>`;
    }

    return results.map(g => `
      <article class="search-card">
        <div>
          <p class="eyebrow">${g.console} - ${g.year}</p>
          <h3>${g.title}</h3>
          <p>${g.developer}</p>
        </div>
        <div class="search-meta">
          <span class="pill">${g.rarity || 'UNKNOWN'}</span>
          <span>${formatCurrency(g.price?.cib) !== 'N/A' ? formatCurrency(g.price?.cib) : '-'}</span>
        </div>
      </article>
    `).join('');
  }
};
