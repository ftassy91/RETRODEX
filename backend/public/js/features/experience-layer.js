'use strict'

;(() => {
  const APP_CONFIG = window.RetroDexConfig || {}
  const FLAGS = APP_CONFIG.flags || {}
  const EXPERIENCE = APP_CONFIG.experience || {}
  const CONFIG = {
    enabled: FLAGS.experienceLayer !== false && window.RETRODEX_EXPERIENCE_DISABLED !== true,
    collectorModeEnabled: FLAGS.collectorMode !== false,
    easterEggsEnabled: FLAGS.easterEggs !== false,
    microReferencesEnabled: FLAGS.contextualMicroReferences !== false,
    persistCollectorModeInSession: FLAGS.persistCollectorModeInSession !== false,
    pageLoadChance: Number(EXPERIENCE.pageLoadChance) || 0.42,
    titleClicksRequired: 5,
    titleClickWindowMs: 2500,
    statusDurationMs: 2400,
    statusCooldownMs: Number(EXPERIENCE.statusCooldownMs) || 1800,
    collectorModeSessionKey: EXPERIENCE.collectorModeSessionKey || 'r?trodex.collector-mode',
    rarityChances: {
      rare: Number(EXPERIENCE.rarityChances?.rare) || 0.18,
      ultraRare: Number(EXPERIENCE.rarityChances?.ultraRare) || 0.04,
    },
  }

  if (!CONFIG.enabled || !document.body) {
    return
  }

  const CONTENT = {
    statusMessages: {
      default: {
        common: [
          'MEMORY NODE ACTIVE',
          'MARKET SIGNAL UPDATED',
          'ARCHIVE ENTRY RECORDED',
        ],
        rare: [
          'DATA FRAGMENT RECOVERED',
          'LOW-LIGHT INDEX STABLE',
        ],
        ultraRare: [
          'MIDNIGHT ARCHIVE HANDSHAKE COMPLETE',
        ],
      },
      search: {
        common: [
          'QUERY VECTOR LOCKED',
          'INDEXED MEMORY LINKED',
        ],
        rare: [
          'ARCHIVE SIGNAL NARROWED',
        ],
      },
      collection: {
        common: [
          'SHELF INDEX REFRESHED',
          'INVENTORY MEMORY LINKED',
        ],
        rare: [
          'ARCHIVE ENTRY RECORDED',
        ],
        mutations: {
          add: 'ARCHIVE ENTRY RECORDED',
          remove: 'SHELF INDEX UPDATED',
          patch: 'WATCH THRESHOLD STORED',
        },
      },
      game: {
        common: [
          'GAME RECORD RESOLVED',
          'MARKET SIGNAL UPDATED',
        ],
        rare: [
          'DATA FRAGMENT RECOVERED',
          'COLLECTOR TRACE CONFIRMED',
        ],
      },
      encyclopedia: {
        common: [
          'ARCHIVE PAGE INDEXED',
          'KNOWLEDGE ENTRY RESOLVED',
        ],
        rare: [
          'MEMORY NODE ACTIVE',
        ],
      },
      franchises: {
        common: [
          'SERIES MAP RECOVERED',
          'ARCHIVE LINEAGE INDEXED',
        ],
        rare: [
          'CANON SIGNAL DETECTED',
        ],
      },
      stats: {
        common: [
          'MARKET GRID SYNCHRONIZED',
          'SIGNAL SUMMARY REFRESHED',
        ],
        rare: [
          'ARCHIVE ENTRY RECORDED',
        ],
      },
      consoles: {
        common: [
          'HARDWARE INDEX READY',
          'PLATFORM MEMORY LINKED',
        ],
        rare: [
          'MARKET SIGNAL UPDATED',
        ],
      },
    },
    tooltips: {
      footer: 'Cover index routed via IGDB.',
      search: 'Slash key opens indexed search.',
    },
    microTags: {
      monochrome: { label: 'MONOCHROME MEMORY', flavor: 'experience-gameboy' },
      archive: { label: 'ARCHIVE PRIORITY', flavor: 'experience-archive' },
      canon: { label: 'CANON ENTRY', flavor: 'experience-canon' },
    },
    sequences: {
      collector: ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown'],
    },
  }

  const ICONIC_PATTERNS = [
    /\bzelda\b/i,
    /\bmario\b/i,
    /\bmetroid\b/i,
    /\bcastlevania\b/i,
    /final fantasy vii/i,
    /\bff\s?vii\b/i,
    /panzer dragoon/i,
    /metal slug/i,
    /\bchrono\b/i,
  ]

  const STATE = {
    sequenceIndex: 0,
    titleClicks: 0,
    titleClickTimer: null,
    statusTimer: null,
    tooltipHideTimer: null,
    pageLoadHandled: false,
    gameViewHandled: false,
    sweepTimer: null,
    lastStatusAt: 0,
    collectorMode: false,
  }

  function compact(value) {
    return String(value || '').replace(/\s+/g, ' ').trim()
  }

  function randomItem(items) {
    if (!Array.isArray(items) || !items.length) {
      return ''
    }
    return items[Math.floor(Math.random() * items.length)]
  }

  function pageKey() {
    const path = window.location.pathname.toLowerCase()
    if (path.includes('search')) return 'search'
    if (path.includes('collection')) return 'collection'
    if (path.includes('game-detail')) return 'game'
    if (path.includes('encyclopedia')) return 'encyclopedia'
    if (path.includes('franchises')) return 'franchises'
    if (path.includes('stats')) return 'stats'
    if (path.includes('consoles')) return 'consoles'
    return 'default'
  }

  function loadCollectorModeState() {
    if (!CONFIG.persistCollectorModeInSession) return false
    try {
      return window.sessionStorage.getItem(CONFIG.collectorModeSessionKey) === '1'
    } catch (_error) {
      return false
    }
  }

  function storeCollectorModeState(enabled) {
    if (!CONFIG.persistCollectorModeInSession) return
    try {
      if (enabled) {
        window.sessionStorage.setItem(CONFIG.collectorModeSessionKey, '1')
      } else {
        window.sessionStorage.removeItem(CONFIG.collectorModeSessionKey)
      }
    } catch (_error) {}
  }

  function pickRareBucket(group) {
    const common = Array.isArray(group?.common) ? group.common : []
    const rare = Array.isArray(group?.rare) ? group.rare : []
    const ultraRare = Array.isArray(group?.ultraRare) ? group.ultraRare : []
    const roll = Math.random()

    if (ultraRare.length && roll <= CONFIG.rarityChances.ultraRare) {
      return ultraRare
    }
    if (rare.length && roll <= CONFIG.rarityChances.rare + CONFIG.rarityChances.ultraRare) {
      return rare
    }
    return common.length ? common : rare.length ? rare : ultraRare
  }

  function pickStatusMessage(channel, hint) {
    const group = CONTENT.statusMessages[channel] || CONTENT.statusMessages.default
    if (hint && group?.mutations?.[hint]) {
      return group.mutations[hint]
    }
    return randomItem(pickRareBucket(group))
  }

  function ensureStatusNode() {
    let statusNode = document.getElementById('experience-status')
    if (!statusNode) {
      statusNode = document.createElement('div')
      statusNode.id = 'experience-status'
      statusNode.className = 'experience-status'
      statusNode.setAttribute('aria-live', 'polite')
      document.body.appendChild(statusNode)
    }

    let badgeNode = document.getElementById('experience-collector-flag')
    if (!badgeNode) {
      badgeNode = document.createElement('div')
      badgeNode.id = 'experience-collector-flag'
      badgeNode.className = 'experience-collector-flag'
      badgeNode.textContent = 'COLLECTOR MODE ENABLED'
      badgeNode.hidden = true
      document.body.appendChild(badgeNode)
    }

    let tooltipNode = document.getElementById('experience-tooltip')
    if (!tooltipNode) {
      tooltipNode = document.createElement('div')
      tooltipNode.id = 'experience-tooltip'
      tooltipNode.className = 'experience-tooltip'
      tooltipNode.hidden = true
      document.body.appendChild(tooltipNode)
    }

    return { statusNode, badgeNode, tooltipNode }
  }

  function showStatus(message, options) {
    const text = compact(message)
    if (!text) return

    const now = Date.now()
    if (!options?.force && now - STATE.lastStatusAt < CONFIG.statusCooldownMs) {
      return
    }
    STATE.lastStatusAt = now

    const duration = Number(options && options.duration) || CONFIG.statusDurationMs
    const nodes = ensureStatusNode()

    nodes.statusNode.textContent = text
    nodes.statusNode.classList.add('visible')

    window.clearTimeout(STATE.statusTimer)
    STATE.statusTimer = window.setTimeout(() => {
      nodes.statusNode.classList.remove('visible')
    }, duration)
  }

  function showTooltip(target, message) {
    if (!target || !message) return

    const nodes = ensureStatusNode()
    const rect = target.getBoundingClientRect()

    nodes.tooltipNode.textContent = message
    nodes.tooltipNode.hidden = false
    nodes.tooltipNode.classList.add('visible')
    nodes.tooltipNode.style.left = `${Math.max(12, Math.round(rect.left))}px`
    nodes.tooltipNode.style.top = `${Math.max(12, Math.round(rect.top - 36))}px`

    window.clearTimeout(STATE.tooltipHideTimer)
  }

  function hideTooltip() {
    const tooltipNode = document.getElementById('experience-tooltip')
    if (!tooltipNode) return

    tooltipNode.classList.remove('visible')
    STATE.tooltipHideTimer = window.setTimeout(() => {
      tooltipNode.hidden = true
    }, 120)
  }

  function bindTooltip(target, message) {
    if (!CONFIG.easterEggsEnabled) return
    if (!target || target.dataset.experienceTooltipBound === '1') return

    target.dataset.experienceTooltipBound = '1'
    target.addEventListener('mouseenter', () => showTooltip(target, message))
    target.addEventListener('mouseleave', hideTooltip)
    target.addEventListener('blur', hideTooltip, true)
  }

  function applyCollectorMode(enabled) {
    const nodes = ensureStatusNode()
    STATE.collectorMode = enabled
    document.body.classList.toggle('collector-mode', enabled)
    nodes.badgeNode.hidden = !enabled
    storeCollectorModeState(enabled)

    if (enabled) {
      showStatus('COLLECTOR MODE ENABLED', { duration: 2800, force: true })
    } else {
      showStatus('COLLECTOR MODE STANDBY', { duration: 2200, force: true })
    }
  }

  function bindTitleInteractions() {
    if (!CONFIG.easterEggsEnabled) return
    const titleNode = document.querySelector('.hub-hero .page-title, .hero-title, .page-title, .detail-title')
    if (!titleNode || titleNode.dataset.experienceTitleBound === '1') return

    let hoverShown = false

    titleNode.dataset.experienceTitleBound = '1'
    titleNode.addEventListener('mouseenter', () => {
      if (hoverShown) return
      hoverShown = true
      showStatus('MEMORY NODE ACTIVE', { duration: 1600 })
    })

    titleNode.addEventListener('click', () => {
      STATE.titleClicks += 1

      window.clearTimeout(STATE.titleClickTimer)
      STATE.titleClickTimer = window.setTimeout(() => {
        STATE.titleClicks = 0
      }, CONFIG.titleClickWindowMs)

      if (STATE.titleClicks >= CONFIG.titleClicksRequired) {
        STATE.titleClicks = 0
        showStatus('DATA FRAGMENT RECOVERED', { duration: 2600, force: true })
      }
    })
  }

  function patchFetch() {
    if (typeof window.fetch !== 'function' || window.fetch.__retrodexExperiencePatched) {
      return
    }

    const originalFetch = window.fetch.bind(window)

    const wrappedFetch = async function wrappedExperienceFetch(input, init) {
      const requestUrl = typeof input === 'string' ? input : input && input.url ? input.url : ''
      const requestMethod = String(
        (init && init.method) || (typeof input !== 'string' && input && input.method) || 'GET'
      ).toUpperCase()

      const response = await originalFetch(input, init)

      if (response.ok && /\/api\/collection(?:\/|$)/.test(requestUrl)) {
        if (requestMethod === 'POST') {
          showStatus(pickStatusMessage('collection', 'add'))
        } else if (requestMethod === 'DELETE') {
          showStatus(pickStatusMessage('collection', 'remove'))
        } else if (requestMethod === 'PATCH') {
          showStatus(pickStatusMessage('collection', 'patch'))
        }
      }

      return response
    }

    wrappedFetch.__retrodexExperiencePatched = true
    window.fetch = wrappedFetch
  }

  function replaceSearchEmptyStates() {
    document.querySelectorAll('.search-empty').forEach((node) => {
      const text = compact(node.textContent)
      if (/aucun resultat|aucun r.sultat|no results/i.test(text)) {
        node.textContent = 'No cartridge match found in indexed memory.'
        node.classList.add('experience-empty')
      }
    })
  }

  function replaceCollectionEmptyStates() {
    document.querySelectorAll('.coll-empty, #collection-list-container > div').forEach((node) => {
      const text = compact(node.textContent)
      if (/collection vide|aucun jeu/i.test(text)) {
        node.innerHTML = 'Shelf state: empty. <a href="/search.html" class="terminal-action-link">Locate a cartridge</a>'
        node.classList.add('experience-empty')
      }
    })
  }

  function replaceHistoryEmptyStates() {
    const emptyChartText = document.querySelector('#price-chart text')
    if (emptyChartText && /aucune vente/i.test(compact(emptyChartText.textContent))) {
      emptyChartText.textContent = 'No archived transactions detected.'
    }
  }

  function applyRowFlavor(node) {
    if (!node) return

    const text = compact(node.textContent)
    const isMonochrome = /game boy/i.test(text)
    const isArchive = /(saturn|neo geo)/i.test(text)
    const isCanon = ICONIC_PATTERNS.some((pattern) => pattern.test(text)) || /\blegendary\b/i.test(text)

    node.classList.toggle('experience-row-monochrome', isMonochrome)
    node.classList.toggle('experience-row-archive', isArchive)
    node.classList.toggle('experience-row-canon', isCanon)
  }

  function findMicroTagLabel() {
    const titleText = compact(
      (document.querySelector('.hero-title, #preview-title, #detail-title, .detail-title') || {}).textContent
    )
    const metaText = compact(
      (document.querySelector('.game-console-link, #preview-meta, #detail-row1, .hero-meta') || {}).textContent
    )
    const rarityText = compact((document.querySelector('.rarity-badge') || {}).textContent)

    if (/game boy/i.test(metaText)) {
      return CONTENT.microTags.monochrome
    }

    if (/(saturn|neo geo)/i.test(metaText) || /\blegendary\b/i.test(rarityText)) {
      return CONTENT.microTags.archive
    }

    if (ICONIC_PATTERNS.some((pattern) => pattern.test(titleText))) {
      return CONTENT.microTags.canon
    }

    return { label: '', flavor: '' }
  }

  function updateMicroTag() {
    if (!CONFIG.microReferencesEnabled) {
      const existing = document.querySelector('.experience-micro-tag')
      document.body.classList.remove('experience-gameboy', 'experience-archive', 'experience-canon')
      if (existing) existing.remove()
      return
    }

    const anchor = document.querySelector('.hero-title, #preview-title, #detail-title, .detail-title')
    const existingTag = document.querySelector('.experience-micro-tag')
    const context = findMicroTagLabel()

    document.body.classList.remove('experience-gameboy', 'experience-archive', 'experience-canon')
    if (context.flavor) {
      document.body.classList.add(context.flavor)
    }

    if (!anchor || !context.label) {
      if (existingTag) existingTag.remove()
      return
    }

    const tag = existingTag || document.createElement('span')
    tag.className = 'experience-micro-tag'
    tag.textContent = context.label

    if (anchor.nextElementSibling !== tag) {
      anchor.insertAdjacentElement('afterend', tag)
    }
  }

  function handleGameViewStatus() {
    if (pageKey() !== 'game' || STATE.gameViewHandled) return

    const titleNode = document.querySelector('.hero-title')
    const titleText = compact(titleNode && titleNode.textContent)
    if (!titleText || titleText === '-' || /chargement/i.test(titleText)) return

    STATE.gameViewHandled = true
    showStatus(pickStatusMessage('game'))
  }

  function sweepExperienceLayer() {
    replaceSearchEmptyStates()
    replaceCollectionEmptyStates()
    replaceHistoryEmptyStates()
    document
      .querySelectorAll('.terminal-row, .legendary-card, .franchise-game-row, .encyclo-list-row')
      .forEach(applyRowFlavor)
    updateMicroTag()
    bindTitleInteractions()
    bindTooltip(document.querySelector('.footer-attribution, .footer-igdb'), CONTENT.tooltips.footer)
    bindTooltip(
      document.querySelector('#hub-search-input, #search-input, .global-search-bar input'),
      CONTENT.tooltips.search
    )
    handleGameViewStatus()
  }

  function scheduleSweep() {
    window.clearTimeout(STATE.sweepTimer)
    STATE.sweepTimer = window.setTimeout(sweepExperienceLayer, 80)
  }

  function observeDom() {
    const observer = new MutationObserver(() => {
      scheduleSweep()
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    })
  }

  function setupCollectorSequence() {
    if (!CONFIG.collectorModeEnabled || !CONFIG.easterEggsEnabled) return
    document.addEventListener('keydown', (event) => {
      const tagName = event.target && event.target.tagName
      const inField =
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        (event.target && event.target.isContentEditable)

      if (inField) return

      const expectedKey = CONTENT.sequences.collector[STATE.sequenceIndex]
      if (event.key === expectedKey) {
        STATE.sequenceIndex += 1
        if (STATE.sequenceIndex === CONTENT.sequences.collector.length) {
          STATE.sequenceIndex = 0
          applyCollectorMode(!STATE.collectorMode)
        }
        return
      }

      STATE.sequenceIndex = event.key === CONTENT.sequences.collector[0] ? 1 : 0
    })
  }

  function maybeShowPageLoadMessage() {
    if (STATE.pageLoadHandled) return
    STATE.pageLoadHandled = true

    if (Math.random() > CONFIG.pageLoadChance) {
      return
    }

    window.setTimeout(() => {
      showStatus(pickStatusMessage(pageKey()), { force: true })
    }, 420)
  }

  function init() {
    ensureStatusNode()
    patchFetch()
    setupCollectorSequence()
    if (loadCollectorModeState()) {
      applyCollectorMode(true)
    }
    maybeShowPageLoadMessage()
    sweepExperienceLayer()
    observeDom()
  }

  window.RetroDexExperience = {
    showStatus,
    sweep: sweepExperienceLayer,
    setCollectorMode: applyCollectorMode,
    disable: () => {
      storeCollectorModeState(false)
      document.body.classList.remove('collector-mode', 'experience-gameboy', 'experience-archive', 'experience-canon')
      const tag = document.querySelector('.experience-micro-tag')
      if (tag) tag.remove()
      const statusNode = document.getElementById('experience-status')
      if (statusNode) statusNode.remove()
      const badgeNode = document.getElementById('experience-collector-flag')
      if (badgeNode) badgeNode.remove()
      const tooltipNode = document.getElementById('experience-tooltip')
      if (tooltipNode) tooltipNode.remove()
    },
  }

  init()
})()
