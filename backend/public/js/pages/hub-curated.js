'use strict'

;(() => {
  const bannerEl = document.getElementById('hub-curation-banner')
  if (!bannerEl) {
    return
  }

  async function loadPublicationBanner() {
    try {
      const [itemsResponse, consolesResponse] = await Promise.all([
        fetch('/api/items?limit=1'),
        fetch('/api/consoles'),
      ])
      const itemsPayload = await itemsResponse.json()
      const consolesPayload = await consolesResponse.json()
      const publication = itemsPayload.publication || consolesPayload.publication || {}
      const published = Number(publication.publishedGamesCount || 0)
      const consoles = Number(publication.consoleCount || 0)
      const total = Number(publication.catalogGamesCount || 0)
      const totalCopy = total > 0 ? ` sur ${total} jeux en base` : ''

      bannerEl.textContent = `${publication.label || 'PASS 1 curated'} | ${published} jeux publies | ${consoles} consoles | selection validee${totalCopy}.`
    } catch (_error) {
      bannerEl.textContent = 'Surface publique curee PASS 1. Recherche, consoles et catalogue exposent la selection publiee.'
    }
  }

  loadPublicationBanner()
})()
