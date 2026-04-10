/* ============================================================
   codec.js — Quiet Phosphor contextual banner
   Toggle with [C], close with [Escape]
   Reads DOM to build page-aware messages
   ============================================================ */

;(function () {
  // Inject styles
  var style = document.createElement('style')
  style.textContent = [
    '#rdx-codec {',
    '  position: fixed; bottom: 0; left: 0; right: 0;',
    '  background: rgba(0,0,0,0.92);',
    '  border-top: 1px solid var(--border, #1a2a1a);',
    '  padding: 8px 16px;',
    '  font-family: var(--font-ui, monospace);',
    '  font-size: 12px;',
    '  color: var(--text-muted, #4a8a54);',
    '  display: flex; align-items: center; gap: 12px;',
    '  z-index: 1000;',
    '  transform: translateY(100%);',
    '  transition: transform 150ms ease-out;',
    '  pointer-events: none;',
    '}',
    '#rdx-codec.open {',
    '  transform: translateY(0);',
    '  pointer-events: auto;',
    '}',
    '#rdx-codec .codec-label {',
    '  color: var(--accent, #00ff66);',
    '  font-weight: bold;',
    '  letter-spacing: 1px;',
    '  flex-shrink: 0;',
    '}',
    '#rdx-codec .codec-body { flex: 1; }',
    '#rdx-codec .codec-key {',
    '  color: var(--border, #1a2a1a);',
    '  flex-shrink: 0;',
    '  font-size: 10px;',
    '}'
  ].join('\n')
  document.head.appendChild(style)

  // Inject DOM
  var codec = document.createElement('div')
  codec.id = 'rdx-codec'
  codec.innerHTML = '<span class="codec-label">RDX</span><span class="codec-body"></span><span class="codec-key">[C]</span>'
  document.body.appendChild(codec)

  var bodyEl = codec.querySelector('.codec-body')
  var isOpen = false

  function toggle() {
    isOpen = !isOpen
    if (isOpen) {
      bodyEl.textContent = getCodecMessage()
      saveSession()
    }
    codec.classList.toggle('open', isOpen)
  }

  function close() {
    if (!isOpen) return
    isOpen = false
    codec.classList.remove('open')
  }

  // Keyboard
  document.addEventListener('keydown', function (e) {
    // Don't intercept when typing in inputs
    var tag = (e.target.tagName || '').toLowerCase()
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return

    if (e.key === 'c' || e.key === 'C') {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      e.preventDefault()
      toggle()
    }
    if (e.key === 'Escape') {
      close()
    }
  })

  // Page-aware messages
  function getCodecMessage() {
    var path = location.pathname

    if (path === '/' || path.includes('home')) {
      return 'Systeme nominal. Derniere session : ' + getLastSession() + '.'
    }

    if (path.includes('hub')) {
      var banner = document.getElementById('hub-curation-banner')
      var bannerText = banner ? banner.textContent.trim() : ''
      return bannerText || 'Hub operationnel. Derniere session : ' + getLastSession() + '.'
    }

    if (path.includes('game-detail')) {
      var title = (document.querySelector('.detail-hero-title, .page-title, h1') || {}).textContent || ''
      var tier = (document.querySelector('.trust-badge') || {}).textContent || ''
      return title.trim() + (tier ? ' \u00B7 ' + tier.trim() : '') + ' \u00B7 Donnees chargees.'
    }

    if (path.includes('collection')) {
      var total = (document.getElementById('stat-total') || {}).textContent || '0'
      var loose = (document.getElementById('stat-value-loose') || {}).textContent || '-'
      return 'Etagere : ' + total + ' jeux \u00B7 Valeur loose : ' + loose + ' \u00B7 Cockpit a jour.'
    }

    if (path.includes('stats')) {
      return 'Lecture experte. Selectionner un jeu pour demarrer.'
    }

    if (path.includes('games-list')) {
      var count = (document.querySelector('.page-subtitle, #catalog-curation-banner') || {}).textContent || ''
      return 'Index ouvert. ' + (count.trim() || 'Filtres disponibles.')
    }

    if (path.includes('consoles')) {
      return 'Archive consoles. Selectionner un support pour explorer.'
    }

    if (path.includes('franchises')) {
      return 'Franchises indexees. Heritage et reperes d univers.'
    }

    if (path.includes('encyclopedia')) {
      return 'Encyclopedie. Dossiers, equipes et lectures.'
    }

    if (path.includes('search')) {
      return 'Entree rapide. Viser juste, ouvrir une fiche.'
    }

    return 'RetroDex operationnel. Derniere session : ' + getLastSession() + '.'
  }

  // Session memory
  function saveSession() {
    try { localStorage.setItem('rdx-last-session', new Date().toISOString()) } catch (_) {}
  }

  function getLastSession() {
    try {
      var d = localStorage.getItem('rdx-last-session')
      if (!d) return 'premiere session'
      var diff = Date.now() - new Date(d).getTime()
      if (diff < 86400000) return "aujourd'hui"
      if (diff < 172800000) return 'hier'
      return new Date(d).toLocaleDateString('fr-FR')
    } catch (_) {
      return 'inconnue'
    }
  }

  // Save on first load
  saveSession()
})()
