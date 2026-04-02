'use strict'

;(() => {
  const defaults = {
    flags: {
      experienceLayer: true,
      collectorMode: true,
      easterEggs: true,
      contextualMicroReferences: true,
      persistCollectorModeInSession: true,
    },
    experience: {
      collectorModeSessionKey: 'r?trodex.collector-mode',
      statusCooldownMs: 1800,
      pageLoadChance: 0.42,
      rarityChances: {
        rare: 0.18,
        ultraRare: 0.04,
      },
    },
  }

  const overrides = window.RetroDexConfigOverrides || {}
  window.RetroDexConfig = {
    flags: {
      ...defaults.flags,
      ...(overrides.flags || {}),
    },
    experience: {
      ...defaults.experience,
      ...(overrides.experience || {}),
      rarityChances: {
        ...defaults.experience.rarityChances,
        ...((overrides.experience && overrides.experience.rarityChances) || {}),
      },
    },
  }
})()
