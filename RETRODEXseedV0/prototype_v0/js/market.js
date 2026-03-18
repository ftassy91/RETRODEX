const MARKET_VIEW = {
  charts: [],

  render() {
    const ov = DATA_LAYER.getMarketOverview();
    const top = ov.topTen || [];

    const topRows = top.map((g, i) => `
      <tr>
        <td class="rank">#${i+1}</td>
        <td class="game-title">${g.title}</td>
        <td class="game-console">${g.console}</td>
        <td class="price-cell">${formatCurrency(g.price?.loose)}</td>
        <td class="price-cell">${formatCurrency(g.price?.cib)}</td>
        <td class="price-cell price-mint">${formatCurrency(g.price?.mint)}</td>
      </tr>
    `).join('');

    return `
      <section class="screen screen-market">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Market Dashboard</p>
            <h2>Price Signals</h2>
          </div>
          ${ov.mostValuable ? `
            <div class="highlight-chip">
              Top mint: ${ov.mostValuable.title} — ${formatCurrency(ov.mostValuable.price?.mint)}
            </div>` : ''}
        </div>

        <section class="metric-grid">
          <article class="metric-card">
            <span>${ov.trackedGames}</span>
            <p>Tracked games</p>
          </article>
          <article class="metric-card">
            <span>${formatCurrency(Math.round(ov.averageLoose))}</span>
            <p>Avg loose</p>
          </article>
          <article class="metric-card">
            <span>${formatCurrency(Math.round(ov.averageCib))}</span>
            <p>Avg CIB</p>
          </article>
          <article class="metric-card">
            <span>${formatCurrency(Math.round(ov.averageMint))}</span>
            <p>Avg mint</p>
          </article>
        </section>

        <div class="market-charts-row">
          <div class="chart-panel chart-panel--tall">
            <p class="eyebrow" style="margin-bottom:12px">Top 10 by Mint Value</p>
            <canvas id="marketBarChart"></canvas>
          </div>
          <div class="chart-panel">
            <p class="eyebrow" style="margin-bottom:12px">Rarity Distribution</p>
            <canvas id="rarityDoughnut"></canvas>
          </div>
        </div>

        <div class="market-top-table-wrap">
          <p class="eyebrow" style="margin-bottom:12px">Top 10 Most Valuable</p>
          <table class="market-top-table">
            <thead>
              <tr>
                <th>#</th><th>Title</th><th>Console</th>
                <th>Loose</th><th>CIB</th><th>Mint</th>
              </tr>
            </thead>
            <tbody>${topRows}</tbody>
          </table>
        </div>
      </section>
    `;
  },

  mountChart() {
    if (!window.Chart) { return; } // Chart.js non disponible (mode hors-ligne)
    this.charts.forEach(c => c.destroy());
    this.charts = [];

    const ov    = DATA_LAYER.getMarketOverview();
    const top   = ov.topTen || [];
    const rarity = DATA_LAYER.getRarityStats();

    // Bar chart — top 10
    const barCanvas = document.getElementById('marketBarChart');
    if (barCanvas) {
      this.charts.push(new Chart(barCanvas, {
        type: 'bar',
        data: {
          labels: top.map(g => g.title.length > 18 ? g.title.slice(0,16)+'…' : g.title),
          datasets: [
            { label:'Loose', data: top.map(g=>g.price?.loose||0), backgroundColor:'#9bbc0f' },
            { label:'CIB',   data: top.map(g=>g.price?.cib  ||0), backgroundColor:'#8bac0f' },
            { label:'Mint',  data: top.map(g=>g.price?.mint ||0), backgroundColor:'#306230' }
          ]
        },
        options: {
          responsive:true, maintainAspectRatio:false,
          plugins:{ legend:{ labels:{ color:'#e0f0a0', font:{ family:"'Share Tech Mono',monospace" } } } },
          scales:{
            x:{ ticks:{ color:'#e0f0a0', font:{size:9} }, grid:{ color:'rgba(224,240,160,0.1)' } },
            y:{ ticks:{ color:'#e0f0a0', callback:v=>'$'+v }, grid:{ color:'rgba(224,240,160,0.1)' } }
          }
        }
      }));
    }

    // Doughnut — rarity
    const donutCanvas = document.getElementById('rarityDoughnut');
    if (donutCanvas) {
      const labels = Object.keys(rarity);
      const values = Object.values(rarity);
      this.charts.push(new Chart(donutCanvas, {
        type: 'doughnut',
        data: {
          labels,
          datasets:[{ data:values, backgroundColor:['#9bbc0f','#8bac0f','#306230','#0f380f','#4a7c59'] }]
        },
        options:{
          responsive:true, maintainAspectRatio:false,
          plugins:{
            legend:{ position:'bottom', labels:{ color:'#e0f0a0', font:{family:"'Share Tech Mono',monospace"}, padding:16 } },
            tooltip:{ callbacks:{ label: ctx => `${ctx.label}: ${ctx.raw} games` } }
          }
        }
      }));
    }
  }
};
