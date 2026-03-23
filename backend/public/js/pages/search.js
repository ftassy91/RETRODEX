'use strict'

;(() => {
  const inputEl = document.getElementById('search-router-input')
  const countEl = document.getElementById('search-router-count')
  const moduleButtons = Array.from(document.querySelectorAll('[data-module-route]'))
  const resultLinks = {
    market: '/stats.html',
    dex: '/encyclopedia.html',
    collection: '/collection.html',
  }

  const params = new URLSearchParams(window.location.search)
  let activeModule = ['market', 'dex', 'collection'].includes(params.get('module'))
    ? params.get('module')
    : 'dex'

  function syncButtons() {
    moduleButtons.forEach((button) => {
      button.classList.toggle('active', button.dataset.moduleRoute === activeModule)
    })
  }

  function updateCount() {
    const query = String(inputEl?.value || '').trim()
    countEl.textContent = query
      ? `Query prete pour ${activeModule.toUpperCase()}`
      : `${activeModule.toUpperCase()} actif`
  }

  function buildTargetUrl(moduleName) {
    const query = String(inputEl?.value || '').trim()
    const url = new URL(resultLinks[moduleName] || '/hub.html', window.location.origin)
    if (query) {
      url.searchParams.set('q', query)
    }
    return `${url.pathname}${url.search}`
  }

  function openActiveModule() {
    window.location.href = buildTargetUrl(activeModule)
  }

  function syncLinks() {
    document.querySelectorAll('#search-router-results a.terminal-action-link').forEach((link) => {
      const row = link.closest('.terminal-row')
      if (!row) return

      if (row.textContent.includes('RETROMARKET')) {
        link.href = buildTargetUrl('market')
      } else if (row.textContent.includes('RETRODEX')) {
        link.href = buildTargetUrl('dex')
      } else if (row.textContent.includes('COLLECTION')) {
        link.href = buildTargetUrl('collection')
      }
    })
  }

  if (!inputEl) {
    return
  }

  inputEl.value = params.get('q') || ''
  syncButtons()
  syncLinks()
  updateCount()

  moduleButtons.forEach((button) => {
    button.addEventListener('click', () => {
      activeModule = button.dataset.moduleRoute || 'dex'
      const nextParams = new URLSearchParams(window.location.search)
      nextParams.set('module', activeModule)
      if (inputEl.value.trim()) nextParams.set('q', inputEl.value.trim())
      else nextParams.delete('q')
      window.history.replaceState({}, '', `${window.location.pathname}?${nextParams.toString()}`)
      syncButtons()
      syncLinks()
      updateCount()
    })
  })

  inputEl.addEventListener('input', () => {
    syncLinks()
    updateCount()
  })

  inputEl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      openActiveModule()
    }

    if (event.key === 'Escape') {
      inputEl.value = ''
      syncLinks()
      updateCount()
    }
  })
})()
