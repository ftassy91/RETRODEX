const CONSOLES_VIEW = {
  render() {
    const consoles = DATA_LAYER.getConsoles();
    const byGen = {};
    consoles.forEach(c => {
      const g = c.gen || 0;
      if (!byGen[g]) byGen[g] = [];
      byGen[g].push(c);
    });
    const genLabels = {3:'3rd Generation',4:'4th Generation',5:'5th Generation',6:'6th Generation',7:'7th Generation'};

    const rows = Object.keys(byGen).sort().map(gen => `
      <div class="console-gen-block">
        <p class="eyebrow">${genLabels[gen] || 'Generation ' + gen}</p>
        <div class="console-grid">
          ${byGen[gen].map(c => `
            <article class="console-card" role="button" tabindex="0"
              onclick="SEARCH_VIEW.filterBy('${c.name}'); ROUTER.go('/search')"
              onkeydown="if(event.key==='Enter'||event.key===' '){SEARCH_VIEW.filterBy('${c.name}');ROUTER.go('/search')}">
              <div class="console-card-header">
                <span class="console-type-badge">${c.type || 'Home'}</span>
                <span class="console-year">${c.release}</span>
              </div>
              <h3>${c.name}</h3>
              <p class="console-maker">${c.maker || ''}</p>
              <p class="console-library">${c.games} game${c.games === 1 ? '' : 's'} in archive</p>
            </article>
          `).join('')}
        </div>
      </div>
    `).join('');

    return `
      <section class="screen screen-consoles">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Console Index</p>
            <h2>Hardware Timeline</h2>
          </div>
          <div class="highlight-chip">${consoles.length} systems listed</div>
        </div>
        ${rows}
      </section>
    `;
  }
};
