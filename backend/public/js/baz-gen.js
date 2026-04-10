/* ============================================================
   baz-gen.js — BAZ Procedural Text Generation Engine
   Three engines: Template Resolver, Fragment Assembler, Markov Chain.
   Pure client-side, no API, no dependencies.
   Language: French. Voice: calm, ironic, concise. No "!". Max 140 chars.
   Exposed as window.BAZGen
   ============================================================ */

;(function () {
  'use strict'

  // ── Supported template slots ──────────────────────────────
  /** @type {string[]} */
  var SLOTS = [
    '__TITLE__', '__CONSOLE__', '__YEAR__',
    '__LOOSE__', '__CIB__', '__MINT__', '__CURRENCY__',
    '__RARITY__', '__METASCORE__',
    '__TIER__', '__SOURCES__',
    '__TOTAL__', '__VALUE__', '__DELTA__',
    '__CONDITION__', '__PRICE__',
    '__ANECDOTE__'
  ]

  // Maps slot names to data object keys (lowercase, no underscores)
  var SLOT_KEY_MAP = {
    '__TITLE__':     'title',
    '__CONSOLE__':   'console',
    '__YEAR__':      'year',
    '__LOOSE__':     'loose',
    '__CIB__':       'cib',
    '__MINT__':      'mint',
    '__CURRENCY__':  'currency',
    '__RARITY__':    'rarity',
    '__METASCORE__': 'metascore',
    '__TIER__':      'tier',
    '__SOURCES__':   'sources',
    '__TOTAL__':     'total',
    '__VALUE__':     'value',
    '__DELTA__':     'delta',
    '__CONDITION__': 'condition',
    '__PRICE__':     'price',
    '__ANECDOTE__':  'anecdote'
  }

  // ════════════════════════════════════════════════════════════
  //  ENGINE 1: Template Resolver
  // ════════════════════════════════════════════════════════════

  /**
   * Resolves a template string by replacing __SLOT__ placeholders with data values.
   * If a slot has no corresponding data, the entire clause containing it is removed.
   * A "clause" is defined as the text segment between sentence-level separators
   * (period followed by space, or comma followed by space) that contains the slot.
   *
   * @param {string} template - Template string with __SLOT__ placeholders
   * @param {Object} data - Key/value map (keys are lowercase slot names without underscores)
   * @returns {string} Resolved string with slots filled or missing clauses removed
   *
   * @example
   * resolveTemplate("__TITLE__. __LOOSE__ en loose.", {title:"Zelda", loose:"$32"})
   * // => "Zelda. $32 en loose."
   *
   * @example
   * resolveTemplate("__TITLE__. __LOOSE__ en loose.", {title:"Zelda"})
   * // => "Zelda."
   */
  function resolveTemplate(template, data) {
    if (!template || typeof template !== 'string') return ''
    if (!data || typeof data !== 'object') data = {}

    var result = template

    // First pass: replace slots that have data
    var missingSlots = []
    for (var i = 0; i < SLOTS.length; i++) {
      var slot = SLOTS[i]
      var key = SLOT_KEY_MAP[slot]
      var value = data[key]

      if (value !== undefined && value !== null && value !== '') {
        result = result.split(slot).join(String(value))
      } else if (result.indexOf(slot) !== -1) {
        missingSlots.push(slot)
      }
    }

    // Second pass: remove clauses containing missing slots
    if (missingSlots.length > 0) {
      for (var m = 0; m < missingSlots.length; m++) {
        var missing = missingSlots[m]
        // Remove the clause containing the missing slot.
        // Strategy: split on ". " (sentence boundaries), remove segments with the slot,
        // then rejoin. Also handle ", " clause boundaries within segments.
        result = _removeClausesWithSlot(result, missing)
      }
    }

    // Clean up: collapse multiple spaces, fix orphan punctuation
    result = result
      .replace(/\s{2,}/g, ' ')
      .replace(/^\.\s*/, '')
      .replace(/\.\s*\.\s*/g, '. ')
      .replace(/,\s*\./g, '.')
      .replace(/,\s*$/g, '.')
      .replace(/\s+\./g, '.')
      .replace(/^\s+/, '')
      .replace(/\s+$/, '')

    // Ensure it ends with a period if non-empty
    if (result.length > 0 && result[result.length - 1] !== '.') {
      result += '.'
    }

    return result
  }

  /**
   * Removes sentence-level clauses that contain a given slot placeholder.
   * Splits on ". " to isolate sentences, then within each sentence splits on ", "
   * to isolate sub-clauses.
   *
   * @param {string} text - Text to process
   * @param {string} slot - Slot placeholder to search for (e.g. "__LOOSE__")
   * @returns {string} Text with offending clauses removed
   * @private
   */
  function _removeClausesWithSlot(text, slot) {
    // Split into sentences on ". "
    var sentences = text.split('. ')
    var kept = []

    for (var i = 0; i < sentences.length; i++) {
      var sentence = sentences[i]
      if (sentence.indexOf(slot) === -1) {
        kept.push(sentence)
      } else {
        // Try sub-clause removal within the sentence (split on ", ")
        var parts = sentence.split(', ')
        var subKept = []
        for (var j = 0; j < parts.length; j++) {
          if (parts[j].indexOf(slot) === -1) {
            subKept.push(parts[j])
          }
        }
        if (subKept.length > 0) {
          kept.push(subKept.join(', '))
        }
      }
    }

    return kept.join('. ')
  }

  // ════════════════════════════════════════════════════════════
  //  ENGINE 2: Fragment Assembler
  // ════════════════════════════════════════════════════════════

  /** @type {string[]} Interjections that open a BAZ sentence */
  var INTROS = [
    'Hmm.',
    'Tiens.',
    'Pas mal.',
    'Note.',
    'Ah.',
    'Voyons.',
    'Bon.',
    'Alors.',
    'Mouais.',
    'OK.',
    'Bien.',
    'Hop.',
    'Bref.',
    'Disons.',
    'Soit.',
    'Voyons voir.',
    'Oui.',
    'Hm.'
  ]

  /**
   * Body fragments organized by theme.
   * Each theme has 15+ entries. Themes: prix, collection, rarete, general, conseil.
   * @type {Object.<string, string[]>}
   */
  var BODIES = {
    prix: [
      'Le prix bouge selon l\'etat et la region.',
      'Loose et CIB, deux mondes differents.',
      'Le marche decide, pas le vendeur.',
      'Les prix montent depuis 2020 sur ce segment.',
      'Faut comparer plusieurs sources avant de juger.',
      'PriceCharting donne une tendance, pas une verite.',
      'Le CIB vaut souvent le double du loose.',
      'Les prix japonais suivent leur propre logique.',
      'Un pic de prix ne dure jamais eternellement.',
      'Le mint est un luxe que peu peuvent se permettre.',
      'Les donnees eBay sont bruitees mais volumineuses.',
      'Le spread loose/CIB est un bon indicateur de demande.',
      'Attention aux pics saisonniers, surtout en decembre.',
      'Le prix moyen cache souvent des extremes.',
      'Sans sources fiables, le prix est une estimation.',
      'Le retro suit ses propres regles de marche.'
    ],
    collection: [
      'Une collection se construit piece par piece.',
      'La completude, c\'est un marathon, pas un sprint.',
      'Qualifier chaque jeu prend du temps mais ca vaut le coup.',
      'Le cockpit montre tout, il suffit de lire.',
      'Chaque ajout change la valeur globale.',
      'Ta collection raconte une histoire de gout.',
      'L\'inventaire est la base de tout.',
      'Sans qualification, les donnees restent floues.',
      'Le delta entre achat et valeur actuelle, c\'est le nerf.',
      'Les doublons, ca arrive. Le systeme les detecte.',
      'La region de chaque jeu affine la valorisation.',
      'Un jeu non qualifie, c\'est un trou dans les stats.',
      'Le nombre de jeux compte moins que leur qualite.',
      'L\'export CSV est la pour les sauvegardes.',
      'Chaque console a son poids dans la collection.',
      'Les stats evoluent a chaque mise a jour de prix.'
    ],
    rarete: [
      'Rare ne veut pas toujours dire desirable.',
      'La rarete se mesure en offre, pas en legende.',
      'Un jeu rare et mauvais reste un jeu mauvais.',
      'Les grails sont subjectifs, la rarete est factuelle.',
      'Le tirage initial ne dit pas tout sur la rarete.',
      'Certains jeux deviennent rares par accident.',
      'La rarete PAL et la rarete NTSC-J sont deux histoires.',
      'Un jeu non-reference peut etre plus rare qu\'on croit.',
      'Les reproductions brouillent les signaux de rarete.',
      'La rarete n\'a de sens qu\'avec un marche actif.',
      'Les exclusivites regionales creent de la rarete artificielle.',
      'Certaines variantes sont plus rares que le jeu de base.',
      'Le sealed ajoute une couche de rarete au-dessus du mint.',
      'La rarete se verifie, elle ne se devine pas.',
      'Un jeu commun au Japon peut etre rare en Europe.',
      'Les compilations ont tue la rarete de certains titres.'
    ],
    general: [
      'Les donnees sont la, il faut juste les lire.',
      'Le systeme fait le calcul, toi la decision.',
      'Pas de magie, juste des chiffres et du contexte.',
      'Le retro, c\'est de la patience recompensee.',
      'Chaque fiche contient ce qu\'il faut savoir.',
      'Le terminal est la pour ca.',
      'L\'information est disponible, encore faut-il la chercher.',
      'Les fiches sont mises a jour regulierement.',
      'Le systeme apprend de chaque nouvelle donnee.',
      'Rien de complique si tu suis la methode.',
      'Les chiffres parlent mieux que les opinions.',
      'L\'index est ton point de depart.',
      'La recherche est ton meilleur outil ici.',
      'Tout est connecte : prix, rarete, collection.',
      'Le systeme ne juge pas, il mesure.',
      'Chaque donnee a une source, chaque source a un poids.'
    ],
    conseil: [
      'Compare avant d\'acheter, toujours.',
      'Le tier de confiance te dit si le prix est fiable.',
      'Ne te fie pas a un seul point de donnee.',
      'Achete ce que tu veux jouer, pas ce qui monte.',
      'Le timing compte autant que le prix.',
      'Vends quand le spread est en ta faveur.',
      'Un jeu sous-evalue aujourd\'hui peut rester sous-evalue demain.',
      'La condition fait le prix, pas le titre seul.',
      'Verifie la region avant de comparer les prix.',
      'Les lots sont risques mais parfois rentables.',
      'Un bon deal se reconnait aux donnees, pas au feeling.',
      'Patience et methode battent l\'impulsivite.',
      'Le CIB est un investissement, le loose est un plaisir.',
      'Ne surpaie pas un jeu commun sous pretexte de nostalgie.',
      'Les prix saisonniers creent des opportunites.',
      'Diversifie tes consoles pour reduire le risque.'
    ]
  }

  /** @type {string[]} Valid theme names for assembleFragment */
  var VALID_THEMES = ['prix', 'collection', 'rarete', 'general', 'conseil']

  /** @type {string[]} Sentence closers (some empty for variety) */
  var CLOSERS = [
    'Verifie toi-meme.',
    'C\'est comme ca.',
    'A toi de voir.',
    'Le systeme dit vrai.',
    '',
    'Fait avec.',
    'Pas plus complique.',
    'Comme d\'habitude.',
    'Et voila.',
    'Point.',
    'Fin de l\'histoire.',
    'Rien a ajouter.',
    'Suite au prochain episode.',
    'On continue.',
    'C\'est note.',
    'Voila.',
    'A mediter.',
    'Les faits sont la.',
    'Pas besoin d\'en dire plus.',
    'Classe.',
    'Acte.',
    'C\'est dit.'
  ]

  /**
   * Builds a sentence from randomly selected [intro] + [body] + [closer] fragments.
   * Body is selected from a theme-specific pool.
   *
   * @param {string} [theme='general'] - One of: prix, collection, rarete, general, conseil
   * @returns {string} Assembled sentence, max ~140 chars
   *
   * @example
   * assembleFragment('prix')
   * // => "Hmm. Le CIB vaut souvent le double du loose. A toi de voir."
   */
  function assembleFragment(theme) {
    if (!theme || VALID_THEMES.indexOf(theme) === -1) {
      theme = 'general'
    }

    var intro = _pick(INTROS)
    var body = _pick(BODIES[theme])
    var closer = _pick(CLOSERS)

    var parts = [intro, body]
    if (closer) {
      parts.push(closer)
    }

    var result = parts.join(' ')

    // Enforce 140 char limit — drop closer first, then truncate body
    if (result.length > 140 && closer) {
      result = intro + ' ' + body
    }
    if (result.length > 140) {
      result = result.substring(0, 137) + '...'
    }

    return result
  }

  // ════════════════════════════════════════════════════════════
  //  ENGINE 3: Markov Chain (Bigram)
  // ════════════════════════════════════════════════════════════

  /** @type {Object|null} Cached Markov chain */
  var _markovChain = null

  /** @type {string[]} Start tokens (words that begin sentences in corpus) */
  var _startTokens = []

  /**
   * Builds a bigram frequency table from an array of corpus strings.
   * Each entry in the chain maps a word to an array of possible next words,
   * weighted by frequency (duplicates = higher probability).
   *
   * @param {string[]} corpus - Array of sentences to train on
   * @returns {{ chain: Object.<string, string[]>, starts: string[] }}
   *
   * @example
   * var m = buildMarkov(["Le prix est la.", "Le marche bouge."])
   * // m.chain["Le"] => ["prix", "marche"]
   * // m.starts => ["Le"]
   */
  function buildMarkov(corpus) {
    if (!Array.isArray(corpus) || corpus.length === 0) {
      return { chain: {}, starts: [] }
    }

    var chain = {}
    var starts = []

    for (var i = 0; i < corpus.length; i++) {
      var text = (corpus[i] || '').trim()
      if (!text) continue

      // Split into sub-sentences on ". " to get more start tokens
      var subSentences = text.split(/\.\s+/)

      for (var s = 0; s < subSentences.length; s++) {
        var fragment = subSentences[s].replace(/\.$/, '').trim()
        if (!fragment) continue

        var words = fragment.split(/\s+/)
        if (words.length < 2) continue

        // Record start token
        starts.push(words[0])

        // Build bigram pairs
        for (var w = 0; w < words.length - 1; w++) {
          var current = words[w]
          var next = words[w + 1]

          if (!chain[current]) {
            chain[current] = []
          }
          chain[current].push(next)
        }

        // Mark sentence-ending: last word maps to null sentinel
        var lastWord = words[words.length - 1]
        if (!chain[lastWord]) {
          chain[lastWord] = []
        }
        chain[lastWord].push(null)
      }
    }

    return { chain: chain, starts: starts }
  }

  /**
   * Generates a new sentence by walking the Markov chain.
   * Picks a random start token, follows bigram transitions until hitting
   * a null sentinel (end of sentence) or maxLen words.
   *
   * Validation rules:
   * - Result must be 10-140 characters
   * - Must end with "."
   * - Must not contain "!" or "?"
   * - Retries up to 5 times, returns null on failure
   *
   * @param {Object.<string, string[]>} chain - Bigram chain from buildMarkov
   * @param {number} [maxLen=20] - Maximum number of words
   * @param {string[]} [starts] - Optional start tokens (defaults to module-level _startTokens)
   * @returns {string|null} Generated sentence or null if all attempts fail
   */
  function generateMarkov(chain, maxLen, starts) {
    var starters = starts || _startTokens
    if (!chain || !starters || starters.length === 0) {
      return null
    }
    if (!maxLen || maxLen < 5) maxLen = 20

    for (var attempt = 0; attempt < 5; attempt++) {
      var result = _walkChain(chain, maxLen, starters)
      if (result && _validateMarkovOutput(result)) {
        return result
      }
    }

    return null
  }

  /**
   * Single walk through the Markov chain.
   * @param {Object} chain - Bigram chain
   * @param {number} maxLen - Max word count
   * @param {string[]} starters - Start token pool
   * @returns {string} Raw generated text
   * @private
   */
  function _walkChain(chain, maxLen, starters) {
    var current = _pick(starters)
    if (!current) return ''

    var words = [current]

    for (var step = 0; step < maxLen - 1; step++) {
      var nextOptions = chain[current]
      if (!nextOptions || nextOptions.length === 0) break

      var next = _pick(nextOptions)

      // null sentinel = end of sentence
      if (next === null) break

      words.push(next)
      current = next
    }

    var sentence = words.join(' ')

    // Ensure ends with period
    if (sentence.length > 0) {
      // Remove trailing punctuation that isn't a period
      sentence = sentence.replace(/[,;:]+$/, '')
      if (sentence[sentence.length - 1] !== '.') {
        sentence += '.'
      }
    }

    // Capitalize first letter
    if (sentence.length > 0) {
      sentence = sentence[0].toUpperCase() + sentence.substring(1)
    }

    return sentence
  }

  /**
   * Validates a Markov-generated sentence against BAZ voice rules.
   * @param {string} text - Generated sentence
   * @returns {boolean} True if valid
   * @private
   */
  function _validateMarkovOutput(text) {
    if (!text || typeof text !== 'string') return false
    if (text.length < 10 || text.length > 140) return false
    if (text[text.length - 1] !== '.') return false
    if (text.indexOf('!') !== -1) return false
    if (text.indexOf('?') !== -1) return false
    // Reject sentences with leftover undefined/null tokens
    if (text.indexOf('undefined') !== -1) return false
    if (text.indexOf('null') !== -1) return false
    return true
  }

  // ════════════════════════════════════════════════════════════
  //  Intent-to-Theme Mapping
  // ════════════════════════════════════════════════════════════

  /** @type {Object.<string, string>} Maps intents to fragment assembler themes */
  var INTENT_THEME_MAP = {
    price_query:    'prix',
    market_trend:   'prix',
    data_quality:   'prix',
    sell_advice:    'prix',
    buy_advice:     'conseil',
    recommendation: 'conseil',
    how_to_use:     'conseil',
    collection_query: 'collection',
    stats_query:      'collection',
    completeness:     'collection',
    import_info:      'collection',
    rare_query:   'rarete',
    condition_query: 'rarete',
    region_info:     'rarete'
  }

  // ════════════════════════════════════════════════════════════
  //  Template Library (for generate() smart pick)
  // ════════════════════════════════════════════════════════════

  /** @type {Object.<string, string[]>} Templates keyed by intent */
  var TEMPLATES = {
    price_query: [
      '__TITLE__. Loose a __LOOSE__, CIB a __CIB__. __TIER__ confiance.',
      '__TITLE__ sur __CONSOLE__. __LOOSE__ en loose, __CIB__ complet. Le marche parle.',
      'Hmm. __TITLE__. Prix loose __LOOSE__. __SOURCES__ sources. __TIER__ confiance.',
      '__TITLE__. Loose __LOOSE__, CIB __CIB__, mint __MINT__. Donnees __TIER__.'
    ],
    market_trend: [
      '__TITLE__. Delta de __DELTA__ sur la periode. Le marche bouge.',
      'Hmm. __TITLE__ sur __CONSOLE__. Variation __DELTA__. A surveiller.',
      '__TITLE__. Valeur actuelle __VALUE__. Delta __DELTA__. Les chiffres parlent.'
    ],
    collection_query: [
      '__TOTAL__ jeux. Valeur estimee __VALUE__. Delta global __DELTA__.',
      'Hmm. __TOTAL__ jeux en collection. __VALUE__ de valeur. C\'est un debut.',
      'Collection : __TOTAL__ jeux, __VALUE__ estimes. __CONDITION__ dominant.'
    ],
    rare_query: [
      '__TITLE__. Rarete __RARITY__. __TIER__ confiance. Verifie les sources.',
      'Hmm. __TITLE__ sur __CONSOLE__. Rarete __RARITY__. __SOURCES__ sources.',
      '__TITLE__. Cote rarete __RARITY__. Annee __YEAR__. Le temps joue.'
    ],
    game_comment: [
      '__TITLE__ (__CONSOLE__, __YEAR__). Metascore __METASCORE__. __RARITY__ en rarete.',
      'Hmm. __TITLE__. __CONSOLE__. __YEAR__. Score __METASCORE__. Pas mal.',
      '__TITLE__ sur __CONSOLE__. __YEAR__. Loose __LOOSE__, CIB __CIB__. Les faits.',
      '__TITLE__. __ANECDOTE__'
    ],
    sell_advice: [
      '__TITLE__. Loose __LOOSE__, CIB __CIB__. Delta __DELTA__. A toi de voir.',
      'Hmm. __TITLE__. Tu as paye __PRICE__. Valeur actuelle __LOOSE__. Le calcul est simple.'
    ],
    buy_advice: [
      '__TITLE__. Loose a __LOOSE__. __TIER__ confiance. __SOURCES__ sources. Reflechis.',
      'Hmm. __TITLE__ sur __CONSOLE__. __LOOSE__ en loose. __RARITY__ en rarete. Pese le pour et le contre.'
    ]
  }

  // ════════════════════════════════════════════════════════════
  //  Static Fallbacks (last resort)
  // ════════════════════════════════════════════════════════════

  var STATIC_FALLBACKS = [
    'Hmm. Les donnees sont la, il faut juste les lire.',
    'Le systeme fait le calcul, toi la decision.',
    'Pas de magie, juste des chiffres et du contexte.',
    'Consulte la fiche. Les chiffres parlent.',
    'Hmm. Regarde les donnees. C\'est plus fiable que moi.',
    'Les donnees ne mentent pas.',
    'Verifie toi-meme. Le terminal est la pour ca.',
    'Hmm. C\'est note.'
  ]

  // ════════════════════════════════════════════════════════════
  //  Utility
  // ════════════════════════════════════════════════════════════

  /**
   * Picks a random element from an array.
   * @param {Array} arr
   * @returns {*}
   * @private
   */
  function _pick(arr) {
    if (!arr || arr.length === 0) return null
    return arr[Math.floor(Math.random() * arr.length)]
  }

  /**
   * Checks whether the data object has enough filled fields to make a template useful.
   * Returns true if at least 2 data keys are present and non-empty.
   * @param {Object} data
   * @returns {boolean}
   * @private
   */
  function _hasEnoughData(data) {
    if (!data || typeof data !== 'object') return false
    var count = 0
    var keys = Object.keys(data)
    for (var i = 0; i < keys.length; i++) {
      var val = data[keys[i]]
      if (val !== undefined && val !== null && val !== '') {
        count++
        if (count >= 2) return true
      }
    }
    return false
  }

  // ════════════════════════════════════════════════════════════
  //  Corpus loading state
  // ════════════════════════════════════════════════════════════

  var _corpusLoaded = false
  var _corpusLoading = null

  // ════════════════════════════════════════════════════════════
  //  PUBLIC API
  // ════════════════════════════════════════════════════════════

  /**
   * @namespace BAZGen
   * @description Procedural text generation for BAZ, the RetroDex terminal companion.
   * Three engines: Template Resolver, Fragment Assembler, Markov Chain.
   */
  window.BAZGen = {

    /**
     * Resolve a template string with data. Slots with missing data produce
     * clean clause removal (no "undefined" or empty gaps).
     *
     * @param {string} templateStr - Template with __SLOT__ placeholders
     * @param {Object} data - Data map {title, console, year, loose, cib, mint, ...}
     * @returns {string} Resolved string
     */
    template: function (templateStr, data) {
      return resolveTemplate(templateStr, data)
    },

    /**
     * Assemble a BAZ-style sentence from fragment pools.
     * Structure: [intro] + [body by theme] + [closer].
     *
     * @param {string} [theme='general'] - prix | collection | rarete | general | conseil
     * @returns {string} Assembled sentence
     */
    assemble: function (theme) {
      return assembleFragment(theme)
    },

    /**
     * Generate a sentence using the Markov chain engine.
     * Chain must be built first via init(). Returns null if chain not ready
     * or if generation fails validation after 5 attempts.
     *
     * @returns {string|null} Markov-generated sentence or null
     */
    markov: function () {
      if (!_markovChain) return null
      return generateMarkov(_markovChain, 20)
    },

    /**
     * Smart generation: picks the best engine based on available context.
     *
     * Priority order:
     * 1. Template (if intent has templates AND data has 2+ fields)
     * 2. Fragment assembler (always available, themed by intent)
     * 3. Markov chain (if corpus loaded)
     * 4. Static fallback
     *
     * @param {string} [intent='general'] - Intent key (e.g. 'price_query', 'rare_query')
     * @param {Object} [data={}] - Data context for template slots
     * @returns {string} Generated text
     */
    generate: function (intent, data) {
      intent = intent || 'general'
      data = data || {}

      // 1. Try template if we have enough data
      if (_hasEnoughData(data) && TEMPLATES[intent]) {
        var tpl = _pick(TEMPLATES[intent])
        if (tpl) {
          var resolved = resolveTemplate(tpl, data)
          if (resolved && resolved.length >= 10) {
            return resolved
          }
        }
      }

      // 2. Fragment assembler (always available)
      var theme = INTENT_THEME_MAP[intent] || 'general'
      var assembled = assembleFragment(theme)
      if (assembled && assembled.length >= 10) {
        return assembled
      }

      // 3. Markov chain (if loaded)
      if (_markovChain) {
        var markovResult = generateMarkov(_markovChain, 20)
        if (markovResult) {
          return markovResult
        }
      }

      // 4. Static fallback
      return _pick(STATIC_FALLBACKS)
    },

    /**
     * Load corpus from a JSON file and build the Markov chain.
     * The chain is built once and cached for the session lifetime.
     *
     * @param {string} [corpusUrl='/data/baz-corpus.json'] - URL to the corpus JSON
     * @returns {Promise<boolean>} Resolves true when chain is built, false on error
     */
    init: function (corpusUrl) {
      corpusUrl = corpusUrl || '/data/baz-corpus.json'

      // Already loaded
      if (_corpusLoaded && _markovChain) {
        return Promise.resolve(true)
      }

      // Loading in progress
      if (_corpusLoading) {
        return _corpusLoading
      }

      _corpusLoading = fetch(corpusUrl)
        .then(function (response) {
          if (!response.ok) {
            throw new Error('Corpus fetch failed: ' + response.status)
          }
          return response.json()
        })
        .then(function (corpus) {
          if (!Array.isArray(corpus) || corpus.length === 0) {
            throw new Error('Corpus is empty or invalid')
          }

          var markov = buildMarkov(corpus)
          _markovChain = markov.chain
          _startTokens = markov.starts
          _corpusLoaded = true
          _corpusLoading = null

          /* istanbul ignore next */
          if (typeof console !== 'undefined' && console.log) {
            console.log(
              '[BAZGen] Markov chain built. ' +
              Object.keys(_markovChain).length + ' tokens, ' +
              _startTokens.length + ' start tokens.'
            )
          }

          return true
        })
        .catch(function (err) {
          _corpusLoading = null
          /* istanbul ignore next */
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('[BAZGen] Init failed:', err.message || err)
          }
          return false
        })

      return _corpusLoading
    },

    // ── Exposed internals for testing / debugging ──

    /** @type {boolean} Whether corpus has been loaded */
    get ready() {
      return _corpusLoaded
    },

    /** Access to engine functions for testing */
    _engines: {
      resolveTemplate: resolveTemplate,
      assembleFragment: assembleFragment,
      buildMarkov: buildMarkov,
      generateMarkov: generateMarkov
    },

    /** Access to fragment pools for external extension */
    _pools: {
      intros: INTROS,
      bodies: BODIES,
      closers: CLOSERS,
      templates: TEMPLATES,
      fallbacks: STATIC_FALLBACKS
    }
  }
})()
