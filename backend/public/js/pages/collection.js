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
  const collectionListContainerEl = byId('collection-list-container')
  const collectionDetailEl = byId('collection-detail')
  const detailTitleEl = byId('detail-title')
  const detailRow1El = byId('detail-row1')
  const detailRow2El = byId('detail-row2')
  const publicBannerEl = byId('public-banner')
  const addButtonEl = byId('collection-add-btn')
  const tabButtons = qsa('[data-list]')
  const copySaleLinkButtonEl = byId('copy-sale-link-btn')
  const isPublicForSaleView = getParams().get('view') === 'for_sale'

  let enrichedItems = []
  let activeTab = isPublicForSaleView ? 'for_sale' : 'owned'
  let selectedIndex = -1
  let selectedCollectionItem = null
  let copyFeedbackTimer = null

  function getGame(item) {
    return item?.Game || item?.game || {}
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
    const note = item.notes || item.personal_note || ''
    const gameId = game.id || item.gameId || item.id || ''

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
        <button id="collection-remove-btn" class="terminal-inline-btn">
          RETIRER
        </button>
      `}
    `

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
    spacer.style.cssText = 'border:1px solid var(--border);border-top:none;padding:16px;font-family:var(--font-mono);font-size:10px;color:var(--text-muted);text-align:center'

    if (!items.length) {
      spacer.innerHTML = 'Collection vide. Utilisez [/] pour rechercher un jeu a ajouter.'
    } else {
      spacer.innerHTML = `${items.length} jeu(x) dans cette liste. <a href="/search.html" class="terminal-action-link">-> Ajouter un jeu</a>`
    }

    collectionListContainerEl.appendChild(spacer)
  }

  function renderEmptyState() {
    clearSelection()
    setHtml(collectionListContainerEl, '')
    appendCollectionSpacer([])
  }

  function renderCollection(items) {
    if (!items.length) {
      renderEmptyState()
      return
    }

    setHtml(collectionListContainerEl, '')
    items.forEach((item, index) => {
      collectionListContainerEl.appendChild(renderCollectionRow(item, index))
    })
    appendCollectionSpacer(items)
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

    setStatus('Suppression...')
    try {
      await fetchJson(`/api/collection/${encodeURIComponent(itemId)}`, { method: 'DELETE' })
      await loadCollection()
      setStatus('Jeu retire.')
    } catch (error) {
      setStatus(`Erreur suppression : ${error.message}`)
    }
  }

  async function loadCollection() {
    clearSelection()
    setStatus('Chargement...')
    setHtml(collectionListContainerEl, '')

    try {
      const payload = await fetchCollection(activeTab, isPublicForSaleView)
      const items = payload.items.filter((item) => Object.keys(getGame(item)).length > 0)
      enrichedItems = items

      if (activeTab === 'owned') {
        await updateOwnedSummaryFromStats(items)
      } else {
        updateSummaryFromItems(items)
      }

      renderCollection(items)
      setStatus(items.length ? `${items.length} item(s) dans ${getTabLabel(activeTab)}.` : '')
    } catch (error) {
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
