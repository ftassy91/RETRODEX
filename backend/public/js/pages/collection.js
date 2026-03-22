'use strict'

;(() => {
  const { byId, qsa, setHtml, setText } = window.RetroDexDom || {}
  const { escapeHtml, formatCurrency } = window.RetroDexFormat || {}
  const { fetchJson, fetchCollection } = window.RetroDexApi || {}
  const { getParams } = window.RetroDexState || {}

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
  const collectionSearchInputEl = byId('collection-search-input')
  const collectionConsoleFilterEl = byId('collection-console-filter')
  const collectionSortSelectEl = byId('collection-sort-select')
  const collectionExportButtonEl = byId('collection-export-btn')
  const collectionListContainerEl = byId('collection-list-container')
  const collectionDetailEl = byId('collection-detail')
  const detailTitleEl = byId('detail-title')
  const detailRow1El = byId('detail-row1')
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

  let enrichedItems = []
  let allCollectionItems = []
  let activeTab = isPublicForSaleView ? 'for_sale' : 'owned'
  let selectedIndex = -1
  let selectedCollectionItem = null
  let editingItemId = null
  let copyFeedbackTimer = null

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

  function hasActiveCollectionFilters() {
    return Boolean(
      collectionSearchInputEl?.value?.trim()
      || collectionConsoleFilterEl?.value
      || (collectionSortSelectEl?.value && collectionSortSelectEl.value !== 'title_asc')
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

  function sortCollectionItems(items) {
    const sortKey = collectionSortSelectEl?.value || 'title_asc'
    const sorted = [...items]

    sorted.sort((left, right) => {
      const leftGame = getGame(left)
      const rightGame = getGame(right)
      const leftPaid = Number(left.price_paid || 0)
      const rightPaid = Number(right.price_paid || 0)
      const leftLoose = Number(leftGame.loosePrice || 0)
      const rightLoose = Number(rightGame.loosePrice || 0)
      const titleCompare = String(leftGame.title || '').localeCompare(String(rightGame.title || ''), 'fr', { sensitivity: 'base' })

      switch (sortKey) {
        case 'title_desc':
          return String(rightGame.title || '').localeCompare(String(leftGame.title || ''), 'fr', { sensitivity: 'base' })
        case 'paid_desc':
          return rightPaid - leftPaid || titleCompare
        case 'paid_asc':
          return leftPaid - rightPaid || titleCompare
        case 'value_desc':
          return rightLoose - leftLoose || titleCompare
        default:
          return titleCompare
      }
    })

    return sorted
  }

  function applyCollectionFilters(items) {
    const query = normalizeText(collectionSearchInputEl?.value)
    const platform = collectionConsoleFilterEl?.value || ''

    return sortCollectionItems(items.filter((item) => {
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

  function startEdit(item) {
    if (!editFormEl || !item || (isPublicForSaleView && activeTab === 'for_sale')) {
      return
    }

    editingItemId = item.id || item.gameId || null
    populateEditForm(item)
    editFormEl.hidden = false
    editConditionEl?.focus()
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
    if (tab === 'wanted') return 'la wishlist'
    if (tab === 'for_sale') return 'la liste a vendre'
    return 'votre collection'
  }

  function emptyListMessage() {
    if (activeTab === 'wanted') {
      return {
        title: 'Wishlist vide',
        copy: 'Ouvrez Recherche pour ajouter un jeu a surveiller.'
      }
    }

    if (activeTab === 'for_sale') {
      return {
        title: 'Liste a vendre vide',
        copy: isPublicForSaleView
          ? 'Aucune entree n\'est actuellement proposee.'
          : 'Ajoutez un jeu a vendre depuis votre collection.'
      }
    }

    return {
      title: 'Collection vide',
      copy: 'Ouvrez Recherche pour ajouter une premiere entree a l\'etagere.'
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
    hideEditForm()

    collectionDetailEl.style.display = 'block'
    setText(detailTitleEl, game.title || '?')
    detailRow1El.innerHTML = `
      <span><span class="pv-label">Console </span><span class="pv-val">${escapeHtml(game.console || game.platform || '-')}</span></span>
      <span><span class="pv-label">Condition </span><span class="pv-val">${escapeHtml(item.condition || '-')}</span></span>
      <span><span class="pv-label">Achete le </span><span class="pv-val">${escapeHtml(item.purchase_date || '-')}</span></span>
      <span><span class="pv-label">Prix d'achat </span><span class="pv-val">${item.price_paid ? formatCurrency(item.price_paid) : '-'}</span></span>
    `

    const extraMeta = []
    if (note) {
      extraMeta.push(`<span><span class="pv-label">Note </span><span class="pv-val">${escapeHtml(note)}</span></span>`)
    }
    if (item.price_threshold) {
      extraMeta.push(`<span><span class="pv-label">Seuil </span><span class="pv-val">${formatCurrency(item.price_threshold)}</span></span>`)
    }

    detailRow2El.innerHTML = `
      ${extraMeta.join('')}
      <span>
        <a href="/game-detail.html?id=${encodeURIComponent(gameId)}" class="terminal-action-link">
          -> Voir la fiche
        </a>
      </span>
      ${isPublicForSaleView && activeTab === 'for_sale' ? '' : `
        <button id="collection-edit-btn" class="terminal-inline-btn">
          MODIFIER
        </button>
        <button id="collection-remove-btn" class="terminal-inline-btn">
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
    const paid = Number(item.price_paid || 0)
    const gain = paid > 0 ? loosePrice - paid : null
    const gainStr = gain !== null
      ? gain >= 0
        ? `+$${Math.round(gain)}`
        : `-$${Math.round(Math.abs(gain))}`
      : '-'
    const gainClass = gain === null ? '' : gain >= 0 ? 'positive' : 'negative'

    const row = document.createElement('div')
    row.className = 'terminal-row'
    row.style.gridTemplateColumns = '12px 1fr 90px 60px 70px 70px 70px'
    row.dataset.itemId = String(item.id || item.gameId || '')
    row.dataset.index = String(index)
    row.innerHTML = `
      <span class="terminal-row-indicator">></span>
      <span style="color:var(--text-primary)">${escapeHtml(game.title || '?')}</span>
      <span style="color:var(--text-muted);font-size:10px">${escapeHtml(game.console || game.platform || '-')}</span>
      <span style="font-size:9px;border:1px solid var(--border);padding:1px 4px;text-align:center">${escapeHtml(item.condition || '-')}</span>
      <span style="text-align:right;color:var(--text-alert)">${loosePrice ? formatCurrency(loosePrice) : '-'}</span>
      <span style="text-align:right;color:var(--text-muted)">${paid ? formatCurrency(paid) : '-'}</span>
      <span style="text-align:right" class="${gainClass}">${gainStr}</span>
    `
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
      spacer.innerHTML = `
        <div class="terminal-empty-state">
          <div class="terminal-empty-title">${escapeHtml(message.title)}</div>
          <div class="terminal-empty-copy">${escapeHtml(message.copy)}</div>
        </div>
      `
    } else {
      spacer.innerHTML = `
        <div class="terminal-quiet-note">
          ${items.length} entree(s) visibles. <a href="/search.html" class="terminal-action-link">-> Ajouter un jeu</a>
        </div>
      `
    }

    collectionListContainerEl.appendChild(spacer)
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
      `
        <div class="terminal-empty-state">
          <div class="terminal-empty-title">Aucun resultat visible</div>
          <div class="terminal-empty-copy">Aucun item ne correspond aux filtres actifs. Ajustez la recherche ou la console.</div>
        </div>
      `
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
    const visibleItems = applyCollectionFilters(allCollectionItems)
    enrichedItems = visibleItems

    if (activeTab === 'owned' && !hasActiveCollectionFilters()) {
      await updateOwnedSummaryFromStats(allCollectionItems)
    } else {
      updateSummaryFromItems(visibleItems)
    }

    if (!visibleItems.length && allCollectionItems.length > 0) {
      renderFilteredEmptyState()
      setStatus('Aucun item ne correspond aux filtres actifs.')
      return
    }

    renderCollection(visibleItems, preferredItemId)
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
    if (!window.confirm(`Retirer "${title}" ${activeTab === 'wanted' ? 'de votre wishlist' : 'de cette liste'} ?`)) {
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
      setStatus(`Erreur mise a jour : ${error.message}`)
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
    setStatus('Chargement...')
    setHtml(collectionListContainerEl, '')

    try {
      const payload = await fetchCollection(activeTab, isPublicForSaleView)
      const items = payload.items.filter((item) => Object.keys(getGame(item)).length > 0)
      allCollectionItems = items
      populateConsoleFilter(items)

      if (!items.length) {
        enrichedItems = []
        updateSummaryFromItems([])
        renderEmptyState()
        setStatus(emptyListMessage().title)
        return
      }

      await refreshCollectionView(preferredItemId)
    } catch (error) {
      allCollectionItems = []
      enrichedItems = []
      updateSummaryFromItems([])
      renderEmptyState()
      setStatus(`Erreur collection : ${error.message}`)
    }
  }

  function switchCollectionTab(list, button) {
    if (isPublicForSaleView && list !== 'for_sale') return
    activeTab = list
    syncTabUi(button)
    loadCollection()
  }

  function bindTabs() {
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

  function init() {
    bindTabs()
    bindKeyboard()
    syncTabUi()
    updateSummaryFromItems([])
    loadCollection()
  }

  init()
})()
