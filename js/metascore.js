(function attachRetroDexMetascore() {
  const TIERS = [
    { min: 90, tier: 'must-play', label: 'MUST-PLAY', color: '#00ff41' },
    { min: 75, tier: 'great', label: 'GREAT', color: '#00cc33' },
    { min: 60, tier: 'good', label: 'GOOD', color: '#ffaa00' },
    { min: 40, tier: 'mixed', label: 'MIXED', color: '#ff6600' },
    { min: 1, tier: 'weak', label: 'WEAK', color: '#cc0000' }
  ];

  function normalizeScore(score) {
    return typeof score === 'number' && Number.isFinite(score) && score > 0 ? Math.max(1, Math.min(100, Math.round(score))) : null;
  }

  function getTierMeta(score) {
    const normalized = normalizeScore(score);
    if (normalized === null) {
      return { tier: 'none', label: 'NO SCORE', color: '#333333', score: null };
    }
    const match = TIERS.find((item) => normalized >= item.min) || TIERS[TIERS.length - 1];
    return { ...match, score: normalized };
  }

  function createElement(tagName, className, textContent) {
    const node = document.createElement(tagName);
    if (className) node.className = className;
    if (typeof textContent === 'string') node.textContent = textContent;
    return node;
  }

  function ensureStyles() {
    if (document.getElementById('retrodex-metascore-styles')) return;
    const style = document.createElement('style');
    style.id = 'retrodex-metascore-styles';
    style.textContent = `
      .metascore-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-family: "Share Tech Mono", "Courier New", monospace;
        font-weight: bold;
        letter-spacing: 0;
        border: 1px solid;
        flex-shrink: 0;
        border-radius: 0;
        box-shadow: none;
      }
      .metascore-badge--micro  { width: 20px; height: 20px; font-size: 10px; }
      .metascore-badge--normal { width: 28px; height: 28px; font-size: 13px; }
      .metascore-badge--large  { width: 36px; height: 36px; font-size: 15px; }

      .metascore-block {
        padding: 10px 12px;
        border-left: 2px solid;
        background: #0d0d0d;
        margin-bottom: 8px;
        border-radius: 0;
      }
      .metascore-block__label {
        font-size: 9px;
        letter-spacing: 2px;
        color: #333333;
        font-family: "Share Tech Mono", monospace;
        margin-bottom: 6px;
      }
      .metascore-block__row {
        display: flex;
        align-items: baseline;
        gap: 8px;
        margin-bottom: 6px;
      }
      .metascore-block__score {
        font-size: 28px;
        font-weight: bold;
        font-family: "Share Tech Mono", monospace;
      }
      .metascore-block__tier {
        font-size: 10px;
        opacity: 0.8;
        font-family: "Share Tech Mono", monospace;
      }
      .metascore-block__bar {
        height: 2px;
        background: #1a1a1a;
        margin-bottom: 6px;
      }
      .metascore-block__bar-fill {
        height: 100%;
        transition: none;
      }
      .metascore-block__note {
        font-size: 9px;
        color: #333333;
        font-family: "Share Tech Mono", monospace;
      }

      .metascore-inline {
        display: inline-flex;
        align-items: baseline;
        gap: 1px;
        font-family: "Share Tech Mono", monospace;
        white-space: nowrap;
      }
      .metascore-inline--must-play { color: #00ff41; }
      .metascore-inline--great     { color: #00cc33; }
      .metascore-inline--good      { color: #ffaa00; }
      .metascore-inline--mixed     { color: #ff6600; }
      .metascore-inline--weak      { color: #cc0000; }
      .metascore-inline__sep,
      .metascore-inline__max { color: #333333; }

      .metascore-badge--must-play { color: #00ff41; border-color: #00ff41; background: rgba(0,255,65,0.08); }
      .metascore-badge--great     { color: #00cc33; border-color: #00cc33; background: rgba(0,204,51,0.08); }
      .metascore-badge--good      { color: #ffaa00; border-color: #ffaa00; background: rgba(255,170,0,0.08); }
      .metascore-badge--mixed     { color: #ff6600; border-color: #ff6600; background: rgba(255,102,0,0.08); }
      .metascore-badge--weak      { color: #cc0000; border-color: #cc0000; background: rgba(204,0,0,0.08); }
      .metascore-badge--none      { color: #333333; border-color: #1a1a1a; background: transparent; }

      .metascore-block--must-play { border-left-color: #00ff41; }
      .metascore-block--great     { border-left-color: #00cc33; }
      .metascore-block--good      { border-left-color: #ffaa00; }
      .metascore-block--mixed     { border-left-color: #ff6600; }
      .metascore-block--weak      { border-left-color: #cc0000; }
      .metascore-block--none      { border-left-color: #1a1a1a; }
    `;
    document.head.appendChild(style);
  }

  function getLabel(score) {
    return getTierMeta(score).label;
  }

  function getColor(score) {
    return getTierMeta(score).color;
  }

  function getTier(score) {
    return getTierMeta(score).tier;
  }

  function renderBadge(score, size) {
    ensureStyles();
    const meta = getTierMeta(score);
    const badge = createElement('span', `metascore-badge metascore-badge--${meta.tier} metascore-badge--${size || 'normal'}`);
    badge.textContent = meta.score === null ? '—' : String(meta.score);
    return badge;
  }

  function renderBlock(score) {
    ensureStyles();
    const meta = getTierMeta(score);
    const block = createElement('div', `metascore-block metascore-block--${meta.tier}`);
    const label = createElement('div', 'metascore-block__label', 'METASCORE');
    const row = createElement('div', 'metascore-block__row');
    const scoreNode = createElement('span', 'metascore-block__score', meta.score === null ? '—' : String(meta.score));
    const tierNode = createElement('span', 'metascore-block__tier', meta.label);
    const bar = createElement('div', 'metascore-block__bar');
    const fill = createElement('div', 'metascore-block__bar-fill');
    const note = createElement(
      'div',
      'metascore-block__note',
      meta.score === null ? 'Note presse indisponible' : 'Note presse · critique aggregate'
    );

    scoreNode.style.color = meta.color;
    tierNode.style.color = meta.color;
    fill.style.width = `${meta.score || 0}%`;
    fill.style.background = meta.color;

    row.appendChild(scoreNode);
    row.appendChild(tierNode);
    bar.appendChild(fill);
    block.appendChild(label);
    block.appendChild(row);
    block.appendChild(bar);
    block.appendChild(note);
    return block;
  }

  function renderInline(score) {
    ensureStyles();
    const meta = getTierMeta(score);
    if (meta.score === null) return null;
    const line = createElement('span', `metascore-inline metascore-inline--${meta.tier}`);
    line.appendChild(createElement('span', 'metascore-inline__num', String(meta.score)));
    line.appendChild(createElement('span', 'metascore-inline__sep', '/'));
    line.appendChild(createElement('span', 'metascore-inline__max', '100'));
    return line;
  }

  window.RetroDexMetascore = {
    getLabel,
    getColor,
    getTier,
    renderBadge,
    renderBlock,
    renderInline
  };
})();
