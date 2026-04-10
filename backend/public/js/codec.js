/* ============================================================
   codec.js — BAZ Codec: contextual companion for RetroDex
   Toggle with [C], auto-triggered on events, queue system
   ============================================================ */

;(function () {
  // Reply catalog — 3-5 per context, BAZ voice guide compliant
  var REPLIES = {
    welcome: [
      'Bon retour. Ta collection t\'attendait.',
      'Hmm. Voyons ce qui a bouge.',
      'Toujours la. Comme tes cartouches.',
    ],
    game_open: [
      'Donnees chargees.',
      'Hmm. Voyons ca.',
      'Tiens. Regardons de plus pres.',
    ],
    game_enriched: [
      'Pas mal. Y a de la matiere.',
      'Fiche riche. Prends le temps.',
      'Hmm. Ca merite une lecture.',
    ],
    collection_add: [
      'Un de plus sur l\'etagere. Pas mal.',
      'Note. Bien joue.',
      'Bien joue. C\'est comme ca qu\'on construit.',
    ],
    collection_value: [
      'Les chiffres sont la. Prends le temps de les lire.',
      'Ta collection vaut ce qu\'elle vaut. Le marche dira le reste.',
      'Hmm. Ca bouge.',
    ],
    rare_game: [
      'Tiens. Celui-la ne se trouve pas tous les jours.',
      'Un jeu comme ca, tu le gardes ou tu le vends. Pas de demi-mesure.',
    ],
    idle: [
      'Ca faisait un moment. Tes jeux n\'ont pas bouge.',
      'Hmm. Le marche, lui, a continue sans toi.',
    ],
    hub: [
      'Systeme nominal. Derniere session : __SESSION__.',
      'Hmm. Par ou on commence.',
      'Tout est la. A toi de jouer.',
    ],
    index: [
      'Index ouvert. Filtres disponibles.',
      'Cherche, filtre, ouvre. Dans cet ordre.',
    ],
    stats: [
      'Lecture experte. Selectionner un jeu pour demarrer.',
      'Les donnees de reference sont la.',
    ],
    default: [
      'RetroDex operationnel.',
      'Hmm.',
      'Toujours la.',
    ],
  }

  // Styles
  var style = document.createElement('style')
  style.textContent = [
    '#rdx-codec {',
    '  position: fixed; bottom: 0; left: 0; right: 0;',
    '  background: rgba(0,0,0,0.94);',
    '  border-top: 1px solid var(--border, #1a2a1a);',
    '  padding: 10px 16px;',
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
    '#rdx-codec .codec-sprite {',
    '  width: 28px; height: 28px;',
    '  color: var(--accent, #00ff66);',
    '  flex-shrink: 0;',
    '  opacity: 0.9;',
    '}',
    '#rdx-codec .codec-body {',
    '  flex: 1;',
    '  min-height: 16px;',
    '}',
    '#rdx-codec .codec-key {',
    '  color: var(--border, #1a2a1a);',
    '  flex-shrink: 0;',
    '  font-size: 9px;',
    '}',
  ].join('\n')
  document.head.appendChild(style)

  // DOM
  var codec = document.createElement('div')
  codec.id = 'rdx-codec'
  codec.innerHTML = [
    '<img class="codec-sprite" src="/assets/baz/baz.svg" alt="BAZ" width="28" height="28" />',
    '<span class="codec-body"></span>',
    '<span class="codec-key">[C]</span>',
  ].join('')
  document.body.appendChild(codec)

  var bodyEl = codec.querySelector('.codec-body')
  var isOpen = false
  var typewriterTimer = null
  var autoDismissTimer = null
  var queue = []
  var lastReplyKey = null

  // Pick a reply — avoid repeating the same one
  function pickReply(context) {
    var pool = REPLIES[context] || REPLIES.default
    if (pool.length <= 1) return pool[0] || ''
    var pick
    do {
      pick = pool[Math.floor(Math.random() * pool.length)]
    } while (pick === lastReplyKey && pool.length > 1)
    lastReplyKey = pick
    return pick
  }

  // Typewriter effect
  function typewrite(text, done) {
    clearInterval(typewriterTimer)
    bodyEl.textContent = ''
    var i = 0
    typewriterTimer = setInterval(function () {
      bodyEl.textContent += text[i++]
      if (i >= text.length) {
        clearInterval(typewriterTimer)
        typewriterTimer = null
        if (done) done()
      }
    }, 25)
  }

  // Show a message
  function showMessage(text, duration) {
    duration = duration || 5000
    clearTimeout(autoDismissTimer)
    clearInterval(typewriterTimer)

    var resolved = text.replace('__SESSION__', getLastSession())
    isOpen = true
    codec.classList.add('open')

    typewrite(resolved, function () {
      autoDismissTimer = setTimeout(function () {
        close()
        processQueue()
      }, duration)
    })
  }

  function close() {
    if (!isOpen) return
    isOpen = false
    clearTimeout(autoDismissTimer)
    clearInterval(typewriterTimer)
    codec.classList.remove('open')
  }

  function processQueue() {
    if (!queue.length) return
    var next = queue.shift()
    setTimeout(function () { showMessage(next.text, next.duration) }, 300)
  }

  // Public API: BAZ.say(text, duration) or BAZ.say(context)
  function say(textOrContext, duration) {
    var text = REPLIES[textOrContext]
      ? pickReply(textOrContext)
      : String(textOrContext || '')
    if (!text) return

    if (isOpen) {
      queue.push({ text: text, duration: duration || 5000 })
    } else {
      showMessage(text, duration || 5000)
    }
  }

  // [C] keyboard toggle — manual override
  function toggle() {
    if (isOpen) {
      close()
      queue = []
    } else {
      var context = resolvePageContext()
      showMessage(pickReply(context), 8000)
    }
  }

  function resolvePageContext() {
    var path = location.pathname
    if (path === '/' || path.includes('home') || path.includes('hub')) return 'hub'
    if (path.includes('game-detail')) return 'game_open'
    if (path.includes('collection')) return 'collection_value'
    if (path.includes('stats')) return 'stats'
    if (path.includes('games-list')) return 'index'
    return 'default'
  }

  // Keyboard
  document.addEventListener('keydown', function (e) {
    var tag = (e.target.tagName || '').toLowerCase()
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return
    if (e.key === 'c' || e.key === 'C') {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      e.preventDefault()
      toggle()
    }
    if (e.key === 'Escape') {
      close()
      queue = []
    }
  })

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

  // Auto-trigger: welcome on collection page (once per session)
  function autoTrigger() {
    var path = location.pathname
    var sessionKey = 'rdx-baz-' + path

    if (sessionStorage.getItem(sessionKey)) return
    sessionStorage.setItem(sessionKey, '1')

    if (path.includes('collection')) {
      setTimeout(function () { say('welcome', 4000) }, 2000)
    } else if (path.includes('game-detail')) {
      setTimeout(function () { say('game_open', 3000) }, 1500)
    }
  }

  saveSession()
  setTimeout(autoTrigger, 500)

  // Expose global API
  window.BAZ = { say: say, close: close }
})()
