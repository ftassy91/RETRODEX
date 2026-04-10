/* ============================================================
   baz-engine.js — BAZ Conversation Engine
   Scripted intent parser + response catalog for codec input bar.
   No AI API. Pure pattern matching + curated replies.
   Requires: codec.js loaded first (window.BAZ.say, .close)
             api.js loaded first (window.RetroDexApi.fetchJson)
   ============================================================ */

;(function () {
  'use strict'

  // ── Response Catalog ──────────────────────────────────────
  // All replies: calm, ironic, concise. No "!". Max 140 chars.

  var RESPONSES = {
    greeting: [
      'Hmm. Salut.',
      'Tiens. Te voila.',
      'Encore toi. Bien.',
      'Salut. Le systeme tourne.',
      'Ah. Quelqu\'un utilise le terminal.',
    ],
    farewell: [
      'A plus.',
      'Hmm. Reviens quand tu veux.',
      'Fin de transmission.',
    ],
    help: [
      'Jeux, prix, rarete, collection, achat, vente, region, import CSV. Ou juste un nom de jeu.',
      'Demande-moi un prix, une rarete, un conseil achat/vente. Ou tape un titre.',
      '/help, /about, /konami. Sinon parle : prix, vendre, acheter, tendance, region, stats...',
    ],
    about_baz: [
      'BAZ. Terminal de bord. Pas une IA, juste un script avec du caractere.',
      'Je suis le codec de RetroDex. Moins utile que Clippy, plus honnete.',
      'Un programme. Pas de sentiments. Juste des donnees et de l\'ironie.',
    ],
    price_query: [
      'Les prix bougent. Le marche ne dort jamais, meme si toi oui.',
      'Consulte la fiche du jeu. Les chiffres sont la-bas.',
      'Hmm. Ouvre la fiche, section prix. C\'est plus fiable que moi.',
      'Le prix depend de l\'etat, la region, le marche. Rien de simple.',
      'Va sur la page du jeu. Les donnees marche y sont.',
    ],
    rare_query: [
      'Rare ne veut pas dire cher. Mais souvent, si.',
      'La rarete, c\'est relatif. Ce qui compte c\'est la demande.',
      'Hmm. Filtre par rarete dans l\'index. Tu verras.',
    ],
    game_comment: [
      '__GAME__. Hmm. Pas mal comme choix.',
      '__GAME__. Ouvre la fiche pour les details.',
      '__GAME__. Je vois que tu as du gout.',
      '__GAME__. Un classique. Ou pas. Verifie toi-meme.',
      '__GAME__. Tape le nom dans la recherche pour la fiche complete.',
    ],
    collection_query: [
      'Ta collection est dans l\'onglet Collection. Logique.',
      'Les stats sont la. Nombre de jeux, valeur, repartition. Tout est calcule.',
      'Hmm. Va dans Collection. C\'est la que tout se passe.',
    ],
    console_query: [
      'Chaque console a sa page. Cherche dans l\'index.',
      'Hmm. 16 consoles referensees. Laquelle t\'interesse.',
      'Les consoles sont dans la section dediee. Filtre par generation.',
    ],
    condition_query: [
      'L\'etat change tout. CIB vaut plus que loose. Toujours.',
      'Complet en boite, notice, jeu. C\'est le graal du collectionneur.',
      'Hmm. L\'etat est note sur chaque fiche. Regarde la.',
    ],
    // ── Questions frequentes ──
    what_is_retrodex: [
      'RetroDex. Un systeme de gestion pour ta collection retro. Pas un wiki, pas un guide de prix. Un outil.',
      'Ton etagere de jeux, numerisee. Avec des prix, des signaux d\'achat/vente, et moi.',
      'Un cockpit de collectionneur. Tu inspectes, qualifies, mesures, decides, evolues.',
    ],
    how_to_use: [
      'Commence par l\'index. Ouvre une fiche. Ajoute a ta collection. Le reste suit.',
      'Cherche un jeu. Regarde son prix. Ajoute-le. Le cockpit collection fait le reste.',
      'Hmm. Explore l\'index, consulte les fiches, gere ta collection. Dans cet ordre.',
    ],
    whats_new: [
      'Les prix bougent tous les jours. Ta collection aussi, si tu t\'en occupes.',
      'Hmm. Regarde la courbe d\'evolution dans ta collection. Les chiffres parlent.',
      'Le systeme s\'enrichit. Plus de fiches, plus de prix, plus de donnees marche.',
    ],
    stats_query: [
      'Nombre de jeux, valeur loose, CIB, delta. Tout est dans le cockpit collection.',
      'Tes stats sont dans l\'onglet Collection. Les chiffres en haut. Pas besoin de moi.',
      'Hmm. Ouvre ta collection. Les compteurs sont la.',
    ],
    recommendation: [
      'Je ne recommande pas. Je montre les donnees, tu decides.',
      'Hmm. Filtre par Metascore et rarete dans l\'index. Le meilleur, c\'est subjectif.',
      'Le meilleur jeu c\'est celui que tu cherches depuis 10 ans. Pas celui que je te dis.',
      'Trie par Metascore dans l\'index. Mais le score ne fait pas tout.',
    ],
    buy_advice: [
      'Regarde le prix loose, compare avec ton budget, decide. Pas plus complique.',
      'Hmm. La section A SAISIR dans le cockpit collection montre les opportunites.',
      'Le marche est la. Les prix aussi. La decision, c\'est toi.',
      'Verifie le tier de confiance avant d\'acheter. LOW = donnees limitees.',
    ],
    sell_advice: [
      'Si le loose depasse 1.5x ton prix d\'achat, c\'est un signal de vente.',
      'Le cockpit collection a une section A VENDRE. Regarde la.',
      'Hmm. Vendre c\'est une decision. Les donnees sont la, le timing c\'est toi.',
    ],
    capabilities: [
      'Je connais les jeux, les prix, ta collection. Je ne connais pas l\'avenir.',
      'Je reponds aux questions sur les jeux, les prix, la rarete. Je fais de l\'ironie aussi.',
      'Hmm. /help pour la liste. En gros : jeux, prix, collection, et quelques surprises.',
    ],
    thanks: [
      'Hmm. De rien.',
      'Pas de quoi. C\'est mon boulot.',
      'Note.',
      'Normal.',
    ],
    identity: [
      'BAZ. Terminal de bord de RetroDex. Ici depuis le premier commit.',
      'Je suis un script. Mais un script avec des opinions.',
      'Hmm. BAZ. Pas un chatbot. Pas une IA. Juste ton interface.',
      'Qui je suis. Bonne question. Tape /about pour la version officielle.',
    ],
    data_quality: [
      'Chaque jeu a un tier de confiance. HIGH = verifie. LOW = indicatif. UNKNOWN = pas de donnees.',
      'Les prix viennent de PriceCharting et eBay. La fiabilite depend du nombre de sources.',
      'Hmm. Les losanges sur les fiches montrent la confiance. Plus y en a, mieux c\'est.',
    ],
    import_info: [
      'Tu as un CSV ? Bouton Importer dans la page Collection. Titre, console, etat, prix.',
      'L\'import CSV est la. Format : titre, console, condition, prix_paye, region.',
      'Hmm. Importer CSV dans Collection. Ca matche les titres avec le catalogue.',
    ],
    market_trend: [
      'Les tendances sont dans l\'historique des prix sur chaque fiche.',
      'Hmm. Le retro monte en general. Mais chaque jeu a son histoire.',
      'Consulte la section Evolution sur les fiches. Les courbes parlent.',
      'Le marche retro est cyclique. Ce qui monte redescend. Et inversement.',
    ],
    completeness: [
      'Ta completude est dans le cockpit. Barre en bas. N jeux sur le total.',
      'Hmm. La section A QUALIFIER montre ce qu\'il te reste a documenter.',
      'Qualification = completude + confiance + region. Les trois comptent.',
    ],
    region_info: [
      'PAL, NTSC-U, NTSC-J. La region change le prix, parfois du simple au triple.',
      'Europe = PAL. Japon = NTSC-J. US = NTSC-U. Chaque marche a ses prix.',
      'Hmm. La region est un champ de ta collection. Renseigne-la, ca affine la valeur.',
    ],
    unknown: [
      'Hmm. Pas compris. Essaie autrement.',
      'Je n\'ai pas de reponse pour ca. Essaie un nom de jeu ou /help.',
      'Ca depasse mes competences. Et elles sont limitees.',
      'Reformule. Ou tape /help.',
      'Signal non reconnu. Tape /help pour voir ce que je sais faire.',
    ],

    // ── Easter eggs ──
    easter_konami: [
      'Haut haut bas bas gauche droite gauche droite B A. Hmm. Ca ne marche pas ici.',
    ],
    easter_clippy: [
      'On dirait que tu essaies d\'utiliser un assistant. Besoin d\'aide avec ca.',
    ],
    easter_kojima: [
      'Kept you waiting, huh. Hmm. Kojima approuverait ce terminal.',
    ],
    easter_nintendo: [
      'C\'est dangereux d\'aller seul. Prends cette base de donnees.',
    ],
    easter_snake: [
      'Colonel, je suis dans un terminal retro. Les donnees sont partout.',
    ],
    easter_42: [
      '42. La reponse a tout. Sauf au prix de Panzer Dragoon Saga.',
    ],
  }

  // ── Intent Definitions ────────────────────────────────────

  var EXACT_COMMANDS = {
    '/help': 'help',
    '/aide': 'help',
    '/about': 'about_baz',
    '/baz': 'about_baz',
    '/konami': 'easter_konami',
  }

  var EASTER_EGGS = [
    { pattern: /konami\s*code/i, intent: 'easter_konami' },
    { pattern: /up\s*up\s*down\s*down/i, intent: 'easter_konami' },
    { pattern: /haut\s*haut\s*bas\s*bas/i, intent: 'easter_konami' },
    { pattern: /clippy/i, intent: 'easter_clippy' },
    { pattern: /trombone/i, intent: 'easter_clippy' },
    { pattern: /kojima/i, intent: 'easter_kojima' },
    { pattern: /metal\s*gear/i, intent: 'easter_snake' },
    { pattern: /snake/i, intent: 'easter_snake' },
    { pattern: /it\'?s\s*dangerous/i, intent: 'easter_nintendo' },
    { pattern: /c\'?est\s*dangereux/i, intent: 'easter_nintendo' },
    { pattern: /link|zelda/i, intent: 'easter_nintendo' },
    { pattern: /^42$/i, intent: 'easter_42' },
    { pattern: /sens\s*de\s*la\s*vie/i, intent: 'easter_42' },
  ]

  var GREETING_PATTERNS = /^(salut|bonjour|hello|hey|yo|coucou|wesh|bonsoir|hi|sup)\b/i
  var FAREWELL_PATTERNS = /^(bye|au\s*revoir|a\s*plus|ciao|adieu|a\+|salut)\s*$/i

  var KEYWORD_INTENTS = [
    // Product questions
    { keywords: ['c\'est quoi', 'qu\'est-ce que', 'retrodex c\'est', 'a quoi sert', 'le but'], intent: 'what_is_retrodex' },
    { keywords: ['comment ca marche', 'comment utiliser', 'comment faire', 'tuto', 'guide', 'mode d\'emploi'], intent: 'how_to_use' },
    { keywords: ['quoi de neuf', 'nouveaute', 'mise a jour', 'update', 'changelog'], intent: 'whats_new' },
    { keywords: ['tu fais quoi', 'tes fonctions', 'tu sers a quoi', 'tu peux faire', 'what can you'], intent: 'capabilities' },
    { keywords: ['qui es-tu', 'tu es qui', 'ton nom', 'who are you', 'your name'], intent: 'identity' },
    { keywords: ['merci', 'thanks', 'thank you', 'cool', 'genial', 'super', 'parfait', 'bien joue'], intent: 'thanks' },
    // Market & prices
    { keywords: ['prix', 'valeur', 'cher', 'combien', 'cout', 'cote', 'price', 'worth', 'argent', 'euro'], intent: 'price_query' },
    { keywords: ['rare', 'rarete', 'introuvable', 'pepite', 'graal'], intent: 'rare_query' },
    { keywords: ['tendance', 'evolution', 'monte', 'baisse', 'marche', 'trend', 'hausse'], intent: 'market_trend' },
    { keywords: ['confiance', 'fiable', 'fiabilite', 'qualite', 'tier', 'donnees'], intent: 'data_quality' },
    // Collection
    { keywords: ['collection', 'ma collection', 'mes jeux', 'inventaire', 'etagere'], intent: 'collection_query' },
    { keywords: ['combien de jeux', 'nombre de jeux', 'stats', 'statistiques', 'total'], intent: 'stats_query' },
    { keywords: ['completude', 'complet', 'manque', 'il me manque', 'progression', 'avancement'], intent: 'completeness' },
    { keywords: ['import', 'csv', 'importer', 'exporter', 'export'], intent: 'import_info' },
    // Buying & selling
    { keywords: ['acheter', 'achat', 'ou acheter', 'buy', 'trouver', 'chercher a acheter', 'opportunite'], intent: 'buy_advice' },
    { keywords: ['vendre', 'vente', 'revendre', 'sell', 'a vendre'], intent: 'sell_advice' },
    { keywords: ['meilleur', 'top', 'recommandation', 'conseil', 'suggestion', 'incontournable', 'must have'], intent: 'recommendation' },
    // Technical
    { keywords: ['console', 'megadrive', 'snes', 'nes', 'gameboy', 'playstation', 'saturn', 'dreamcast', 'n64', 'master system', 'pc engine', 'neo geo', 'game gear', 'lynx'], intent: 'console_query' },
    { keywords: ['etat', 'condition', 'cib', 'loose', 'mint', 'boite', 'notice', 'scelle'], intent: 'condition_query' },
    { keywords: ['region', 'pal', 'ntsc', 'japonais', 'europeen', 'americain', 'import'], intent: 'region_info' },
  ]

  // ── Game Title Cache ──────────────────────────────────────

  var gameCache = {
    titles: null,       // Map<lowercase_title, { id, title, console_name }>
    loadedAt: 0,
    ttl: 5 * 60 * 1000, // 5 min cache
    loading: null,
  }

  function loadGameTitles() {
    var now = Date.now()
    if (gameCache.titles && (now - gameCache.loadedAt) < gameCache.ttl) {
      return Promise.resolve(gameCache.titles)
    }
    if (gameCache.loading) return gameCache.loading

    gameCache.loading = window.RetroDexApi.fetchJson('/api/games?limit=600')
      .then(function (payload) {
        var items = Array.isArray(payload) ? payload
          : Array.isArray(payload.items) ? payload.items
          : Array.isArray(payload.games) ? payload.games
          : []
        var map = new Map()
        items.forEach(function (g) {
          if (g && g.title) {
            map.set(g.title.toLowerCase(), {
              id: g.id,
              title: g.title,
              console_name: g.console_name || g.consoleName || '',
            })
          }
        })
        gameCache.titles = map
        gameCache.loadedAt = Date.now()
        gameCache.loading = null
        return map
      })
      .catch(function () {
        gameCache.loading = null
        return new Map()
      })

    return gameCache.loading
  }

  // ── Fuzzy Match ───────────────────────────────────────────
  // Levenshtein distance for typo tolerance

  function levenshtein(a, b) {
    if (a.length === 0) return b.length
    if (b.length === 0) return a.length
    var matrix = []
    for (var i = 0; i <= b.length; i++) matrix[i] = [i]
    for (var j = 0; j <= a.length; j++) matrix[0][j] = j
    for (i = 1; i <= b.length; i++) {
      for (j = 1; j <= a.length; j++) {
        var cost = b[i - 1] === a[j - 1] ? 0 : 1
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        )
      }
    }
    return matrix[b.length][a.length]
  }

  function findGameMatch(text, titles) {
    var input = text.toLowerCase().trim()
    if (!titles || titles.size === 0) return null

    // 1. Exact match
    if (titles.has(input)) {
      return { game: titles.get(input), confidence: 1.0 }
    }

    // 2. Substring containment: check if any title appears in the input
    var bestSubstring = null
    var bestLen = 0
    titles.forEach(function (data, key) {
      if (key.length >= 3 && input.indexOf(key) !== -1 && key.length > bestLen) {
        bestSubstring = data
        bestLen = key.length
      }
    })
    if (bestSubstring) {
      return { game: bestSubstring, confidence: 0.85 }
    }

    // 3. Check if input appears inside a title (user typed partial name)
    if (input.length >= 4) {
      var bestPartial = null
      var bestPartialLen = Infinity
      titles.forEach(function (data, key) {
        if (key.indexOf(input) !== -1 && key.length < bestPartialLen) {
          bestPartial = data
          bestPartialLen = key.length
        }
      })
      if (bestPartial) {
        return { game: bestPartial, confidence: 0.7 }
      }
    }

    // 4. Fuzzy match (Levenshtein) for short inputs resembling a title
    if (input.length >= 4) {
      var bestFuzzy = null
      var bestDist = Infinity
      var maxDist = Math.max(2, Math.floor(input.length * 0.3))
      titles.forEach(function (data, key) {
        var dist = levenshtein(input, key)
        if (dist < bestDist && dist <= maxDist) {
          bestDist = dist
          bestFuzzy = data
        }
      })
      if (bestFuzzy) {
        var confidence = Math.max(0.3, 1 - (bestDist / Math.max(input.length, 1)))
        return { game: bestFuzzy, confidence: confidence }
      }
    }

    return null
  }

  // ── Reply Picker ──────────────────────────────────────────

  var lastReplies = {}

  function pickReply(intent) {
    var pool = RESPONSES[intent] || RESPONSES.unknown
    if (pool.length <= 1) return pool[0] || ''
    var last = lastReplies[intent]
    var pick
    var tries = 0
    do {
      pick = pool[Math.floor(Math.random() * pool.length)]
      tries++
    } while (pick === last && tries < 5)
    lastReplies[intent] = pick
    return pick
  }

  // ── Intent Parser ─────────────────────────────────────────

  function parseIntent(text, gameTitles) {
    var trimmed = (text || '').trim()
    if (!trimmed) {
      return { intent: 'unknown', params: {}, confidence: 0 }
    }

    var lower = trimmed.toLowerCase()

    // 1. Exact commands (highest priority)
    if (EXACT_COMMANDS[lower]) {
      return { intent: EXACT_COMMANDS[lower], params: {}, confidence: 1.0 }
    }

    // 2. Easter eggs
    for (var i = 0; i < EASTER_EGGS.length; i++) {
      if (EASTER_EGGS[i].pattern.test(trimmed)) {
        return { intent: EASTER_EGGS[i].intent, params: {}, confidence: 0.95 }
      }
    }

    // 3. Farewell (before greeting, since "salut" can be both)
    if (FAREWELL_PATTERNS.test(trimmed)) {
      return { intent: 'farewell', params: {}, confidence: 0.9 }
    }

    // 4. Greeting
    if (GREETING_PATTERNS.test(trimmed)) {
      return { intent: 'greeting', params: {}, confidence: 0.9 }
    }

    // 5. Keyword match
    for (var k = 0; k < KEYWORD_INTENTS.length; k++) {
      var group = KEYWORD_INTENTS[k]
      for (var w = 0; w < group.keywords.length; w++) {
        if (lower.indexOf(group.keywords[w]) !== -1) {
          return { intent: group.intent, params: { keyword: group.keywords[w] }, confidence: 0.8 }
        }
      }
    }

    // 6. Game title match
    if (gameTitles) {
      var match = findGameMatch(trimmed, gameTitles)
      if (match && match.confidence >= 0.5) {
        return {
          intent: 'game_comment',
          params: { game: match.game },
          confidence: match.confidence,
        }
      }
    }

    // 7. Unknown
    return { intent: 'unknown', params: {}, confidence: 0 }
  }

  // ── Core Handler ──────────────────────────────────────────

  // Intents that benefit from live data context
  var DATA_DRIVEN_INTENTS = [
    'game_comment', 'price_query', 'rare_query',
    'collection_query', 'stats_query', 'market_trend',
  ]

  function isDataDriven(intent) {
    return DATA_DRIVEN_INTENTS.indexOf(intent) !== -1
  }

  function buildResponse(parsed, generatedText) {
    var reply = generatedText || pickReply(parsed.intent)

    // Substitute game name placeholder (fallback path)
    if (!generatedText && parsed.intent === 'game_comment' && parsed.params.game) {
      var displayName = parsed.params.game.title
      reply = reply.replace('__GAME__', displayName)
    }

    // Determine BAZ state: content for data-heavy intents, talk for rest
    var state = 'talk'
    if (['price_query', 'collection_query', 'console_query', 'condition_query',
         'stats_query', 'market_trend', 'rare_query'].indexOf(parsed.intent) !== -1) {
      state = 'content'
    }

    // Duration scales with text length, min 3s, max 7s
    var duration = Math.min(7000, Math.max(3000, reply.length * 50))

    return {
      text: reply,
      state: state,
      duration: duration,
      intent: parsed.intent,
      confidence: parsed.confidence,
    }
  }

  // ── Context Fetcher ───────────────────────────────────────

  function fetchContext(parsed) {
    var api = window.RetroDexApi
    if (!api || !api.fetchJson) return Promise.resolve(null)

    // Game-specific intents: fetch game context
    if (parsed.params.game && parsed.params.game.id) {
      return api.fetchJson('/api/baz/context/' + encodeURIComponent(parsed.params.game.id))
        .catch(function () { return null })
    }

    // Collection/stats intents: fetch collection context
    if (parsed.intent === 'collection_query' || parsed.intent === 'stats_query') {
      return api.fetchJson('/api/baz/context/collection')
        .catch(function () { return null })
    }

    return Promise.resolve(null)
  }

  // ── Public API ────────────────────────────────────────────

  function ask(userText) {
    return loadGameTitles().then(function (titles) {
      var parsed = parseIntent(userText, titles)
      var gen = window.BAZGen

      // ALL intents try BAZGen first (corpus + templates + Markov)
      // Data-driven intents also fetch live context for templates
      if (gen) {
        var contextPromise = isDataDriven(parsed.intent)
          ? fetchContext(parsed)
          : Promise.resolve(null)

        return contextPromise.then(function (contextData) {
          var generated = null
          try {
            // Try template/assemble/markov cascade via BAZGen.generate()
            generated = gen.generate(parsed.intent, contextData || {})
          } catch (e) {
            generated = null
          }

          // Substitute game name placeholder if present
          if (generated && parsed.params.game) {
            generated = generated.replace(/__TITLE__/g, parsed.params.game.title)
            generated = generated.replace(/__GAME__/g, parsed.params.game.title)
            generated = generated.replace(/__CONSOLE__/g, parsed.params.game.console_name || '')
          }

          // For unknown intent: prefer Markov over static
          if (!generated && parsed.intent === 'unknown') {
            try { generated = gen.markov() } catch (e) { generated = null }
          }

          // Final fallback: static reply from RESPONSES catalog
          var response = buildResponse(parsed, generated)
          if (window.BAZ && window.BAZ.say) {
            window.BAZ.say(response.text, response.duration, response.state === 'content')
          }
          return response
        })
      }

      // No BAZGen available: static pickReply only
      var response = buildResponse(parsed, null)

      if (window.BAZ && window.BAZ.say) {
        window.BAZ.say(response.text, response.duration, response.state === 'content')
      }

      return response
    })
  }

  // Preload game titles on first load (non-blocking)
  if (document.readyState === 'complete') {
    loadGameTitles()
  } else {
    window.addEventListener('load', function () {
      setTimeout(loadGameTitles, 3000)
    })
  }

  // Extend existing BAZ global
  var existingBAZ = window.BAZ || {}
  existingBAZ.ask = ask
  existingBAZ._askEngine = ask
  existingBAZ.parseIntent = parseIntent
  existingBAZ.engine = {
    responses: RESPONSES,
    loadGameTitles: loadGameTitles,
    clearCache: function () {
      gameCache.titles = null
      gameCache.loadedAt = 0
    },
  }
  window.BAZ = existingBAZ
})()
