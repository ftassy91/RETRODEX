/* ============================================================
   codec.js — BAZ-C Codec: MGS-style dialog with two portraits
   BAZ (terminal) left, User (silhouette) right, text below
   ============================================================ */

;(function () {
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

  // Build DOM — MGS Codec layout
  var codec = document.createElement('div')
  codec.id = 'rdx-codec'
  codec.innerHTML = [
    '<div class="codec-portraits">',
    '  <div class="codec-avatar codec-avatar-baz">',
    '    <img src="/assets/baz/baz.svg" alt="BAZ" width="64" height="64" />',
    '    <span class="codec-label">BAZ</span>',
    '  </div>',
    '  <div class="codec-avatar codec-avatar-user">',
    '    <img src="/assets/baz/user-bust.svg" alt="TOI" width="64" height="64" />',
    '    <span class="codec-label">TOI</span>',
    '  </div>',
    '</div>',
    '<hr class="codec-separator" />',
    '<div class="codec-text"><span class="codec-typewriter"></span></div>',
  ].join('\n')
  document.body.appendChild(codec)

  var typewriterEl = codec.querySelector('.codec-typewriter')
  var bazImg = codec.querySelector('.codec-avatar-baz img')
  var userImg = codec.querySelector('.codec-avatar-user img')
  var isOpen = false
  var typewriterTimer = null
  var autoDismissTimer = null
  var queue = []
  var lastReplyKey = null

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

  // State management — toggle SVG states via classes on BAZ img
  function setBazState(state) {
    codec.classList.remove('codec-idle', 'codec-talk', 'codec-content')
    codec.classList.add('codec-' + state)

    // Toggle SVG internal states (for inline SVG rendering)
    if (bazImg && bazImg.contentDocument) {
      var doc = bazImg.contentDocument
      var idle = doc.querySelector('.baz-idle')
      var talk = doc.querySelector('.baz-talk')
      var content = doc.querySelector('.baz-content')
      if (idle) idle.style.display = state === 'idle' ? 'block' : 'none'
      if (talk) talk.style.display = state === 'talk' ? 'block' : 'none'
      if (content) content.style.display = state === 'content' ? 'block' : 'none'
    }
  }

  // Typewriter effect
  function typewrite(text, done) {
    clearInterval(typewriterTimer)
    typewriterEl.textContent = ''
    typewriterEl.classList.remove('done')
    var i = 0
    typewriterTimer = setInterval(function () {
      typewriterEl.textContent += text[i++]
      if (i >= text.length) {
        clearInterval(typewriterTimer)
        typewriterTimer = null
        typewriterEl.classList.add('done')
        if (done) done()
      }
    }, 30)
  }

  function showMessage(text, duration, isContent) {
    duration = duration || 5000
    clearTimeout(autoDismissTimer)
    clearInterval(typewriterTimer)

    var resolved = text.replace('__SESSION__', getLastSession())

    // Open codec
    isOpen = true
    codec.classList.remove('codec-closing')
    codec.classList.add('codec-open')

    if (isContent) {
      // Content state: checkmark for 2s, then speak
      setBazState('content')
      setTimeout(function () {
        setBazState('talk')
        typewrite(resolved, function () {
          setBazState('idle')
          autoDismissTimer = setTimeout(function () {
            closeCodec()
            processQueue()
          }, duration)
        })
      }, 2000)
    } else {
      // Normal: talk while typing
      setBazState('talk')
      typewrite(resolved, function () {
        setBazState('idle')
        autoDismissTimer = setTimeout(function () {
          closeCodec()
          processQueue()
        }, duration)
      })
    }
  }

  function closeCodec() {
    if (!isOpen) return
    isOpen = false
    clearTimeout(autoDismissTimer)
    clearInterval(typewriterTimer)
    codec.classList.remove('codec-open')
    codec.classList.add('codec-closing')
    setBazState('idle')
    setTimeout(function () {
      codec.classList.remove('codec-closing')
    }, 300)
  }

  function processQueue() {
    if (!queue.length) return
    var next = queue.shift()
    setTimeout(function () { showMessage(next.text, next.duration, next.isContent) }, 400)
  }

  // Public API
  function say(textOrContext, duration, isContent) {
    var text = REPLIES[textOrContext]
      ? pickReply(textOrContext)
      : String(textOrContext || '')
    if (!text) return

    if (isOpen) {
      queue.push({ text: text, duration: duration || 5000, isContent: !!isContent })
    } else {
      showMessage(text, duration || 5000, !!isContent)
    }
  }

  // [C] keyboard toggle
  function toggle() {
    if (isOpen) {
      closeCodec()
      queue = []
    } else {
      var context = resolvePageContext()
      showMessage(pickReply(context), 6000)
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
      closeCodec()
      queue = []
    }
  })

  // Click to dismiss
  codec.addEventListener('click', function () {
    closeCodec()
    queue = []
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

  // Auto-trigger once per session per page
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

  window.BAZ = { say: say, close: closeCodec }
})()
