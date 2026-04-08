'use strict'

;(() => {
  const { byId, qsa, setHtml, setText } = window.RetroDexDom || {}
  const { escapeHtml, formatCurrency } = window.RetroDexFormat || {}
  const { fetchJson, fetchCollection, fetchCollectionSearch } = window.RetroDexApi || {}
  const { getParams } = window.RetroDexState || {}
  const runtimeMonitor = window.RetroDexRuntimeMonitor?.createPageMonitor?.('collection')

  if (!byId || !qsa || !setHtml || !setText || !escapeHtml || !formatCurrency || !fetchJson || !fetchCollection || !getParams) {
    console.warn('[RetroDex] Collection bootstrap skipped: core helpers missing')
    return
  }

  const statTotalEl = byId('stat-total')
  const statValueLooseEl = byId('stat-value-loose')
  const statPaidEl = byId('stat-paid')
  const statGainEl = byId('stat-gain')
  const statValueCibEl = byId('stat-value-cib')
  const statValueMintEl = byId('stat-value-mint')
  const statusTextEl = byId('status-text')
  const cockpitLeadEl = byId('collection-cockpit-lead')
  const modeTitleEl = byId('collection-mode-title')
  const modeCopyEl = byId('collection-mode-copy')
  const collectionSearchInputEl = byId('collection-search-input')
  const collectionConsoleFilterEl = byId('collection-console-filter')
  const collectionSortSelectEl = byId('collection-sort-select')
  const collectionExportButtonEl = byId('collection-export-btn')
  const collectionListContainerEl = byId('collection-list-container')
  const collectionDetailEl = byId('collection-detail')
  const detailTitleEl = byId('detail-title')
  const detailRow1El = byId('detail-row1')
  const detailFocusStateEl = byId('detail-focus-state')
  const detailSignalGridEl = byId('detail-signal-grid')
  const detailChipRowEl = byId('detail-chip-row')
  const detailSummaryEl = byId('detail-summary')
  const detailNextStepEl = byId('detail-next-step')
  const detailMetascoreEl = byId('detail-metascore')
  const detailRow2El = byId('detail-row2')
  const editFormEl = byId('collection-edit-form')
  const editConditionEl = byId('edit-condition')
  const editPricePaidEl = byId('edit-price-paid')
  const editPurchaseDateEl = byId('edit-purchase-date')
  const editNotesEl = byId('edit-notes')
  const editSaveButtonEl = byId('collection-edit-save-btn')
  const editCancelButtonEl = byId('collection-edit-cancel-btn')
  const publicBannerEl = byId('public-banner')
  const addButtonEl = byId('collection-add-btn')
  const tabButtons = qsa('[data-list]')
  const copySaleLinkButtonEl = byId('copy-sale-link-btn')
  const isPublicForSaleView = getParams().get('view') === 'for_sale'
  const initialQuery = getParams().get('q') || ''

  let enrichedItems = []
  let allCollectionItems = []
  let activeTab = isPublicForSaleView ? 'for_sale' : 'all'
  let selectedIndex = -1
  let selectedCollectionItem = null
  let editingItemId = null
  let copyFeedbackTimer = null
  let activeCockpitSignal = null
  let cockpitSignalItems = null
  let cockpitData = null

  function getGame(item) {
    return item?.Game || item?.game || {}
  }

  function getCollectionNote(item) {
    return String(item?.notes || item?.personal_note || '').trim()
  }

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
  }

  function getDefaultSortKey(tab = activeTab) {
    if (isPublicForSaleView) {
      return 'title_asc'
    }

    if (tab === 'all') {
      return 'review_desc'
    }

    if (tab === 'wanted') {
      return 'value_asc'
    }

    return 'title_asc'
  }

  function getSortKey() {
    return collectionSortSelectEl?.value || getDefaultSortKey()
  }

  function hasActiveCollectionFilters() {
    return Boolean(
      collectionSearchInputEl?.value?.trim()
      || collectionConsoleFilterEl?.value
      || (getSortKey() && getSortKey() !== getDefaultSortKey())
    )
  }

  function populateConsoleFilter(items) {
    if (!collectionConsoleFilterEl) {
      return
    }

    const currentValue = collectionConsoleFilterEl.value
    const consoles = [...new Set(items.map((item) => getGame(item).console || getGame(item).platform).filter(Boolean))]
      .sort((left, right) => String(left).localeCompare(String(right), 'fr', { sensitivity: 'base' }))

    collectionConsoleFilterEl.innerHTML = '<option value=\"\">Toutes les consoles</option>'
      + consoles.map((consoleName) => `<option value=\"${escapeHtml(consoleName)}\">${escapeHtml(consoleName)}</option>`).join('')

    if (currentValue && consoles.includes(currentValue)) {
      collectionConsoleFilterEl.value = currentValue
    }
  }

  function ensureReviewSortOptions() {
    if (!collectionSortSelectEl) return

    const existingValues = new Set(Array.from(collectionSortSelectEl.options).map((option) => option.value))
    const extras = [
      ['review_desc', 'Priorite de revue'],
      ['delta_desc', 'Delta decroissant'],
      ['delta_asc', 'Delta croissant'],
      ['purchase_date_desc', 'Date d achat recente'],
      ['purchase_date_asc', 'Date d achat ancienne'],
    ]

    extras.forEach(([value, label]) => {
      if (existingValues.has(value)) return
      const option = document.createElement('option')
      option.value = value
      option.textContent = label
      collectionSortSelectEl.appendChild(option)
    })
  }

  function sortCollectionItems(items) {
    const sortKey = getSortKey()
    const sorted = [...items]

    const reviewPriority = (item) => {
      const game = getGame(item)
      const listType = String(item.list_type || activeTab || 'owned').toLowerCase()
      const paid = Number(item.price_paid || 0)
      const loose = Number(game.loosePrice || 0)
      const cib = Number(game.cibPrice || 0)
      const threshold = Number(item.price_threshold || 25)

      if (listType === 'for_sale') return 0
      if (listType === 'owned' && paid <= 0) return 1
      if (listType === 'owned' && paid > 0 && loose >= paid * 1.5) return 2
      if (listType === 'owned' && String(item.condition || '').toLowerCase() === 'loose' && loose > 0 && cib > 0 && cib - loose <= 20) return 3
      if (listType === 'wanted' && loose > 0 && loose <= threshold) return 4
      if (listType === 'wanted') return 5
      return 6
    }

    sorted.sort((left, right) => {
      const leftGame = getGame(left)
      const rightGame = getGame(right)
      const leftPaid = Number(left.price_paid || 0)
      const rightPaid = Number(right.price_paid || 0)
      const leftLoose = Number(leftGame.loosePrice || 0)
      const rightLoose = Number(rightGame.loosePrice || 0)
      const leftGain = leftPaid > 0 && leftLoose > 0 ? leftLoose - leftPaid : null
      const rightGain = rightPaid > 0 && rightLoose > 0 ? rightLoose - rightPaid : null
      const leftPurchaseDate = new Date(left.purchase_date || left.created_at || left.added_at || 0).getTime()
      const rightPurchaseDate = new Date(right.purchase_date || right.created_at || right.added_at || 0).getTime()
      const titleCompare = String(leftGame.title || '').localeCompare(String(rightGame.title || ''), 'fr', { sensitivity: 'base' })

      switch (sortKey) {
        case 'review_desc':
          return reviewPriority(left) - reviewPriority(right)
            || (rightGain ?? Number.NEGATIVE_INFINITY) - (leftGain ?? Number.NEGATIVE_INFINITY)
            || rightLoose - leftLoose
            || titleCompare
        case 'title_desc':
          return String(rightGame.title || '').localeCompare(String(leftGame.title || ''), 'fr', { sensitivity: 'base' })
        case 'paid_desc':
          return rightPaid - leftPaid || titleCompare
        case 'paid_asc':
          return leftPaid - rightPaid || titleCompare
        case 'value_desc':
          return rightLoose - leftLoose || titleCompare
        case 'value_asc':
          return leftLoose - rightLoose || titleCompare
        case 'delta_desc':
          return (rightGain ?? Number.NEGATIVE_INFINITY) - (leftGain ?? Number.NEGATIVE_INFINITY) || titleCompare
        case 'delta_asc':
          return (leftGain ?? Number.POSITIVE_INFINITY) - (rightGain ?? Number.POSITIVE_INFINITY) || titleCompare
        case 'purchase_date_desc':
          return (rightPurchaseDate || Number.NEGATIVE_INFINITY) - (leftPurchaseDate || Number.NEGATIVE_INFINITY) || titleCompare
        case 'purchase_date_asc':
          return (leftPurchaseDate || Number.POSITIVE_INFINITY) - (rightPurchaseDate || Number.POSITIVE_INFINITY) || titleCompare
        default:
          return titleCompare
      }
    })

    return sorted
  }

  function getReviewCue(item) {
    const game = getGame(item)
    const listType = String(item?.list_type || activeTab || 'owned').toLowerCase()
    const paid = Number(item?.price_paid || 0)
    const loose = Number(game?.loosePrice || 0)
    const cib = Number(game?.cibPrice || 0)
    const threshold = Number(item?.price_threshold || 25)
    const condition = String(item?.condition || '').toLowerCase()

    if (listType === 'for_sale') return { label: 'sortie active', tone: 'is-hot' }
    if (listType === 'owned' && paid <= 0) return { label: 'a completer', tone: '' }
    if (listType === 'owned' && paid > 0 && loose > 0 && loose >= paid * 1.5) return { label: 'sortie plausible', tone: 'is-hot' }
    if (listType === 'owned' && condition === 'loose' && loose > 0 && cib > 0 && cib - loose <= 20) return { label: 'upgrade plausible', tone: 'is-primary' }
    if (listType === 'wanted' && loose > 0 && loose <= threshold) return { label: 'opportunite d achat', tone: 'is-primary' }
    if (listType === 'wanted') return { label: 'a verifier', tone: '' }
    return { label: 'stable', tone: '' }
  }

  function applyCollectionFilters(items) {
    const query = normalizeText(collectionSearchInputEl?.value)
    const platform = collectionConsoleFilterEl?.value || ''

    // Cockpit signal filter — restrict to the signal's item ids
    const cockpitIds = cockpitSignalItems
      ? new Set(cockpitSignalItems.map((s) => String(s.id || s.gameId || '')).filter(Boolean))
      : null

    return sortCollectionItems(items.filter((item) => {
      if (cockpitIds) {
        const itemId = String(item.id || item.gameId || '')
        if (!cockpitIds.has(itemId)) return false
      }
      const game = getGame(item)
      const haystack = normalizeText([
        game.title,
        game.console,
        game.platform,
        item.condition,
        getCollectionNote(item),
      ].filter(Boolean).join(' '))

      if (query && !haystack.includes(query)) {
        return false
      }

      if (platform && (game.console || game.platform) !== platform) {
        return false
      }

      return true
    }))
  }

  async function loadCollectionSearchResults() {
    const sortKey = getSortKey()
    const useLocalSort = ['review_desc', 'delta_desc', 'delta_asc', 'purchase_date_desc', 'purchase_date_asc'].includes(sortKey)

    if (typeof fetchCollectionSearch !== 'function' || useLocalSort) {
      return applyCollectionFilters(allCollectionItems)
    }

    const payload = await fetchCollectionSearch({
      query: String(collectionSearchInputEl?.value || '').trim(),
      listType: activeTab,
      consoleName: collectionConsoleFilterEl?.value || '',
      sort: sortKey,
      limit: 1000,
    })

    return (payload.items || []).filter((item) => Object.keys(getGame(item)).length > 0)
  }

  function hideEditForm() {
    editingItemId = null
    if (editFormEl) {
      editFormEl.hidden = true
    }
  }

  function populateEditForm(item) {
    if (!editFormEl) return
    editConditionEl.value = item?.condition || 'Loose'
    editPricePaidEl.value = item?.price_paid != null ? String(item.price_paid) : ''
    editPurchaseDateEl.value = item?.purchase_date || ''
    editNotesEl.value = getCollectionNote(item)
  }

  function focusEditField(focusField = 'condition') {
    window.requestAnimationFrame(() => {
      if (focusField === 'price') {
        editPricePaidEl?.focus()
        editPricePaidEl?.select?.()
        return
      }

      editConditionEl?.focus()
    })
  }

  function startEdit(item, focusField = 'condition') {
    if (!editFormEl || !item || (isPublicForSaleView && activeTab === 'for_sale')) {
      return
    }

    editingItemId = item.id || item.gameId || null
    populateEditForm(item)
    editFormEl.hidden = false
    focusEditField(focusField)
  }

  function readEditFormValues() {
    const rawPrice = String(editPricePaidEl?.value || '').trim()
    const price_paid = rawPrice ? Number(rawPrice) : null
    const purchase_date = String(editPurchaseDateEl?.value || '').trim() || null
    const notes = String(editNotesEl?.value || '').trim() || null

    if (rawPrice && (!Number.isFinite(price_paid) || price_paid <= 0)) {
      throw new Error('Prix d achat invalide.')
    }

    if (purchase_date && !/^\d{4}-\d{2}-\d{2}$/.test(purchase_date)) {
      throw new Error('Date d achat invalide.')
    }

    return {
      condition: editConditionEl?.value || 'Loose',
      price_paid,
      purchase_date,
      notes,
      personal_note: notes,
    }
  }

  function setGainValue(node, gain) {
    node.textContent = gain != null
      ? gain >= 0
        ? `+$${Math.round(gain)}`
        : `-$${Math.round(Math.abs(gain))}`
      : '-'
    node.className = 'terminal-summary-value' + (gain > 0 ? ' positive' : gain < 0 ? ' negative' : '')
  }

  function setStatus(message) {
    setText(statusTextEl, message || '')
  }

  function getTabLabel(tab) {
    if (tab === 'all') return 'la collection complète'
    if (tab === 'wanted') return 'la wishlist'
    if (tab === 'for_sale') return 'la liste a vendre'
    return 'votre etagere'
  }

  function getTabSignalLabel(tab) {
    if (tab === 'all') return 'TOUT'
    if (tab === 'wanted') return 'WISHLIST'
    if (tab === 'for_sale') return 'A VENDRE'
    return 'COLLECTION'
  }

  function getSignalLabel(signalKey) {
    switch (signalKey) {
      case 'duplicates': return 'DOUBLONS'
      case 'sell_candidates': return 'A VENDRE'
      case 'upgrade_candidates': return 'A UPGRADER'
      case 'incomplete': return 'INCOMPLETS'
      case 'affordable_wishlist': return 'WISHLIST <= $25'
      case 'stale_wishlist': return 'WISHLIST +6 MOIS'
      default: return 'ATTENTION'
    }
  }

  function getSignalPrompt(signalKey) {
    switch (signalKey) {
      case 'duplicates':
        return 'Comparer et arbitrer les doublons avant de garder ou sortir.'
      case 'sell_candidates':
        return 'Verifier les lignes qui peuvent sortir sans affaiblir la collection.'
      case 'upgrade_candidates':
        return 'Identifier les jeux ou un meilleur etat change vraiment la valeur.'
      case 'incomplete':
        return 'Completer ou verifier les entrees qui restent fragiles.'
      case 'affordable_wishlist':
        return 'Prioriser les achats accessibles avant qu ils ne sortent de portee.'
      case 'stale_wishlist':
        return 'Relire les envies anciennes avant de les laisser dormir ou de les supprimer.'
      default:
        return 'Lire les signaux puis agir sur la bonne fiche.'
    }
  }

  function getActiveSignalCount() {
    if (!activeCockpitSignal || !cockpitData?.[activeCockpitSignal]) return 0
    return Number(cockpitData[activeCockpitSignal].count || 0)
  }

  function updateCockpitLead(visibleCount = enrichedItems.length, totalCount = allCollectionItems.length) {
    if (!cockpitLeadEl || !modeTitleEl || !modeCopyEl) return

    const tabTitle = activeTab === 'all'
      ? 'PRIORITE'
      : activeTab === 'wanted'
      ? 'WISHLIST'
      : activeTab === 'for_sale'
        ? 'A VENDRE'
        : 'ETAGERE'

    if (activeCockpitSignal) {
      const signalLabel = getSignalLabel(activeCockpitSignal)
      const count = getActiveSignalCount()
      setText(modeTitleEl, `${tabTitle} | ${signalLabel}`)
      setText(
        modeCopyEl,
        count
          ? `${count} entree(s) a arbitrer. ${getSignalPrompt(activeCockpitSignal)}`
          : `${signalLabel} actif. ${getSignalPrompt(activeCockpitSignal)}`
      )
      return
    }

    if (hasActiveCollectionFilters()) {
      setText(modeTitleEl, `${tabTitle} | FILTRES`)
      setText(modeCopyEl, `${visibleCount} entree(s) visibles sur ${totalCount}. Ajuster puis ouvrir la fiche qui merite la revue.`)
      return
    }

    if (activeTab === 'owned') {
      const priorityBits = []
      const incomplete = Number(cockpitData?.incomplete?.count || 0)
      const duplicates = Number(cockpitData?.duplicates?.count || 0)
      const sell = Number(cockpitData?.sell_candidates?.count || 0)
      const upgrades = Number(cockpitData?.upgrade_candidates?.count || 0)
      if (duplicates) priorityBits.push(`${duplicates} doublon(s)`)
      if (sell) priorityBits.push(`${sell} sortie(s) possible(s)`)
      if (upgrades) priorityBits.push(`${upgrades} upgrade(s)`)
      if (incomplete) priorityBits.push(`${incomplete} prix paye manquant(s)`)
      setText(modeTitleEl, 'ETAGERE')
      setText(
        modeCopyEl,
        priorityBits.length
          ? `Maintenant : ${priorityBits.slice(0, 3).join(' | ')}.`
          : 'Etagere stable. Ouvrir une fiche pour verifier contexte, valeur et action.'
      )
      return
    }

    if (activeTab === 'all') {
      const duplicates = Number(cockpitData?.duplicates?.count || 0)
      const sell = Number(cockpitData?.sell_candidates?.count || 0)
      const incomplete = Number(cockpitData?.incomplete?.count || 0)
      const priorities = []
      if (duplicates) priorities.push(`${duplicates} doublon(s)`)
      if (sell) priorities.push(`${sell} sortie(s)`)
      if (incomplete) priorities.push(`${incomplete} prix paye manquant(s)`)
      setText(modeTitleEl, 'PRIORITE DU MOMENT')
      setText(
        modeCopyEl,
        priorities.length
          ? `Maintenant : ${priorities.slice(0, 3).join(' | ')}. La liste est deja triee pour ouvrir la prochaine decision.`
          : 'Revue globale stable. Garder le tri prioritaire puis ouvrir la prochaine fiche utile.'
      )
      return
    }

    if (activeTab === 'wanted') {
      const affordable = Number(cockpitData?.affordable_wishlist?.count || 0)
      const stale = Number(cockpitData?.stale_wishlist?.count || 0)
      setText(modeTitleEl, 'WISHLIST')
      setText(
        modeCopyEl,
        affordable
          ? `${affordable} entree(s) restent accessibles maintenant.${stale ? ` ${stale} sont anciennes.` : ''} Prioriser puis qualifier.`
          : 'Suivre la wishlist puis ouvrir les fiches a fort potentiel.'
      )
      return
    }

    setText(modeTitleEl, 'A VENDRE')
    setText(modeCopyEl, 'Verifier prix, note et etat avant diffusion ou echange.')
  }

  function buildFocusDecision(item) {
    const game = getGame(item)
    const loosePrice = Number(game.loosePrice || 0)
    const cibPrice = Number(game.cibPrice || 0)
    const paid = Number(item.price_paid || 0)
    const gain = paid > 0 ? loosePrice - paid : null

    if (activeCockpitSignal === 'duplicates') {
      return 'Doublon detecte. Comparer etat, note et prix paye avant arbitrage.'
    }
    if (activeCockpitSignal === 'sell_candidates') {
      const sellEstimate = loosePrice > 0 ? Math.round(loosePrice * 0.85) : null
      const sellLine = sellEstimate != null ? ` Prix de vente realiste estime : $${sellEstimate} (loose marche x0.85).` : ''
      return `Sortie plausible. Verifier delta et pertinence avant de mettre en vente.${sellLine}`
    }
    if (activeCockpitSignal === 'upgrade_candidates') {
      return 'Upgrade plausible. Comparer votre etat actuel au saut vers CIB ou Mint.'
    }
    if (activeCockpitSignal === 'incomplete') {
      return 'Entree fragile. Verifier etat, note et metadata avant de la laisser dormir.'
    }
    if (activeCockpitSignal === 'affordable_wishlist') {
      return 'Achat accessible. Ouvrir la fiche puis qualifier avant arbitrage.'
    }
    if (activeCockpitSignal === 'stale_wishlist') {
      return 'Wishlist ancienne. Verifier si le jeu doit rester cible ou sortir de la liste.'
    }
    if (activeTab === 'wanted') {
      return loosePrice > 0
        ? `Point d entree a ${formatCurrency(loosePrice)}. Qualifier avant achat.`
        : 'Wishlist en veille. Ouvrir la fiche pour verifier la qualite et le contexte.'
    }
    if (activeTab === 'for_sale') {
      return 'Pret a sortir. Verifier prix, note et etat avant diffusion.'
    }
    if (gain != null && gain > 0) {
      return `Delta positif ${formatCurrency(gain)}. Garder ou sortir selon la priorite de collection.`
    }
    if (cibPrice > loosePrice && String(item.condition || '').toLowerCase() === 'loose') {
      return 'Loose en etagere. Regarder si un upgrade CIB change vraiment la valeur.'
    }
    return 'Lecture stable. Ouvrir la fiche pour verifier contexte, valeur et priorite.'
  }

  function formatPreviewValue(value) {
    const numeric = Number(value || 0)
    return numeric > 0 ? formatCurrency(numeric) : 'n/a'
  }

  function formatGainValue(gain) {
    if (gain == null) return 'n/a'
    if (gain >= 0) return `+${formatCurrency(gain)}`
    return `-${formatCurrency(Math.abs(gain))}`
  }

  function getPersonalStatusLabel(item) {
    const listType = String(item?.list_type || activeTab || 'owned').toLowerCase()
    if (listType === 'for_sale') return 'A vendre'
    if (listType === 'wanted') return 'En wishlist'
    return 'En etagere'
  }

  function getPriceTrustSummary(game) {
    const confidence = Number(game?.sourceConfidence || 0)
    if (confidence >= 0.7) return 'T1 fiable'
    if (confidence >= 0.5) return 'T2 estime'
    if (confidence > 0) return 'T3 indicatif'
    return 'non qualifie'
  }

  function getPriceFreshnessSummary(game) {
    const rawDate = String(game?.priceLastUpdated || game?.price_last_updated || '').trim()
    if (!rawDate) return 'date inconnue'
    const updatedAt = new Date(rawDate)
    const time = updatedAt.getTime()
    if (!Number.isFinite(time)) return 'date inconnue'
    const ageDays = Math.floor((Date.now() - time) / 86400000)
    if (ageDays <= 30) return 'maj recente'
    if (ageDays <= 90) return 'maj suivie'
    return 'maj ancienne'
  }

  function collectionStateMarkup(title, copy, actionMarkup = '') {
    return `
      <div class="terminal-empty-state">
        <div class="terminal-empty-title">${escapeHtml(title)}</div>
        ${copy ? `<div class="terminal-empty-copy">${escapeHtml(copy)}</div>` : ''}
        ${actionMarkup || ''}
      </div>
    `
  }

  async function patchCollectionItem(itemId, payload, successMessage) {
    if (!itemId) {
      return
    }

    setStatus('Mise a jour...')
    try {
      await fetchJson(`/api/collection/${encodeURIComponent(itemId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      await loadCollection(itemId)
      setStatus(successMessage)
    } catch (error) {
      setStatus(`Erreur mise a jour : ${error.message}`)
    }
  }

  function renderFocusQuickActions(item) {
    if (isPublicForSaleView || !item) {
      return ''
    }

    const listType = String(item.list_type || activeTab || 'owned').toLowerCase()
    const hasPricePaid = Number(item.price_paid || 0) > 0
    const actions = []

    if (listType === 'for_sale') {
      actions.push(`
        <button id="collection-return-btn" class="terminal-inline-btn" type="button">
          REPASSER A L'ETAGERE
        </button>
      `)
    } else if (listType === 'wanted') {
      actions.push(`
        <button id="collection-mark-owned-btn" class="terminal-inline-btn" type="button">
          PASSER A L'ETAGERE
        </button>
      `)
    } else if (listType !== 'wanted') {
      actions.push(`
        <button id="collection-mark-sale-btn" class="terminal-inline-btn" type="button">
          MARQUER A VENDRE
        </button>
      `)
    }

    if (listType !== 'wanted' && !hasPricePaid) {
      actions.push(`
        <button id="collection-fill-price-btn" class="terminal-inline-btn" type="button">
          RENSEIGNER PRIX PAYE
        </button>
      `)
    }

    return actions.length
      ? `<span class="terminal-preview-row surface-action-row" style="gap:8px;flex-wrap:wrap">${actions.join('')}</span>`
      : ''
  }

  function renderDetailMetascore(score) {
    if (!detailMetascoreEl || !window.RetroDexMetascore) return
    detailMetascoreEl.innerHTML = ''
    detailMetascoreEl.appendChild(window.RetroDexMetascore.renderBlock(score ?? null))
  }

  function emptyListMessage() {
    if (activeTab === 'owned') {
      return {
        title: 'Etagere vide',
        copy: 'Ajoute ton premier jeu depuis une fiche RetroDex. Recherche un titre, ouvre la fiche, clique Ajouter a la collection.',
        linkLabel: 'Ouvrir RetroDex',
      }
    }
    if (activeTab === 'wanted') {
      return {
        title: 'Wishlist vide',
        copy: 'Ajoute des jeux a ta wishlist depuis une fiche. Les jeux sous $25 (loose) apparaissent dans le signal WISHLIST <= $25.',
        linkLabel: 'Explorer RetroDex',
      }
    }
    if (activeTab === 'for_sale') {
      return {
        title: 'Aucun jeu a vendre',
        copy: 'Marque des jeux comme "a vendre" depuis l\'etagere ou depuis une fiche quand le signal A VENDRE est actif.',
        linkLabel: 'Ouvrir l\'etagere',
      }
    }
    return {
      title: 'Revue vide',
      copy: 'Ajoute des jeux a l etagere ou a la wishlist pour voir les priorites, la valeur et les actions.',
      linkLabel: 'Ouvrir RetroDex',
    }
  }

  function updateSummaryFromItems(items) {
    const totals = items.reduce(
      (acc, item) => {
        const game = getGame(item)
        const loose = Number(game.loosePrice || 0)
        const paid = Number(item.price_paid || 0)
        acc.total += 1
        acc.loose += loose
        acc.cib += Number(game.cibPrice || 0)
        acc.mint += Number(game.mintPrice || 0)
        acc.paid += paid
        if (paid > 0) {
          acc.gain += loose - paid
          acc.hasGain = true
        }
        return acc
      },
      { total: 0, loose: 0, cib: 0, mint: 0, paid: 0, gain: 0, hasGain: false }
    )

    setText(statTotalEl, String(totals.total || 0))
    setText(statValueLooseEl, totals.loose ? formatCurrency(totals.loose) : '$0')
    setText(statPaidEl, totals.paid ? formatCurrency(totals.paid) : '-')
    setGainValue(statGainEl, totals.hasGain ? totals.gain : null)
    setText(statValueCibEl, totals.cib ? formatCurrency(totals.cib) : '-')
    setText(statValueMintEl, totals.mint ? formatCurrency(totals.mint) : '-')
  }

  async function updateOwnedSummaryFromStats(fallbackItems) {
    try {
      const stats = await fetchJson('/api/collection/stats')
      setText(statTotalEl, String(stats.total || stats.count || 0))
      setText(statValueLooseEl, stats.total_loose ? formatCurrency(stats.total_loose) : '$0')
      setText(statPaidEl, stats.total_paid ? formatCurrency(stats.total_paid) : '-')
      setGainValue(statGainEl, stats.profit_estimate != null ? Number(stats.profit_estimate) : null)
      setText(statValueCibEl, stats.total_cib ? formatCurrency(stats.total_cib) : '-')
      setText(statValueMintEl, stats.total_mint ? formatCurrency(stats.total_mint) : '-')
    } catch (_error) {
      updateSummaryFromItems(fallbackItems)
    }
  }

  function syncTabUi(activeButton) {
    tabButtons.forEach((button) => {
      const isActive = button.dataset.list === activeTab
      button.classList.toggle('active', isActive)
      if (button !== activeButton && activeButton) {
        button.classList.remove('active')
      }
      button.disabled = isPublicForSaleView && button.dataset.list !== 'for_sale'
    })

    publicBannerEl.style.display = isPublicForSaleView && activeTab === 'for_sale' ? 'block' : 'none'
    copySaleLinkButtonEl.style.display = activeTab === 'for_sale' ? 'inline-block' : 'none'
  }

  function clearSelection() {
    selectedIndex = -1
    selectedCollectionItem = null
    hideEditForm()
    qsa('.terminal-row', collectionListContainerEl).forEach((row) => row.classList.remove('selected'))
    if (detailFocusStateEl) detailFocusStateEl.innerHTML = ''
    if (detailSignalGridEl) detailSignalGridEl.innerHTML = ''
    if (detailChipRowEl) detailChipRowEl.innerHTML = ''
    if (detailSummaryEl) detailSummaryEl.textContent = ''
    if (detailNextStepEl) detailNextStepEl.textContent = ''
    if (detailMetascoreEl) detailMetascoreEl.innerHTML = ''
    if (detailRow2El) detailRow2El.innerHTML = ''
    collectionDetailEl.style.display = 'none'
  }

  function openSelectedItem() {
    if (!selectedCollectionItem) return
    const game = getGame(selectedCollectionItem)
    const gameId = game.id || selectedCollectionItem.gameId || selectedCollectionItem.id
    if (gameId) {
      window.location.href = `/game-detail.html?id=${encodeURIComponent(gameId)}`
    }
  }

  function selectCollectionItem(item, rowEl) {
    qsa('.terminal-row', collectionListContainerEl).forEach((row) => row.classList.remove('selected'))
    rowEl.classList.add('selected')
    selectedIndex = Number(rowEl.dataset.index || '-1')
    selectedCollectionItem = item

    const game = getGame(item)
    const note = getCollectionNote(item)
    const gameId = game.id || item.gameId || item.id || ''
    const consoleName = game.console || game.platform || '-'
    const year = game.year || '-'
    const developer = game.developer || 'Archive'
    const loosePrice = Number(game.loosePrice || 0)
    const cibPrice = Number(game.cibPrice || 0)
    const mintPrice = Number(game.mintPrice || 0)
    const paid = Number(item.price_paid || 0)
    const gain = paid > 0 ? loosePrice - paid : null
    const reviewCue = getReviewCue(item)
    const previewCopy = note || game.tagline || game.summary || game.synopsis || 'Sans note personnelle. La fiche reste la meilleure lecture.'
    const focusDecision = buildFocusDecision(item)
    hideEditForm()

    collectionDetailEl.style.display = 'block'
    setText(detailTitleEl, game.title || '?')
    detailRow1El.innerHTML = `${escapeHtml(consoleName)} | ${escapeHtml(year)} | ${escapeHtml(developer)}`
    if (detailFocusStateEl) {
      detailFocusStateEl.innerHTML = `
        <span class="surface-chip is-primary">${escapeHtml(getPersonalStatusLabel(item))}</span>
        ${activeCockpitSignal ? `<span class="surface-chip is-hot">${escapeHtml(getSignalLabel(activeCockpitSignal))}</span>` : ''}
        <span class="surface-chip${reviewCue.tone ? ` ${reviewCue.tone}` : ''}">${escapeHtml(reviewCue.label)}</span>
      `
    }
    if (detailSignalGridEl) {
      detailSignalGridEl.className = 'surface-signal-grid is-four'
      detailSignalGridEl.innerHTML = `
        <div class="surface-signal-card">
          <span class="surface-signal-label">STATUT</span>
          <span class="surface-signal-value">${escapeHtml(getPersonalStatusLabel(item))}</span>
        </div>
        <div class="surface-signal-card">
          <span class="surface-signal-label">Valeur</span>
          <span class="surface-signal-value is-alert">${escapeHtml(formatPreviewValue(loosePrice))}</span>
        </div>
        <div class="surface-signal-card">
          <span class="surface-signal-label">Ecart</span>
          <span class="surface-signal-value${gain == null ? ' is-muted' : gain >= 0 ? ' is-hot' : ''}">${escapeHtml(formatGainValue(gain))}</span>
        </div>
        <div class="surface-signal-card">
          <span class="surface-signal-label">Confiance</span>
          <span class="surface-signal-value">${escapeHtml(`${getPriceTrustSummary(game)} | ${getPriceFreshnessSummary(game)}`)}</span>
        </div>
      `
    }

    if (detailChipRowEl) {
      detailChipRowEl.innerHTML = `
        <span class="surface-chip is-primary">${escapeHtml(item.condition || 'Archive')}</span>
        <span class="surface-chip">${escapeHtml(paid > 0 ? `Investi ${formatCurrency(paid)}` : 'Investi n/a')}</span>
        ${cibPrice ? `<span class="surface-chip">CIB ${escapeHtml(formatCurrency(cibPrice))}</span>` : ''}
        ${mintPrice ? `<span class="surface-chip">Mint ${escapeHtml(formatCurrency(mintPrice))}</span>` : ''}
        ${item.purchase_date ? `<span class="surface-chip">Entree ${escapeHtml(item.purchase_date)}</span>` : ''}
        ${item.price_threshold ? `<span class="surface-chip">Seuil ${escapeHtml(formatCurrency(item.price_threshold))}</span>` : ''}
        ${game.rarity ? `<span class="surface-chip is-hot">${escapeHtml(game.rarity)}</span>` : ''}
      `
    }

    if (detailSummaryEl) {
      detailSummaryEl.textContent = previewCopy
    }
    if (detailNextStepEl) {
      detailNextStepEl.innerHTML = `<span class="focus-next-label">PROCHAINE ACTION</span><span class="collection-next-step-copy">${escapeHtml(focusDecision)}</span>`
    }

    renderDetailMetascore(game.metascore)

    detailRow2El.innerHTML = `
      <a href="/game-detail.html?id=${encodeURIComponent(gameId)}" class="terminal-action-link is-primary-action">OUVRIR LA FICHE →</a>
      <a href="/stats.html?q=${encodeURIComponent(game.title || '')}" class="terminal-action-link">Lecture avancee &rarr;</a>
      ${renderFocusQuickActions(item)}
      ${isPublicForSaleView && activeTab === 'for_sale' ? '' : `
        <button id="collection-edit-btn" class="terminal-inline-btn" type="button">
          MODIFIER
        </button>
        <button id="collection-remove-btn" class="terminal-inline-btn" type="button">
          RETIRER
        </button>
      `}
    `

    const editBtn = byId('collection-edit-btn')
    if (editBtn) {
      editBtn.onclick = () => startEdit(item)
    }
    const removeBtn = byId('collection-remove-btn')
    if (removeBtn) {
      removeBtn.onclick = () => removeFromCollection(item.id || item.gameId)
    }
    const markSaleBtn = byId('collection-mark-sale-btn')
    if (markSaleBtn) {
      markSaleBtn.onclick = () => patchCollectionItem(item.id || item.gameId, { list_type: 'for_sale' }, 'Jeu marque a vendre.')
    }
    const returnBtn = byId('collection-return-btn')
    if (returnBtn) {
      returnBtn.onclick = () => patchCollectionItem(item.id || item.gameId, { list_type: 'owned' }, 'Jeu remis a l etagere.')
    }
    const markOwnedBtn = byId('collection-mark-owned-btn')
    if (markOwnedBtn) {
      markOwnedBtn.onclick = async () => {
        await patchCollectionItem(item.id || item.gameId, { list_type: 'owned' }, 'Jeu passe a l etagere.')
        const updatedItem = enrichedItems.find((entry) => String(entry.id || entry.gameId) === String(item.id || item.gameId))
        if (updatedItem) {
          startEdit(updatedItem, 'price')
        }
      }
    }
    const fillPriceBtn = byId('collection-fill-price-btn')
    if (fillPriceBtn) {
      fillPriceBtn.onclick = () => startEdit(item, 'price')
    }
  }

  function setSelectedIndex(nextIndex) {
    const rows = qsa('.terminal-row', collectionListContainerEl)
    if (!rows.length || nextIndex < 0 || nextIndex >= enrichedItems.length) return
    const row = rows.find((node) => Number(node.dataset.index) === nextIndex)
    if (!row) return
    selectCollectionItem(enrichedItems[nextIndex], row)
    row.scrollIntoView({ block: 'nearest' })
  }

  function renderCollectionRow(item, index) {
    const game = getGame(item)
    const loosePrice = Number(game.loosePrice || 0)
    const cibPrice = Number(game.cibPrice || 0)
    const mintPrice = Number(game.mintPrice || 0)
    const paid = Number(item.price_paid || 0)
    const gain = paid > 0 ? loosePrice - paid : null
    const gainStr = gain !== null
      ? gain >= 0
        ? `+$${Math.round(gain)}`
        : `-$${Math.round(Math.abs(gain))}`
      : '-'
    const gainClass = gain === null ? '' : gain >= 0 ? 'positive' : 'negative'
    const listType = String(item.list_type || activeTab || 'owned').toLowerCase()
    const reviewCue = getReviewCue(item)
    const statusBadge = listType === 'for_sale'
      ? '<span class="surface-chip is-hot collection-status-chip">A VENDRE</span>'
      : listType === 'wanted'
        ? '<span class="surface-chip collection-status-chip">WISHLIST</span>'
        : '<span class="surface-chip is-primary collection-status-chip">ETAGERE</span>'

    const row = document.createElement('div')
    row.className = 'terminal-row'
    row.setAttribute('role', 'row')
    row.dataset.itemId = String(item.id || item.gameId || '')
    row.dataset.index = String(index)
    row.style.gridTemplateColumns = '12px 1fr 90px 60px 70px 70px 70px 70px 70px'
    row.innerHTML = `
      <span role="cell" class="terminal-row-indicator">></span>
      <span role="cell" class="collection-row-main">
        <span class="collection-row-title">${escapeHtml(game.title || '?')}</span>
        <span class="collection-row-cue${reviewCue.tone ? ` ${reviewCue.tone}` : ''}">${escapeHtml(reviewCue.label)}</span>
        <span class="collection-row-status">${statusBadge}</span>
      </span>
      <span role="cell" style="color:var(--text-muted);font-size:10px">${escapeHtml(game.console || game.platform || '-')}</span>
      <span role="cell" class="condition-badge badge--condition" data-condition="${escapeHtml(item.condition || '')}" style="font-size:9px;border:1px solid var(--border);padding:1px 4px;text-align:center">${escapeHtml(item.condition || '-')}</span>
      <span role="cell" style="text-align:right;color:var(--text-alert)">${loosePrice ? formatCurrency(loosePrice) : '-'}</span>
      <span role="cell" style="text-align:right;color:var(--text-muted)">${cibPrice ? formatCurrency(cibPrice) : '-'}</span>
      <span role="cell" style="text-align:right;color:var(--text-muted)">${mintPrice ? formatCurrency(mintPrice) : '-'}</span>
      <span role="cell" style="text-align:right;color:var(--text-muted)">${paid ? formatCurrency(paid) : '-'}</span>
      <span role="cell" style="text-align:right" class="${gainClass}">${gainStr}</span>
    `
    window.RetroDexAssets?.decorateConditionBadges?.(row)
    row.addEventListener('click', () => selectCollectionItem(item, row))
    row.addEventListener('dblclick', openSelectedItem)
    return row
  }

  function appendCollectionSpacer(items) {
    if (items.length >= 6) return

    const spacer = document.createElement('div')
    spacer.style.cssText = 'border:1px solid var(--border);border-top:none;background:rgba(6,10,6,0.88)'

    if (!items.length) {
      const message = emptyListMessage()
      spacer.innerHTML = collectionStateMarkup(
        message.title,
        message.copy,
        message.linkLabel ? `<div class="terminal-empty-copy"><a href="/search.html" class="terminal-action-link">${escapeHtml(message.linkLabel)}</a></div>` : ''
      )
    } else {
      spacer.innerHTML = `
        <div class="terminal-quiet-note">
          ${items.length} entree(s) visibles. <a href="/games-list.html" class="terminal-action-link">&rarr; Ouvrir RetroDex</a>
        </div>
      `
    }

    collectionListContainerEl.appendChild(spacer)
  }

  function renderEvolutionPanel(ownedItems) {
    const panelEl = byId('collection-evolution')
    if (!panelEl) return

    if (!ownedItems || !ownedItems.length) {
      panelEl.hidden = true
      return
    }

    const now = new Date()
    const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
    const qPrevStart = new Date(qStart)
    qPrevStart.setMonth(qPrevStart.getMonth() - 3)

    let thisQ = 0
    let lastQ = 0
    let totalCost = 0
    let totalValue = 0
    let costCount = 0
    let valueCount = 0
    let deltaSum = 0
    let deltaCount = 0
    const condCount = { Loose: 0, CIB: 0, Mint: 0 }

    for (const item of ownedItems) {
      const dateRaw = item.purchase_date || item.created_at || item.added_at
      if (dateRaw) {
        const d = new Date(dateRaw)
        if (d >= qStart) thisQ++
        else if (d >= qPrevStart) lastQ++
      }
      const paid = Number(item.price_paid || 0)
      if (paid > 0) { totalCost += paid; costCount++ }
      const loose = Number((item.Game || item.game)?.loosePrice || 0)
      if (loose > 0) { totalValue += loose; valueCount++ }
      if (paid > 0 && loose > 0) { deltaSum += (loose - paid); deltaCount++ }
      const cond = String(item.condition || 'Loose')
      if (condCount[cond] !== undefined) condCount[cond]++
    }

    const avgDelta = deltaCount > 0 ? Math.round(deltaSum / deltaCount) : null

    const setText_ = (id, val) => { const el = byId(id); if (el) el.textContent = val }
    setText_('evo-this-quarter', String(thisQ))
    setText_('evo-last-quarter', String(lastQ))
    setText_('evo-total-cost', costCount > 0 ? `$${Math.round(totalCost)}` : '-')
    setText_('evo-total-value', valueCount > 0 ? `$${Math.round(totalValue)}` : '-')
    setText_('evo-avg-delta', avgDelta !== null ? (avgDelta >= 0 ? `+$${avgDelta}` : `-$${Math.abs(avgDelta)}`) : '-')
    setText_('evo-condition-dist', `${condCount.Loose}L · ${condCount.CIB}C · ${condCount.Mint}M`)

    panelEl.hidden = false

    // Budget rotation — cross-reference sell candidates et affordable wishlist
    if (cockpitData) {
      const sellItems = cockpitData.sell_candidates?.items || []
      const wishItems = cockpitData.affordable_wishlist?.items || []
      const totalSellValue = sellItems.reduce((sum, it) => sum + (Number(it.loosePrice) || 0), 0)
      const wishCount = wishItems.length
      const rotationEl = byId('evo-rotation-budget')
      const rotationWishEl = byId('evo-rotation-wish')
      if (rotationEl) rotationEl.textContent = totalSellValue > 0 ? `$${Math.round(totalSellValue)}` : '-'
      if (rotationWishEl) rotationWishEl.textContent = wishCount > 0 ? `${wishCount} item(s) finançables` : '-'
    }
  }

  function renderEmptyState() {
    clearSelection()
    setHtml(collectionListContainerEl, '')
    appendCollectionSpacer([])
  }

  function renderFilteredEmptyState() {
    clearSelection()
    setHtml(
      collectionListContainerEl,
      collectionStateMarkup(
        'Aucun resultat visible',
        activeCockpitSignal
          ? `Aucune entree ne correspond a ${getSignalLabel(activeCockpitSignal)} avec les filtres actifs.`
          : 'Aucun item ne correspond aux filtres actifs. Ajustez la recherche ou la console.'
      )
    )
  }

  function renderCollection(items, preferredItemId = null) {
    if (!items.length) {
      renderEmptyState()
      return
    }

    setHtml(collectionListContainerEl, '')
    items.forEach((item, index) => {
      collectionListContainerEl.appendChild(renderCollectionRow(item, index))
    })
    appendCollectionSpacer(items)

    const targetItemId = preferredItemId ? String(preferredItemId) : ''
    const nextRow = targetItemId
      ? qsa('.terminal-row', collectionListContainerEl).find((row) => row.dataset.itemId === targetItemId)
      : collectionListContainerEl.querySelector('.terminal-row')

    if (nextRow) {
      const nextItem = items.find((item) => String(item.id || item.gameId || '') === nextRow.dataset.itemId) || items[0]
      selectCollectionItem(nextItem, nextRow)
    }
  }

  async function refreshCollectionView(preferredItemId = null) {
    const visibleItems = hasActiveCollectionFilters()
      ? await loadCollectionSearchResults()
      : applyCollectionFilters(allCollectionItems)
    enrichedItems = visibleItems

    if (activeTab === 'owned' && !hasActiveCollectionFilters()) {
      await updateOwnedSummaryFromStats(allCollectionItems)
    } else {
      updateSummaryFromItems(visibleItems)
    }

    if (!visibleItems.length && allCollectionItems.length > 0) {
      renderFilteredEmptyState()
      setStatus('Aucun item ne correspond aux filtres actifs.')
      updateCockpitLead(0, allCollectionItems.length)
      return
    }

    renderCollection(visibleItems, preferredItemId)
    if (activeTab === 'owned' || activeTab === 'all') renderEvolutionPanel(allCollectionItems)
    updateCockpitLead(visibleItems.length, allCollectionItems.length)
    const baseLabel = `${visibleItems.length} entree(s)`
    setStatus(visibleItems.length === allCollectionItems.length
      ? `${baseLabel} dans ${getTabLabel(activeTab)}.`
      : `${baseLabel} visible(s) sur ${allCollectionItems.length} dans ${getTabLabel(activeTab)}.`)
  }

  async function copySaleLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/collection.html?view=for_sale`)
      setStatus('Lien de vente copie.')
      if (copyFeedbackTimer) {
        window.clearTimeout(copyFeedbackTimer)
      }
      copyFeedbackTimer = window.setTimeout(() => {
        setStatus(`${enrichedItems.length} item(s) dans ${getTabLabel(activeTab)}.`)
      }, 1800)
    } catch (_error) {
      setStatus('Copie impossible.')
    }
  }

  async function removeFromCollection(itemId) {
    if (!itemId || (isPublicForSaleView && activeTab === 'for_sale')) return

    const item = enrichedItems.find((entry) => String(entry.id || entry.gameId || '') === String(itemId))
    const title = getGame(item).title || 'ce jeu'
    if (!window.confirm(`Retirer "${title}" ${activeTab === 'wanted' ? 'de votre wishlist' : activeTab === 'for_sale' ? 'de votre liste a vendre' : 'de votre etagere'} ?`)) {
      return
    }

    setStatus('Suppression...')
    try {
      await fetchJson(`/api/collection/${encodeURIComponent(itemId)}`, { method: 'DELETE' })
      await loadCollection()
      setStatus('Jeu retire.')
    } catch (error) {
      setStatus(`Erreur suppression : ${error.message}`)
    }
  }

  async function saveCollectionItemEdits() {
    if (!editingItemId || !selectedCollectionItem) {
      return
    }

    setStatus('Enregistrement...')
    editSaveButtonEl.disabled = true

    try {
      const payload = readEditFormValues()
      await fetchJson(`/api/collection/${encodeURIComponent(editingItemId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      hideEditForm()
      await loadCollection(editingItemId)
      setStatus('Fiche collection mise a jour.')
    } catch (error) {
      setStatus(`Erreur mise à jour : ${error.message}`)
    } finally {
      editSaveButtonEl.disabled = false
    }
  }

  function exportCollectionCsv() {
    if (!enrichedItems.length) {
      setStatus('Aucun item a exporter.')
      return
    }

    const rows = [
      ['title', 'console', 'list_type', 'condition', 'purchase_price', 'purchase_date', 'notes'],
      ...enrichedItems.map((item) => {
        const game = getGame(item)
        return [
          game.title || '',
          game.console || game.platform || '',
          item.list_type || activeTab,
          item.condition || '',
          item.price_paid ?? '',
          item.purchase_date || '',
          getCollectionNote(item),
        ]
      }),
    ]

    const csv = rows
      .map((columns) => columns.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `retrodex-${activeTab}-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
    setStatus(`Export CSV genere pour ${enrichedItems.length} item(s).`)
  }

  async function loadCollection(preferredItemId = null) {
    clearSelection()
    setStatus('Chargement de la collection...')
    setHtml(collectionListContainerEl, collectionStateMarkup('Chargement', 'Lecture des lignes de collection et des signaux associes.'))
    updateCockpitLead(0, allCollectionItems.length)
    const slowTimer = window.setTimeout(() => {
      setStatus('Chargement lent... la collection reste en cours de lecture.')
      runtimeMonitor?.mark('slow-load', { tab: activeTab })
    }, 4500)

    try {
      let items
      if (activeTab === 'all') {
        const payload = await fetchCollection(null, isPublicForSaleView)
        items = payload.items.filter((item) => Object.keys(getGame(item)).length > 0)
      } else {
        const payload = await fetchCollection(activeTab, isPublicForSaleView)
        items = payload.items.filter((item) => Object.keys(getGame(item)).length > 0)
      }
      allCollectionItems = items
      populateConsoleFilter(items)

      if (!items.length) {
        enrichedItems = []
        updateSummaryFromItems([])
        renderEmptyState()
        setStatus(emptyListMessage().title)
        updateCockpitLead(0, 0)
        return
      }

      await refreshCollectionView(preferredItemId)
      runtimeMonitor?.success({
        tab: activeTab,
        total: allCollectionItems.length,
        visible: enrichedItems.length,
      })
    } catch (error) {
      allCollectionItems = []
      enrichedItems = []
      updateSummaryFromItems([])
      setHtml(
        collectionListContainerEl,
        collectionStateMarkup(
          'Collection indisponible',
          'Impossible de lire les lignes de collection pour le moment.',
          '<div class="terminal-empty-copy"><a href="/games-list.html" class="terminal-action-link">Ouvrir RetroDex &rarr;</a></div>'
        )
      )
      clearSelection()
      setStatus(`Erreur collection : ${error.message}`)
      updateCockpitLead(0, 0)
      runtimeMonitor?.fail(error)
    } finally {
      window.clearTimeout(slowTimer)
    }
  }

  function switchCollectionTab(list, button) {
    if (isPublicForSaleView && list !== 'for_sale') return
    if (activeCockpitSignal) {
      clearCockpitFilter()
    }
    activeTab = list
    if (list === 'all' && collectionSortSelectEl && collectionSortSelectEl.value !== 'review_desc') {
      collectionSortSelectEl.value = 'review_desc'
    }
    if (list === 'wanted' && collectionSortSelectEl && collectionSortSelectEl.value !== 'value_asc') {
      collectionSortSelectEl.value = 'value_asc'
    }
    if (list === 'for_sale' && collectionSortSelectEl && collectionSortSelectEl.value !== 'delta_desc') {
      collectionSortSelectEl.value = 'delta_desc'
    }
    syncTabUi(button)
    loadCollection()
  }

  function bindTabs() {
    if (collectionSearchInputEl && initialQuery) {
      collectionSearchInputEl.value = initialQuery
    }

    tabButtons.forEach((button) => {
      button.addEventListener('click', () => switchCollectionTab(button.dataset.list || 'owned', button))
    })
    if (addButtonEl) {
      addButtonEl.addEventListener('click', () => {
        window.location.href = '/search.html'
      })
    }
    if (copySaleLinkButtonEl) {
      copySaleLinkButtonEl.addEventListener('click', copySaleLink)
    }
    collectionSearchInputEl?.addEventListener('input', () => {
      refreshCollectionView(selectedCollectionItem?.id || selectedCollectionItem?.gameId || null)
    })
    collectionConsoleFilterEl?.addEventListener('change', () => {
      refreshCollectionView(selectedCollectionItem?.id || selectedCollectionItem?.gameId || null)
    })
    collectionSortSelectEl?.addEventListener('change', () => {
      refreshCollectionView(selectedCollectionItem?.id || selectedCollectionItem?.gameId || null)
    })
    collectionExportButtonEl?.addEventListener('click', exportCollectionCsv)
    editFormEl?.addEventListener('submit', (event) => {
      event.preventDefault()
      saveCollectionItemEdits()
    })
    editCancelButtonEl?.addEventListener('click', () => {
      if (selectedCollectionItem) {
        populateEditForm(selectedCollectionItem)
      }
      hideEditForm()
      setStatus(`${enrichedItems.length} item(s) dans ${getTabLabel(activeTab)}.`)
    })
  }

  function bindKeyboard() {
    document.addEventListener('keydown', (event) => {
      const tagName = event.target?.tagName
      const inField = tagName === 'INPUT' || tagName === 'TEXTAREA' || event.target?.isContentEditable

      if (event.key === '/' && !inField) {
        event.preventDefault()
        window.location.href = '/search.html'
      }

      if (inField || !enrichedItems.length) return

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSelectedIndex(selectedIndex < enrichedItems.length - 1 ? selectedIndex + 1 : 0)
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSelectedIndex(selectedIndex > 0 ? selectedIndex - 1 : enrichedItems.length - 1)
      }

      if (event.key === 'Enter' && selectedCollectionItem) {
        event.preventDefault()
        openSelectedItem()
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedCollectionItem) {
        event.preventDefault()
        removeFromCollection(selectedCollectionItem.id || selectedCollectionItem.gameId)
      }
    })
  }

  window.copySaleLink = copySaleLink
  window.removeFromCollection = removeFromCollection
  window.switchCollectionTab = switchCollectionTab

  // ── Cockpit signals ──────────────────────────────────────────────────────

  const cockpitBarEl = byId('cockpit-signals')
  const signalCards = cockpitBarEl ? Array.from(cockpitBarEl.querySelectorAll('.cockpit-signal-card')) : []

  function setCockpitCount(id, count) {
    const countEl = byId(id)
    if (!countEl) return
    countEl.textContent = String(count)
    countEl.classList.toggle('is-zero', count === 0)
  }

  function clearCockpitFilter() {
    activeCockpitSignal = null
    cockpitSignalItems = null
    signalCards.forEach((card) => {
      card.setAttribute('aria-pressed', 'false')
      card.classList.remove('is-active')
    })
    const filterIndicator = cockpitLeadEl?.querySelector('.cockpit-active-filter')
    if (filterIndicator) filterIndicator.remove()
    updateCockpitLead()
  }

  function applyCockpitFilter(signalKey, items) {
    activeCockpitSignal = signalKey
    cockpitSignalItems = items
    signalCards.forEach((card) => {
      const isActive = card.dataset.signal === signalKey
      card.setAttribute('aria-pressed', isActive ? 'true' : 'false')
      card.classList.toggle('is-active', isActive)
    })
    const activeCard = document.querySelector(`.cockpit-signal-card[data-signal="${signalKey}"]`)
    const signalLabel = activeCard?.querySelector('.cockpit-signal-label')?.textContent || signalKey.toUpperCase()
    let filterIndicator = cockpitLeadEl?.querySelector('.cockpit-active-filter')
    if (cockpitLeadEl) {
      if (!filterIndicator) {
        filterIndicator = document.createElement('span')
        filterIndicator.className = 'cockpit-active-filter'
        cockpitLeadEl.appendChild(filterIndicator)
      }
      filterIndicator.textContent = `— FILTRE: ${signalLabel}`
    }
    const targetTab = ['affordable_wishlist', 'stale_wishlist'].includes(signalKey) ? 'wanted' : 'owned'
    if (activeTab !== targetTab) {
      activeTab = targetTab
      syncTabUi()
    }
    updateCockpitLead()
    refreshCollectionView()
  }

  async function loadCockpitSignals() {
    if (!cockpitBarEl || isPublicForSaleView) return
    try {
      const data = await fetchJson('/api/collection/cockpit')
      cockpitData = data
      setCockpitCount('signal-duplicates-count', data.duplicates?.count || 0)
      setCockpitCount('signal-sell-count', data.sell_candidates?.count || 0)
      setCockpitCount('signal-upgrade-count', data.upgrade_candidates?.count || 0)
      setCockpitCount('signal-incomplete-count', data.incomplete?.count || 0)
      setCockpitCount('signal-wishlist-count', data.affordable_wishlist?.count || 0)
      setCockpitCount('signal-stale-count', data.stale_wishlist?.count || 0)

      // Réordonner les cards par urgence (count décroissant, non-zéro en premier)
      if (cockpitBarEl) {
        const signalOrder = [
          { key: 'duplicates', count: data.duplicates?.count || 0 },
          { key: 'sell_candidates', count: data.sell_candidates?.count || 0 },
          { key: 'upgrade_candidates', count: data.upgrade_candidates?.count || 0 },
          { key: 'incomplete', count: data.incomplete?.count || 0 },
          { key: 'affordable_wishlist', count: data.affordable_wishlist?.count || 0 },
          { key: 'stale_wishlist', count: data.stale_wishlist?.count || 0 },
        ]
        signalOrder.sort((a, b) => {
          if (a.count > 0 && b.count === 0) return -1
          if (a.count === 0 && b.count > 0) return 1
          return b.count - a.count
        })
        signalOrder.forEach(({ key }) => {
          const card = cockpitBarEl.querySelector(`.cockpit-signal-card[data-signal="${key}"]`)
          if (card) cockpitBarEl.appendChild(card)
        })
      }

      cockpitBarEl.style.display = 'grid'
      updateCockpitLead()

      signalCards.forEach((card) => {
        const key = card.dataset.signal
        const bucket = data[key] || {}
        card.addEventListener('click', () => {
          if (activeCockpitSignal === key) {
            clearCockpitFilter()
            refreshCollectionView()
          } else {
            applyCockpitFilter(key, bucket.items || [])
          }
        })
      })
      updateCockpitLead()
    } catch (_err) {
      cockpitData = null
      // non-fatal — cockpit is additive
    }
  }

  function init() {
    ensureReviewSortOptions()
    if (!isPublicForSaleView && collectionSortSelectEl) {
      collectionSortSelectEl.value = 'review_desc'
    }
    activeTab = isPublicForSaleView ? 'for_sale' : 'all'
    bindTabs()
    bindKeyboard()
    syncTabUi()
    updateSummaryFromItems([])
    updateCockpitLead()
    loadCollection()
    loadCockpitSignals()
  }

  init()
})()
