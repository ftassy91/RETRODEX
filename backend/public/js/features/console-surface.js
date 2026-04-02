'use strict'

;(function attachConsoleSurface(globalScope) {
  const consoleUi = globalScope.RetroDexConsoleUi || {}
  const escapeHtml = consoleUi.escapeHtml || ((value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;'))

  function fmtPrice(value) {
    const number = Number(value)
    if (!Number.isFinite(number) || number <= 0) {
      return 'n/a'
    }
    return `$${Math.round(number)}`
  }

  function listMarkup(items, emptyMessage) {
    if (!Array.isArray(items) || !items.length) {
      return `<div class="console-detail-empty">${escapeHtml(emptyMessage)}</div>`
    }

    return `<ul class="console-bullet-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
  }

  function sourceMarkup(sources) {
    if (!Array.isArray(sources) || !sources.length) {
      return `<div class="console-detail-empty">Aucune source active.</div>`
    }

    return `
      <div class="console-chip-list">
        ${sources.map((source) => `
          <span class="console-chip-link is-static">
            <span>${escapeHtml(source.label || source.id || 'Source')}</span>
            <small>${escapeHtml(source.status || source.type || '')}</small>
          </span>
        `).join('')}
      </div>
    `
  }

  function renderAccordion(title, kicker, body, open = false) {
    return `
      <details class="console-encyclopedia-block"${open ? ' open' : ''}>
        <summary>
          <div class="detail-kicker">${escapeHtml(kicker)}</div>
          <span class="console-encyclopedia-title">${escapeHtml(title)}</span>
        </summary>
        <div class="console-encyclopedia-body">${body}</div>
      </details>
    `
  }

  function renderGames(games, totalGames) {
    if (!Array.isArray(games) || !games.length) {
      return `<div class="console-detail-empty">Aucun jeu lie.</div>`
    }

    return `
      <div class="console-games-list">
        ${games.map((game) => `
          <a class="console-game-row" href="/game-detail.html?id=${encodeURIComponent(game.id)}">
            <span class="console-game-head">
              <span class="console-game-title">${escapeHtml(game.title || 'Jeu')}</span>
            </span>
            <span class="console-game-meta">${escapeHtml(game.console || '')} | ${escapeHtml(game.year || 'n/a')} | ${escapeHtml(game.rarity || 'n/a')}</span>
          </a>
        `).join('')}
      </div>
      ${totalGames > games.length ? `<div class="console-section-footnote">Apercu limite a ${games.length} jeux sur ${totalGames}.</div>` : ''}
    `
  }

  function renderRelated(items) {
    if (!Array.isArray(items) || !items.length) {
      return `<div class="console-detail-empty">Aucune console voisine.</div>`
    }

    return `
      <div class="console-chip-list">
        ${items.map((item) => `
          <a class="console-chip-link" href="/console-detail.html?id=${encodeURIComponent(item.id)}">
            <span>${escapeHtml(item.name)}</span>
            <small>${escapeHtml(item.releaseYear || 'n/a')}</small>
          </a>
        `).join('')}
      </div>
    `
  }

  function renderNotableGames(items) {
    if (!Array.isArray(items) || !items.length) {
      return `<div class="console-detail-empty">Aucun titre notable mappe.</div>`
    }

    return `
      <div class="console-chip-list">
        ${items.map((item) => item.game
          ? `
            <a class="console-chip-link" href="/game-detail.html?id=${encodeURIComponent(item.game.id)}">
              <span>${escapeHtml(item.title)}</span>
              <small>${escapeHtml(item.game.year || '')}</small>
            </a>
          `
          : `
            <span class="console-chip-link is-static">
              <span>${escapeHtml(item.title)}</span>
              <small>non mappe</small>
            </span>
          `
        ).join('')}
      </div>
    `
  }

  function renderPresenceBadges(signals = {}) {
    const badges = []
    if (signals.hasMaps) badges.push('<span class="console-demo-badge">MAP</span>')
    if (signals.hasManuals) badges.push('<span class="console-demo-badge">MANUAL</span>')
    if (signals.hasSprites) badges.push('<span class="console-demo-badge">SPRITE</span>')
    if (signals.hasEndings) badges.push('<span class="console-demo-badge">ENDING</span>')
    return badges.length
      ? `<div class="console-demo-signal-row">${badges.join('')}</div>`
      : ''
  }

  function renderDemoGames(items, underfilled = false) {
    if (!Array.isArray(items) || !items.length) {
      return `<div class="console-detail-empty">Aucun jeu démo publié pour cette console.</div>`
    }

    return `
      <div class="console-demo-grid">
        ${items.map((item) => `
          <a class="console-demo-card" href="/game-detail.html?id=${encodeURIComponent(item.id)}">
            <div class="console-demo-title">${escapeHtml(item.title || 'Jeu')}</div>
            <div class="console-demo-meta">${escapeHtml(item.year || 'n/a')} | ${escapeHtml(item.rarity || 'n/a')}</div>
            ${renderPresenceBadges(item.signals || {})}
          </a>
        `).join('')}
      </div>
      ${underfilled ? '<div class="console-section-footnote">Console underfilled : tous les jeux publiés disponibles sont affichés.</div>' : ''}
    `
  }

  async function renderHardwareVisual(payload) {
    const consoleInfo = payload.console || {}
    const hardware = payload.hardware || {}
    const renderConsoleIllustration = consoleUi.renderConsoleIllustration || (async () => null)
    const renderMediaAsset = consoleUi.renderMediaAsset || (async () => null)

    const svg = await renderConsoleIllustration({
      id: hardware.referenceId || consoleInfo.slug || consoleInfo.id,
      title: consoleInfo.name,
      platform: consoleInfo.name,
      name: consoleInfo.name,
    }, {
      withMedia: false,
      showLabel: false,
    })

    const media = await renderMediaAsset({
      id: hardware.referenceId || consoleInfo.slug || consoleInfo.id,
      title: consoleInfo.name,
      platform: consoleInfo.name,
      name: consoleInfo.name,
    }, 64)

    return {
      hardwareMarkup: svg || `
        <div class="console-detail-placeholder">${escapeHtml(String(consoleInfo.name || 'RD').slice(0, 2).toUpperCase())}</div>
      `,
      mediaMarkup: media ? `
        <div class="console-media-card">
          <div class="detail-kicker">MEDIA</div>
          <div class="console-media-asset">${media.markup}</div>
          <div class="console-detail-slot-caption">${escapeHtml(media.label || 'Physical media')}</div>
        </div>
      ` : '',
    }
  }

  async function renderConsoleSurface(rootEl, payload, options = {}) {
    if (!rootEl) return

    const { embedded = false, showBreadcrumb = false } = options
    const consoleInfo = payload.console || {}
    const overview = payload.overview || {}
    const market = payload.market || {}
    const hardware = payload.hardware || {}
    const quality = payload.quality || {}
    const sources = payload.sources || []
    const relatedConsoles = payload.relatedConsoles || []
    const notableGames = payload.notableGames || []
    const demoGames = payload.demoGames || []
    const publication = payload.publication || {}
    const games = payload.games || []

    const visuals = await renderHardwareVisual(payload)
    const marketCards = [
      { label: 'Loose', value: fmtPrice(market.avgLoose) },
      { label: 'CIB', value: fmtPrice(market.avgCib) },
      { label: 'Mint', value: fmtPrice(market.avgMint) },
      { label: 'Couverture', value: `${market.priceCoverage || 0}%` },
    ]

    rootEl.innerHTML = `
      ${showBreadcrumb ? `
        <nav class="breadcrumb detail-breadcrumb">
          <a href="/hub.html">HUB</a>
          <span class="sep">&rsaquo;</span>
          <a href="/consoles.html">CONSOLES</a>
          <span class="sep">&rsaquo;</span>
          <span class="current">${escapeHtml(consoleInfo.name || 'Console')}</span>
        </nav>
      ` : ''}
      <section class="${embedded ? 'console-detail-panel-shell' : 'surface-preview-panel console-detail-page-shell'}">
        <div class="console-detail-hero">
          <div class="console-detail-visuals">
            <div class="console-detail-slot console-detail-slot--hardware">${visuals.hardwareMarkup}<div class="console-detail-slot-caption">HARDWARE VIEW</div></div>
            ${visuals.mediaMarkup}
          </div>
          <div class="console-detail-copy">
            <div class="detail-kicker">HARDWARE ENTRY</div>
            <div class="console-detail-title">${escapeHtml(consoleInfo.name || 'Console')}</div>
            <div class="console-detail-meta">${escapeHtml(consoleInfo.manufacturer || 'n/a')} | ${escapeHtml(consoleInfo.releaseYear || 'n/a')} | ${escapeHtml(overview.generation || 'n/a')}</div>
            ${overview.summary ? `<div class="surface-summary-copy">${escapeHtml(overview.summary)}</div>` : ''}
            <div class="console-detail-signals surface-signal-grid is-compact">
              <div class="surface-signal-card"><span class="surface-signal-label">Constructeur</span><span class="surface-signal-value">${escapeHtml(consoleInfo.manufacturer || 'n/a')}</span></div>
              <div class="surface-signal-card"><span class="surface-signal-label">Sortie</span><span class="surface-signal-value">${escapeHtml(consoleInfo.releaseYear || 'n/a')}</span></div>
              <div class="surface-signal-card"><span class="surface-signal-label">Catalogue</span><span class="surface-signal-value">${escapeHtml(consoleInfo.gamesCount || games.length || 0)} jeux</span></div>
              <div class="surface-signal-card"><span class="surface-signal-label">Qualité</span><span class="surface-signal-value">${escapeHtml(quality.tier || 'Tier D')}</span></div>
            </div>
            <div class="surface-chip-row">
              <span class="surface-chip is-primary">${escapeHtml(overview.shortTechnicalIdentity || hardware.media || 'hardware')}</span>
              <span class="surface-chip">${escapeHtml(`Score ${quality.score ?? 0}`)}</span>
              <span class="surface-chip">${escapeHtml(`${market.pricedGames || 0} jeux pricés`)}</span>
            </div>
            <div class="console-section-footnote">${escapeHtml(`${publication.label || 'PASS 1 curated'} | ${publication.publishedGamesCount || 0} jeux publiés | ${publication.consoleCount || 0} consoles`)}</div>
            <div class="console-market-quick-grid">
              ${marketCards.map((card) => `
                <div class="surface-signal-card">
                  <span class="surface-signal-label">${escapeHtml(card.label)}</span>
                  <span class="surface-signal-value">${escapeHtml(card.value)}</span>
                </div>
              `).join('')}
            </div>
            <div class="console-detail-actions surface-action-row">
              <a class="terminal-action-link" href="/games-list.html?console=${encodeURIComponent(consoleInfo.name || '')}">Voir le catalogue -></a>
              <a class="terminal-action-link" href="/stats.html?q=${encodeURIComponent(consoleInfo.name || '')}">Voir le marché →</a>
              <a class="terminal-action-link" href="/search.html?q=${encodeURIComponent(consoleInfo.name || '')}">Voir les liens -></a>
            </div>
          </div>
        </div>
        <div class="console-accordion-stack">
          ${renderAccordion('Overview', 'OVERVIEW', `
            <div class="console-copy-stack">
              ${overview.summary ? `<p>${escapeHtml(overview.summary)}</p>` : ''}
              ${overview.shortTechnicalIdentity ? `<p>${escapeHtml(overview.shortTechnicalIdentity)}</p>` : ''}
            </div>
            <div class="console-subsection-label">Sources</div>
            ${sourceMarkup(sources)}
          `, true)}
          ${renderAccordion('Market', 'MARKET', `
            <div class="console-spec-grid">
              <div class="console-spec-card"><span>Jeux</span><strong>${escapeHtml(market.gamesCount || 0)}</strong></div>
              <div class="console-spec-card"><span>Prices</span><strong>${escapeHtml(market.pricedGames || 0)}</strong></div>
              <div class="console-spec-card"><span>Legendary</span><strong>${escapeHtml(market.legendaryCount || 0)}</strong></div>
              <div class="console-spec-card"><span>Epic</span><strong>${escapeHtml(market.epicCount || 0)}</strong></div>
            </div>
            <div class="console-spec-grid">
              <div class="console-spec-card"><span>Loose</span><strong>${escapeHtml(fmtPrice(market.avgLoose))}</strong></div>
              <div class="console-spec-card"><span>CIB</span><strong>${escapeHtml(fmtPrice(market.avgCib))}</strong></div>
              <div class="console-spec-card"><span>Mint</span><strong>${escapeHtml(fmtPrice(market.avgMint))}</strong></div>
              <div class="console-spec-card"><span>Couverture</span><strong>${escapeHtml(`${market.priceCoverage || 0}%`)}</strong></div>
            </div>
          `)}
          ${renderAccordion('Games', 'GAMES', renderGames(games, consoleInfo.gamesCount || games.length), false)}
          ${renderAccordion('Hardware / Mods', 'HARDWARE', `
            <div class="console-spec-grid">
              <div class="console-spec-card"><span>CPU</span><strong>${escapeHtml(hardware.cpu || 'n/a')}</strong></div>
              <div class="console-spec-card"><span>GPU</span><strong>${escapeHtml(hardware.gpu || 'n/a')}</strong></div>
              <div class="console-spec-card"><span>Memoire</span><strong>${escapeHtml(hardware.memory || 'n/a')}</strong></div>
              <div class="console-spec-card"><span>Media</span><strong>${escapeHtml(hardware.media || 'n/a')}</strong></div>
            </div>
            <div class="console-subsection-label">Fonctions</div>
            ${listMarkup(hardware.notableFeatures || [], 'Aucune fonction notable documentee.')}
            <div class="console-subsection-label">Consoles voisines</div>
            ${renderRelated(relatedConsoles)}
            <div class="console-subsection-label">PASS 1 demos</div>
            ${renderDemoGames(demoGames, Boolean(publication.underfilled))}
            <div class="console-subsection-label">Titres notables</div>
            ${renderNotableGames(notableGames)}
          `)}
        </div>
      </section>
    `
  }

  globalScope.RetroDexConsoleSurface = {
    renderConsoleSurface,
  }
})(typeof window !== 'undefined' ? window : globalThis)
