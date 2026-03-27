'use strict';

window.RetroDexSaveButton = {
  FLOPPY_SVG: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="2" width="18" height="20" rx="1" fill="currentColor" opacity="0.15" stroke="currentColor" stroke-width="1.5"/>
    <rect x="7" y="2" width="10" height="8" rx="0.5" fill="currentColor" opacity="0.3"/>
    <rect x="13" y="3" width="3" height="5" fill="var(--bg, #000)"/>
    <rect x="6" y="13" width="12" height="8" rx="0.5" fill="currentColor" opacity="0.2" stroke="currentColor" stroke-width="0.5"/>
    <line x1="8" y1="16" x2="16" y2="16" stroke="currentColor" opacity="0.3" stroke-width="0.5"/>
    <line x1="8" y1="18" x2="14" y2="18" stroke="currentColor" opacity="0.3" stroke-width="0.5"/>
  </svg>`,

  create(gameId, isInCollection) {
    const btn = document.createElement('button')
    btn.className = `save-btn ${isInCollection ? 'is-saved' : ''}`
    btn.setAttribute('aria-label', isInCollection ? 'Retirer de ma collection' : 'Sauvegarder dans ma collection')

    // Icon span — static SVG markup, no user input
    const iconSpan = document.createElement('span')
    iconSpan.className = 'save-btn-icon'
    iconSpan.innerHTML = this.FLOPPY_SVG // safe: developer-controlled SVG constant

    const textSpan = document.createElement('span')
    textSpan.className = 'save-btn-text'
    textSpan.textContent = isInCollection ? 'SAUVÉ ✓' : 'SAVE'

    const savingSpan = document.createElement('span')
    savingSpan.className = 'save-btn-saving'
    savingSpan.setAttribute('aria-hidden', 'true')
    savingSpan.textContent = 'SAVING'
    const dotsSpan = document.createElement('span')
    dotsSpan.className = 'save-dots'
    savingSpan.appendChild(dotsSpan)

    btn.appendChild(iconSpan)
    btn.appendChild(textSpan)
    btn.appendChild(savingSpan)

    btn.addEventListener('click', async (e) => {
      e.preventDefault()
      if (btn.classList.contains('is-saving')) return

      btn.classList.add('is-saving')
      this.playSound()

      try {
        if (btn.classList.contains('is-saved')) {
          await fetch(`/api/collection/${gameId}`, { method: 'DELETE' })
          btn.classList.remove('is-saved')
          textSpan.textContent = 'SAVE'
          btn.setAttribute('aria-label', 'Sauvegarder dans ma collection')
        } else {
          await fetch('/api/collection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gameId, condition: 'Loose' })
          })
          btn.classList.add('is-saved')
          textSpan.textContent = 'SAUVÉ ✓'
          btn.setAttribute('aria-label', 'Retirer de ma collection')
        }
      } catch (err) {
        console.error('[save]', err)
      }

      setTimeout(() => btn.classList.remove('is-saving'), 800)
    })

    return btn
  },

  playSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const notes = [523, 659, 784] // C5, E5, G5 — save arpeggio
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'square'
        osc.frequency.value = freq
        gain.gain.value = 0.06
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(ctx.currentTime + i * 0.1)
        osc.stop(ctx.currentTime + i * 0.1 + 0.08)
      })
    } catch (e) { /* silent */ }
  }
}
