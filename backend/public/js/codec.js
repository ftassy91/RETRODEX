/* ============================================================
   codec.js — BAZ-C Codec: MGS-style dialog with two portraits
   BAZ (terminal) left, User (silhouette) right, text below
   ============================================================ */

;(function () {
  /* --------------------------------------------------------
     USER INPUT — Pattern matching + response pools
     -------------------------------------------------------- */
  var USER_PATTERNS = [
    // Collection queries
    { keywords: ['combien', 'jeux', 'collection'], response: 'collection_count', weight: 3 },
    { keywords: ['valeur', 'vaut', 'prix', 'total'], response: 'collection_value_query', weight: 2 },
    { keywords: ['rare', 'rares', 'rarete'], response: 'rare_query', weight: 2 },
    { keywords: ['dernier', 'recent', 'ajout'], response: 'recent_add', weight: 2 },
    // System queries
    { keywords: ['aide', 'help', 'quoi', 'faire'], response: 'help', weight: 2 },
    { keywords: ['qui', 'es-tu', 'baz', 'toi'], response: 'identity', weight: 3 },
    { keywords: ['salut', 'bonjour', 'hey', 'yo'], response: 'greeting', weight: 1 },
    { keywords: ['merci', 'thanks', 'cool'], response: 'thanks', weight: 1 },
    // Market queries
    { keywords: ['marche', 'market', 'tendance'], response: 'market_query', weight: 2 },
    { keywords: ['console', 'systeme', 'plateforme'], response: 'console_query', weight: 2 },
    // Easter eggs (exact = all keywords required)
    { keywords: ['metal', 'gear'], response: 'easter_mgs', weight: 5, exact: true },
    { keywords: ['snake'], response: 'easter_mgs', weight: 5, exact: true },
    { keywords: ['konami', 'code'], response: 'easter_konami', weight: 5, exact: true },
    { keywords: ['fhtagn'], response: 'easter_lovecraft', weight: 5, exact: true },
    { keywords: ['barrel', 'roll'], response: 'easter_barrel', weight: 5, exact: true },
  ]

  var USER_REPLIES = {
    collection_count: [
      'Hmm. 507 references. 16 consoles. C\'est pas rien.',
      'Dernier comptage : 507. Ca grimpe.',
    ],
    collection_value_query: [
      'Ouvre RETROMARKET. Les chiffres sont la.',
      'La valeur, c\'est pas juste un prix. C\'est un etat, une region, une boite.',
    ],
    rare_query: [
      'Les raretees ne se trouvent pas en cherchant "rare". Filtre par prix, tu verras.',
      'Hmm. Regarde les jeux sans prix marche. C\'est souvent la que se cachent les vrais.',
    ],
    recent_add: [
      'Consulte ta collection. Les derniers ajouts sont en haut.',
    ],
    help: [
      'Tape un mot-cle. Collection, valeur, marche, console. Je fais le reste.',
      'Je suis BAZ. Je lis ta collection. Pose une question simple.',
    ],
    identity: [
      'BAZ. Terminal companion. Je surveille tes cartouches depuis le debut.',
      'Je suis le systeme. Tu es l\'operateur. On fait equipe.',
    ],
    greeting: [
      'Hmm. Salut.',
      'Operateur. Bienvenue.',
      'Yo.',
    ],
    thanks: [
      'Hmm.',
      'Normal.',
      'C\'est mon boulot.',
    ],
    market_query: [
      'Le marche bouge. Ouvre RETROMARKET pour les tendances.',
      '579 prix indexes. C\'est un debut.',
    ],
    console_query: [
      '16 consoles. De 1983 a 2005. L\'age d\'or.',
      'Quelle console ? Sois precis.',
    ],
    easter_mgs: [
      'Colonel, j\'ai un visuel sur la collection...',
      '! ... Hmm. Fausse alerte.',
      'Snake? SNAKE? SNAAAKE! ... Ah non, c\'est toi.',
    ],
    easter_konami: [
      'Haut haut bas bas gauche droite gauche droite B A. ... Non, ca marche pas ici.',
    ],
    easter_lovecraft: [
      'Ph\'nglui mglw\'nafh Cthulhu R\'lyeh wgah\'nagl fhtagn. ... C\'est pas dans la base.',
    ],
    easter_barrel: [
      'Hmm. Non.',
    ],
    fallback: [
      'Hmm. J\'ai pas compris. Essaie : collection, valeur, aide.',
      'Pas dans ma base. Reformule.',
      '... Hmm.',
      'Je suis un terminal, pas un devin. Sois plus precis.',
    ],
  }

  function matchUserInput(raw) {
    var input = raw.toLowerCase().trim()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    var bestMatch = null
    var bestScore = 0

    for (var i = 0; i < USER_PATTERNS.length; i++) {
      var pattern = USER_PATTERNS[i]
      var score = 0

      if (pattern.exact) {
        var allPresent = true
        for (var k = 0; k < pattern.keywords.length; k++) {
          if (input.indexOf(pattern.keywords[k]) === -1) {
            allPresent = false
            break
          }
        }
        if (allPresent) score = pattern.weight * pattern.keywords.length
      } else {
        for (var k = 0; k < pattern.keywords.length; k++) {
          if (input.indexOf(pattern.keywords[k]) !== -1) {
            score += pattern.weight
          }
        }
      }

      if (score > bestScore) {
        bestScore = score
        bestMatch = pattern.response
      }
    }

    if (bestScore < 1) return 'fallback'
    return bestMatch
  }

  function pickUserReply(key) {
    var pool = USER_REPLIES[key] || USER_REPLIES.fallback
    return pool[Math.floor(Math.random() * pool.length)]
  }

  /* --------------------------------------------------------
     BAZ contextual replies (existing)
     -------------------------------------------------------- */
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
    '<!-- Nier: corner brackets -->',
    '<div class="codec-bracket codec-bracket--tl"></div>',
    '<div class="codec-bracket codec-bracket--tr"></div>',
    '<div class="codec-bracket codec-bracket--bl"></div>',
    '<div class="codec-bracket codec-bracket--br"></div>',
    '<!-- Blade Runner: animated grain overlay -->',
    '<div class="codec-grain-overlay" aria-hidden="true"></div>',
    '<!-- Sofia: CRT vignette -->',
    '<div class="codec-vignette" aria-hidden="true"></div>',
    '<!-- Yuki: transmission glitch -->',
    '<div class="codec-glitch-overlay" aria-hidden="true"></div>',
    '<!-- MGS: freq label -->',
    '<span class="codec-freq-label">FREQ 141.80</span>',
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
    '<hr class="codec-separator codec-separator-input" />',
    '<div class="codec-input-row">',
    '  <span class="codec-input-prompt">&gt;</span>',
    '  <input type="text" class="codec-input" placeholder="Parle a BAZ..." maxlength="140" autocomplete="off" spellcheck="false" />',
    '  <span class="codec-thinking" aria-hidden="true">...</span>',
    '</div>',
  ].join('\n')
  document.body.appendChild(codec)

  var typewriterEl = codec.querySelector('.codec-typewriter')
  var codecInput = codec.querySelector('.codec-input')
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

  // User input handling
  var userInputBusy = false

  codecInput.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    e.stopPropagation()
    if (userInputBusy) return

    var raw = codecInput.value.trim()
    if (!raw) return

    codecInput.value = ''
    userInputBusy = true
    codec.classList.add('codec-user-waiting')

    // Resolve response — prefer baz-engine.js if loaded, fallback to inline
    function deliverResponse(responseText, state) {
      codec.classList.remove('codec-user-waiting')
      clearTimeout(autoDismissTimer)
      clearInterval(typewriterTimer)
      setBazState(state || 'talk')
      typewrite(responseText, function () {
        setBazState('idle')
        userInputBusy = false
        codecInput.focus()
        autoDismissTimer = setTimeout(function () {
          closeCodec()
          processQueue()
        }, 8000)
      })
    }

    if (window.BAZ && window.BAZ._askEngine) {
      // Use baz-engine.js (async, supports game title matching)
      window.BAZ._askEngine(raw).then(function (result) {
        deliverResponse(result.text, result.state || 'talk')
      }).catch(function () {
        deliverResponse(pickUserReply(matchUserInput(raw)))
      })
    } else {
      // Fallback: inline keyword matcher
      var thinkDelay = 800 + Math.floor(Math.random() * 700)
      setTimeout(function () {
        deliverResponse(pickUserReply(matchUserInput(raw)))
      }, thinkDelay)
    }
  })

  // Prevent click-to-dismiss when clicking the input area
  codec.querySelector('.codec-input-row').addEventListener('click', function (e) {
    e.stopPropagation()
  })

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

  // Irregular animation scheduler for BAZ idle
  // Reads CSS classes on the SVG to toggle between states
  function scheduleBazIdle() {
    var bazEl = codec.querySelector('.codec-avatar-baz img')
      || codec.querySelector('.codec-avatar-baz svg')
    if (!bazEl || !bazEl.contentDocument) return

    var doc = bazEl.contentDocument
    var idle = doc.querySelector('.baz-idle')
    var talk = doc.querySelector('.baz-talk')
    var content = doc.querySelector('.baz-content')

    // The SVG internal @keyframes handles the irregular blink
    // No additional JS scheduling needed for idle — CSS does it
  }

  window.BAZ = { say: say, close: closeCodec, input: codecInput }
})()
