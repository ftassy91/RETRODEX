'use strict'

;(() => {
  const COLORS = {
    'must-play': '#00ff41',
    great: '#00cc33',
    good: '#ffaa00',
    mixed: '#ff6600',
    weak: '#cc0000',
    none: '#333333',
  }

  const LABELS = {
    'must-play': 'MUST-PLAY',
    great: 'GREAT',
    good: 'GOOD',
    mixed: 'MIXED',
    weak: 'WEAK',
    none: 'NO SCORE',
  }

  function normalizeScore(score) {
    const value = Number(score)
    if (!Number.isFinite(value) || value < 1 || value > 100) {
      return null
    }
    return Math.round(value)
  }

  function getTier(score) {
    const value = normalizeScore(score)
    if (value == null) return 'none'
    if (value >= 90) return 'must-play'
    if (value >= 75) return 'great'
    if (value >= 60) return 'good'
    if (value >= 40) return 'mixed'
    return 'weak'
  }

  function getLabel(score) {
    return LABELS[getTier(score)]
  }

  function getColor(score) {
    return COLORS[getTier(score)]
  }

  function ensureStyles() {
    if (document.getElementById('retrodex-metascore-css')) return
    const style = document.createElement('style')
    style.id = 'retrodex-metascore-css'
    style.textContent = `
      .metascore-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-family: 'BigBlueTerminal', 'Courier New', monospace;
        font-weight: bold;
        letter-spacing: 0;
        border: 1px solid;
        flex-shrink: 0;
        border-radius: 0;
        image-rendering: pixelated;
        image-rendering: crisp-edges;
      }
      .metascore-badge--micro { width: 20px; height: 20px; font-size: 10px; line-height: 1; }
      .metascore-badge--normal { width: 28px; height: 28px; font-size: 13px; line-height: 1; }
      .metascore-badge--large { width: 36px; height: 36px; font-size: 15px; line-height: 1; }

      .metascore-block {
        padding: 10px 12px;
        border-left: 2px solid;
        background: #0d0d0d;
        margin-bottom: 8px;
      }
      .metascore-block__label {
        font-size: 9px;
        letter-spacing: 2px;
        color: #333333;
        font-family: 'BigBlueTerminal', 'Courier New', monospace;
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
        font-family: 'BigBlueTerminal', 'Courier New', monospace;
      }
      .metascore-block__tier {
        font-size: 10px;
        opacity: 0.8;
        font-family: 'BigBlueTerminal', 'Courier New', monospace;
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
        font-family: 'BigBlueTerminal', 'Courier New', monospace;
      }

      .metascore-inline {
        display: inline-flex;
        gap: 2px;
        align-items: baseline;
        font-family: 'BigBlueTerminal', 'Courier New', monospace;
        font-size: 11px;
      }
      .metascore-inline--must-play { color: #00ff41; }
      .metascore-inline--great { color: #00cc33; }
      .metascore-inline--good { color: #ffaa00; }
      .metascore-inline--mixed { color: #ff6600; }
      .metascore-inline--weak { color: #cc0000; }
      .metascore-inline__sep,
      .metascore-inline__max { color: #333333; }

      .metascore-badge--must-play { color: #00ff41; border-color: #00ff41; background: rgba(0,255,65,0.08); }
      .metascore-badge--great { color: #00cc33; border-color: #00cc33; background: rgba(0,204,51,0.08); }
      .metascore-badge--good { color: #ffaa00; border-color: #ffaa00; background: rgba(255,170,0,0.08); }
      .metascore-badge--mixed { color: #ff6600; border-color: #ff6600; background: rgba(255,102,0,0.08); }
      .metascore-badge--weak { color: #cc0000; border-color: #cc0000; background: rgba(204,0,0,0.08); }
      .metascore-badge--none { color: #333333; border-color: #1a1a1a; background: transparent; }

      .metascore-block--must-play { border-left-color: #00ff41; }
      .metascore-block--great { border-left-color: #00cc33; }
      .metascore-block--good { border-left-color: #ffaa00; }
      .metascore-block--mixed { border-left-color: #ff6600; }
      .metascore-block--weak { border-left-color: #cc0000; }
      .metascore-block--none { border-left-color: #1a1a1a; }
    `
    document.head.appendChild(style)
  }

  function applyTierColors(element, score) {
    const color = getColor(score)
    const scoreEl = element.querySelector('.metascore-block__score')
    const tierEl = element.querySelector('.metascore-block__tier')
    const fillEl = element.querySelector('.metascore-block__bar-fill')
    if (scoreEl) scoreEl.style.color = color
    if (tierEl) tierEl.style.color = color
    if (fillEl) fillEl.style.background = color
  }

  function renderBadge(score, size = 'normal') {
    ensureStyles()
    const value = normalizeScore(score)
    const tier = getTier(score)
    const badge = document.createElement('span')
    const sizeClass = ['micro', 'normal', 'large'].includes(size) ? size : 'normal'
    badge.className = `metascore-badge metascore-badge--${tier} metascore-badge--${sizeClass}`
    badge.textContent = value == null ? '—' : String(value)
    return badge
  }

  function renderBlock(score) {
    ensureStyles()
    const value = normalizeScore(score)
    const tier = getTier(score)
    const block = document.createElement('div')
    block.className = `metascore-block metascore-block--${tier}`
    block.innerHTML = `
      <div class="metascore-block__label">METASCORE</div>
      <div class="metascore-block__row">
        <span class="metascore-block__score">${value == null ? '—' : value}</span>
        <span class="metascore-block__tier">${getLabel(score)}</span>
      </div>
      <div class="metascore-block__bar">
        <div class="metascore-block__bar-fill" style="width:${value == null ? 0 : value}%"></div>
      </div>
      ${value == null ? '' : '<div class="metascore-block__note">Note presse · score agrege</div>'}
    `
    applyTierColors(block, score)
    return block
  }

  function renderInline(score) {
    ensureStyles()
    const value = normalizeScore(score)
    if (value == null) return null
    const tier = getTier(score)
    const line = document.createElement('span')
    line.className = `metascore-inline metascore-inline--${tier}`
    line.innerHTML = `
      <span class="metascore-inline__num">${value}</span>
      <span class="metascore-inline__sep">/</span>
      <span class="metascore-inline__max">100</span>
    `
    return line
  }

  if (document.head) {
    ensureStyles()
  } else {
    document.addEventListener('DOMContentLoaded', ensureStyles, { once: true })
  }

  window.RetroDexMetascore = {
    getLabel,
    getColor,
    getTier,
    renderBadge,
    renderBlock,
    renderInline,
  }
})()
